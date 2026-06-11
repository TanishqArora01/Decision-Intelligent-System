"""
sinks/decision_sink.py v2 — healthcheck endpoint, dead-letter queue, reconnect on failure.
"""
from __future__ import annotations
import json, logging, os, signal, threading, time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Dict, List

logger = logging.getLogger(__name__)

class _Cfg:
    kafka_bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    kafka_topic_decisions   = os.getenv("KAFKA_TOPIC_DECISIONS",   "decisions")
    kafka_consumer_group    = os.getenv("KAFKA_CONSUMER_GROUP",    "decision-sink-v1")
    kafka_auto_offset_reset = os.getenv("KAFKA_AUTO_OFFSET_RESET", "earliest")
    pg_dsn      = os.getenv("POSTGRES_DSN", "")
    pg_enabled  = os.getenv("PG_ENABLED",  "true").lower() == "true"
    ch_host     = os.getenv("CLICKHOUSE_HOST",     "localhost")
    ch_port     = int(os.getenv("CLICKHOUSE_PORT", "9000"))
    ch_user     = os.getenv("CLICKHOUSE_USER",     "fraud_admin")
    ch_password = os.getenv("CLICKHOUSE_PASSWORD", "")
    ch_database = os.getenv("CLICKHOUSE_DB",       "fraud_analytics")
    ch_enabled  = os.getenv("CH_ENABLED",  "true").lower() == "true"
    batch_size    = int(os.getenv("SINK_BATCH_SIZE",    "100"))
    batch_timeout = float(os.getenv("SINK_BATCH_TIMEOUT", "2.0"))
    dlq_path    = os.getenv("SINK_DLQ_PATH",    "/tmp/decision_sink_dlq.jsonl")
    health_port = int(os.getenv("SINK_HEALTH_PORT", "9108"))
    log_level   = os.getenv("LOG_LEVEL", "INFO")

config = _Cfg()

# ── Health state ──────────────────────────────────────────────────────────────
class _Health:
    def __init__(self):
        self._lock = threading.Lock()
        self.running = True; self.pg_ok = False; self.ch_ok = False; self.kafka_ok = False
        self.total_written = 0; self.total_failed = 0; self.dlq_count = 0
        self.started_at = datetime.now(timezone.utc).isoformat()
    def to_dict(self):
        with self._lock:
            ok = self.running and self.kafka_ok and (self.pg_ok or self.ch_ok)
            return {"status":"ok" if ok else "degraded","kafka":self.kafka_ok,
                    "postgres":self.pg_ok,"clickhouse":self.ch_ok,
                    "total_written":self.total_written,"total_failed":self.total_failed,
                    "dlq_count":self.dlq_count,"started_at":self.started_at}

health = _Health()

# ── Health HTTP server ─────────────────────────────────────────────────────────
class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/health","/ready"):
            d = health.to_dict(); body = json.dumps(d).encode()
            self.send_response(200 if d["status"]=="ok" else 503)
            self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(body)
        else:
            self.send_response(404); self.end_headers()
    def log_message(self,*a): pass

def _start_health():
    try:
        s = HTTPServer(("0.0.0.0", config.health_port), _HealthHandler)
        threading.Thread(target=s.serve_forever, daemon=True).start()
        logger.info("Health on :%d", config.health_port)
    except Exception as e: logger.warning("Health server: %s", e)

# ── Dead-letter queue ──────────────────────────────────────────────────────────
_dlq_lock = threading.Lock()
def _write_dlq(decisions: List[Dict], reason: str):
    with _dlq_lock:
        try:
            with open(config.dlq_path,"a") as f:
                for d in decisions:
                    f.write(json.dumps({"decision":d,"reason":reason,
                        "failed_at":datetime.now(timezone.utc).isoformat()})+"\n")
            health.dlq_count += len(decisions)
            logger.warning("DLQ: %d decisions (%s)", len(decisions), reason)
        except Exception as e: logger.error("DLQ write: %s", e)

