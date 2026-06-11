"""dags/governance_dag.py — Weekly model governance DAG."""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "fraud-ml-team",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": False,
}

MODELS = ["stage1_lgbm", "stage2_xgboost", "stage2_mlp"]


def generate_model_cards(**context):
    """Generate model cards for all Production models."""
    import sys; sys.path.insert(0, "/opt/airflow/model-governance")
    from governance import generate_model_card

    cards = {}
    for model in MODELS:
        try:
            card = generate_model_card(model)
            cards[model] = card
            print(f"Model card generated: {model} v{card['model_details']['version']}")
        except Exception as e:
            print(f"Model card failed for {model}: {e}")

    context["task_instance"].xcom_push(key="cards", value=json.dumps(cards))
    return cards


def run_champion_challenger(**context):
    """Compare challenger vs champion for each model."""
    import sys; sys.path.insert(0, "/opt/airflow/model-governance")
    from governance import compare_champion_challenger
    import dataclasses

    results = {}
    for model in MODELS:
        try:
            result = compare_champion_challenger(model)
            if result:
                results[model] = dataclasses.asdict(result)
                print(f"Champion/Challenger {model}: recommendation={result.recommendation} "
                      f"Δauc={result.auc_delta:+.4f}")
        except Exception as e:
            print(f"Comparison failed for {model}: {e}")

    context["task_instance"].xcom_push(key="comparisons", value=json.dumps(results))
    return results


def write_governance_report(**context):
    """Write weekly governance report to MinIO + audit table."""
    from datetime import timezone

    cards       = json.loads(context["task_instance"].xcom_pull(
        task_ids="generate_model_cards", key="cards") or "{}")
    comparisons = json.loads(context["task_instance"].xcom_pull(
        task_ids="run_champion_challenger", key="comparisons") or "{}")

    report = {
        "report_type":    "WEEKLY_GOVERNANCE",
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "models_reviewed":len(cards),
        "model_cards":    cards,
        "champion_challenger_results": comparisons,
        "promotions_recommended": [
            m for m, r in comparisons.items()
            if r.get("recommendation") == "PROMOTE_CHALLENGER"
        ],
        "governance_summary": {
            "all_models_reviewed": len(cards) == len(MODELS),
            "any_challenger_ready": any(
                r.get("recommendation") == "PROMOTE_CHALLENGER"
                for r in comparisons.values()
            ),
        },
    }

    # Upload to MinIO
    try:
        from minio import Minio
        endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000").replace("http://","").replace("https://","")
        client   = Minio(endpoint,
                         access_key=os.getenv("MINIO_ACCESS_KEY", "fraud_minio"),
                         secret_key=os.getenv("MINIO_SECRET_KEY", "fraud_minio_2024"),
                         secure=False)
        bucket = "governance-reports"
        if not client.bucket_exists(bucket): client.make_bucket(bucket)

        import io
        content   = json.dumps(report, indent=2).encode()
        obj_name  = f"weekly/{datetime.now(timezone.utc).strftime('%Y-%m-%d')}/governance_report.json"
        client.put_object(bucket, obj_name, io.BytesIO(content), len(content),
                          content_type="application/json")
        print(f"Governance report uploaded: {bucket}/{obj_name}")
    except Exception as e:
        print(f"MinIO upload failed (non-fatal): {e}")

    # Audit
    try:
        import psycopg2
        conn = psycopg2.connect(os.getenv("POSTGRES_DSN",
            "postgresql://fraud_admin:fraud_secret_2024@postgres:5432/fraud_db"))
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO audit.events
                (event_type, entity_type, entity_id, actor, payload)
            VALUES ('GOVERNANCE_REPORT', 'ML_PIPELINE', gen_random_uuid(), 'airflow', %s::jsonb)
        """, (json.dumps({
            "models_reviewed":   report["models_reviewed"],
            "promotions_needed": report["promotions_recommended"],
            "dag_run_id":        context["run_id"],
        }),))
        conn.commit(); conn.close()
    except Exception as e:
        print(f"Audit log failed (non-fatal): {e}")


with DAG(
    dag_id            = "model_governance",
    default_args      = default_args,
    description       = "Weekly model cards + champion/challenger + governance report",
    schedule_interval = "0 3 * * 0",   # Sundays at 03:00 UTC
    start_date        = datetime(2024, 1, 1),
    catchup           = False,
    tags              = ["fraud-detection", "governance", "milestone-b"],
) as dag:

    cards = PythonOperator(
        task_id         = "generate_model_cards",
        python_callable = generate_model_cards,
    )

    comparison = PythonOperator(
        task_id         = "run_champion_challenger",
        python_callable = run_champion_challenger,
    )

    report = PythonOperator(
        task_id         = "write_governance_report",
        python_callable = write_governance_report,
        trigger_rule    = "all_done",
    )

    [cards, comparison] >> report
