"""dags/dataset_export.py — Weekly dataset export DAG."""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "fraud-ml-team",
    "retries": 1,
    "retry_delay": timedelta(minutes=10),
    "email_on_failure": False,
}


def run_export(**context):
    """Run the full dataset export pipeline."""
    import sys
    sys.path.insert(0, "/opt/airflow/dataset-pipeline")
    from main import run
    run()


def notify_complete(**context):
    """Log completion to PostgreSQL audit table."""
    import json, os
    try:
        import psycopg2
        dsn = os.getenv("POSTGRES_DSN",
                         "postgresql://fraud_admin:fraud_secret_2024@postgres:5432/fraud_db")
        conn = psycopg2.connect(dsn)
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO audit.events (event_type, entity_type, entity_id, actor, payload)
            VALUES ('DATASET_EXPORTED', 'PIPELINE', gen_random_uuid(), 'airflow', %s::jsonb)
        """, (json.dumps({
            "dag_run_id":    context["run_id"],
            "execution_date":str(context["execution_date"]),
            "version":       os.getenv("DATASET_VERSION", "1.0.0"),
        }),))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Audit log failed (non-fatal): {e}")


with DAG(
    dag_id            = "dataset_export",
    default_args      = default_args,
    description       = "Weekly dataset export: synthetic + real → MinIO",
    schedule_interval = "0 1 * * 5",   # Fridays at 01:00 UTC
    start_date        = datetime(2024, 1, 1),
    catchup           = False,
    tags              = ["fraud-detection", "datasets", "milestone-b"],
) as dag:

    export = PythonOperator(
        task_id         = "run_export",
        python_callable = run_export,
    )

    notify = PythonOperator(
        task_id         = "notify_complete",
        python_callable = notify_complete,
    )

    export >> notify