# ── PostgreSQL writer with reconnect ───────────────────────────────────────────
class _PG:
    def __init__(self): self._conn = None
    def _connect(self):
        try:
            import psycopg2
            self._conn = psycopg2.connect(config.pg_dsn.replace("+asyncpg",""))
            self._conn.autocommit = False; health.pg_ok = True
            logger.info("PostgreSQL connected")
        except Exception as e: health.pg_ok = False; self._conn = None; logger.warning("PG: %s", e)
    def connect(self): self._connect()
    def write_batch(self, rows: List[Dict]) -> int:
        if not self._conn: self._connect()
        if not self._conn: return 0
        sql = """INSERT INTO decisions.records (txn_id,pipeline_stage,action,p_fraud,uncertainty,
            graph_risk_score,anomaly_score,clv_at_decision,trust_score,expected_loss,
            expected_friction,expected_review_cost,explanation,model_version,
            ab_experiment_id,ab_variant,latency_ms,decided_at)
            VALUES (%(txn_id)s,%(pipeline_stage)s,%(action)s,%(p_fraud)s,%(uncertainty)s,
            %(graph_risk_score)s,%(anomaly_score)s,%(clv_at_decision)s,%(trust_score)s,
            %(expected_loss)s,%(expected_friction)s,%(expected_review_cost)s,
            %(explanation)s::jsonb,%(model_version)s,%(ab_experiment_id)s,%(ab_variant)s,
            %(latency_ms)s,%(decided_at)s) ON CONFLICT (txn_id) DO NOTHING"""
        try:
            import psycopg2.extras
            c = self._conn.cursor()
            psycopg2.extras.execute_batch(c, sql, rows, page_size=50)
            self._conn.commit(); health.pg_ok = True; return len(rows)
        except Exception as e:
            logger.error("PG write: %s", e); health.pg_ok = False
            try: self._conn.rollback()
            except: pass
            self._conn = None; return 0

# ── ClickHouse writer with reconnect ──────────────────────────────────────────
class _CH:
    def __init__(self): self._client = None
    def _connect(self):
        try:
            from clickhouse_driver import Client
            self._client = Client(host=config.ch_host,port=config.ch_port,
                user=config.ch_user,password=config.ch_password,database=config.ch_database,
                connect_timeout=5,send_receive_timeout=30)
            self._client.execute("SELECT 1"); health.ch_ok = True; logger.info("ClickHouse connected")
        except Exception as e: health.ch_ok = False; self._client = None; logger.warning("CH: %s", e)
    def connect(self): self._connect()
    def write_batch(self, rows: List[Dict]) -> int:
        if not self._client: self._connect()
        if not self._client: return 0
        data = []
        for d in rows:
            try:
                data.append((
                    datetime.fromisoformat(d.get("decided_at",datetime.now(timezone.utc).isoformat()).replace("Z","+00:00")),
                    d.get("txn_id",""),d.get("txn_id",""),d.get("customer_id",""),
                    int(d.get("pipeline_stage",3)),d.get("action",""),
                    float(d.get("p_fraud",0)),float(d.get("uncertainty",0)),
                    float(d.get("graph_risk_score",0)),float(d.get("anomaly_score",0)),
                    float(d.get("amount",0)),d.get("currency","USD"),
                    d.get("channel",""),d.get("merchant_category",""),d.get("country_code",""),
                    float(d.get("clv_used",0)),float(d.get("trust_score",0.5)),
                    float(d.get("expected_loss",0)),0.0,0.0,
                    float(d.get("latency_ms",0)),d.get("model_version",""),
                    d.get("ab_experiment_id",""),d.get("ab_variant","control"),
                    json.dumps(d.get("explanation",{})),
                ))
            except: pass
        if not data: return 0
        try:
            self._client.execute("INSERT INTO fraud_analytics.decisions VALUES", data)
            health.ch_ok = True; return len(data)
        except Exception as e:
            logger.error("CH write: %s", e); health.ch_ok = False; self._client = None; return 0

def _parse(raw: Dict) -> Dict:
    cb  = raw.get("cost_breakdown",[])
    opt = next((c for c in cb if c.get("is_optimal")),{})
    return {"txn_id":raw.get("txn_id",""),"customer_id":raw.get("customer_id",""),
        "pipeline_stage":raw.get("pipeline_stage",3),"action":raw.get("action",""),
        "p_fraud":float(raw.get("p_fraud",0)),"uncertainty":float(raw.get("uncertainty",0)),
        "graph_risk_score":float(raw.get("graph_risk_score",0)),
        "anomaly_score":float(raw.get("anomaly_score",0)),
        "clv_at_decision":float(raw.get("clv_used",0)),
        "trust_score":float(raw.get("trust_score",0.5)),
        "amount":float(raw.get("amount",0)),"currency":raw.get("currency","USD"),
        "channel":raw.get("channel",""),"country_code":raw.get("country_code",""),
        "merchant_category":raw.get("merchant_category",""),
        "expected_loss":float(opt.get("expected_loss",0)),
        "expected_friction":float(opt.get("expected_friction",0)),
        "expected_review_cost":float(opt.get("expected_review",0)),
        "explanation":json.dumps(raw.get("explanation",{})),
        "model_version":raw.get("model_version",""),
        "ab_experiment_id":raw.get("ab_experiment_id",""),
        "ab_variant":raw.get("ab_variant","control"),
        "latency_ms":float(raw.get("decision_time_ms",0)),
        "decided_at":datetime.now(timezone.utc).isoformat()}

class DecisionSink:
    def __init__(self):
        self.pg   = _PG() if config.pg_enabled else None
        self.ch   = _CH() if config.ch_enabled else None
        self._stop= threading.Event()
    def connect(self):
        if self.pg: self.pg.connect()
        if self.ch: self.ch.connect()
    def _flush(self, batch: List[Dict], consumer):
        n_pg = self.pg.write_batch(batch) if self.pg else 0
        n_ch = self.ch.write_batch(batch) if self.ch else 0
        ok   = max(n_pg, n_ch)
        if ok < len(batch): _write_dlq(batch[ok:], f"pg={n_pg} ch={n_ch}/{len(batch)}"); health.total_failed += len(batch)-ok
        else: health.total_written += len(batch)
        logger.info("Flushed %d → pg=%d ch=%d dlq=%d", len(batch), n_pg, n_ch, health.dlq_count)
        consumer.commit(asynchronous=False)
    def run(self):
        try: from confluent_kafka import Consumer
        except ImportError: logger.error("confluent-kafka not installed"); return
        c = Consumer({"bootstrap.servers":config.kafka_bootstrap_servers,
            "group.id":config.kafka_consumer_group,
            "auto.offset.reset":config.kafka_auto_offset_reset,
            "enable.auto.commit":False})
        c.subscribe([config.kafka_topic_decisions])
        health.kafka_ok = True; logger.info("Decision sink started")
        batch: List[Dict] = []; last = time.monotonic()
        while not self._stop.is_set():
            msg = c.poll(timeout=0.5)
            if msg and not msg.error():
                try: batch.append(_parse(json.loads(msg.value().decode())))
                except Exception as e: logger.warning("Parse: %s", e)
            elapsed = time.monotonic()-last
            if len(batch)>=config.batch_size or (batch and elapsed>=config.batch_timeout):
                self._flush(batch, c); batch=[]; last=time.monotonic()
        if batch: self._flush(batch, c)
        c.close(); logger.info("Sink stopped")
    def stop(self): self._stop.set()

if __name__ == "__main__":
    logging.basicConfig(level=getattr(logging,config.log_level.upper(),logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(message)s")
    _start_health()
    sink = DecisionSink(); sink.connect()
    def _shutdown(s,f): health.running=False; sink.stop()
    signal.signal(signal.SIGINT,_shutdown); signal.signal(signal.SIGTERM,_shutdown)
    sink.run()
