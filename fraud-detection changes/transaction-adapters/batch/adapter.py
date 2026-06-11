"""
transaction-adapters/batch/adapter.py
CSV Batch Adapter

Reads transaction files from MinIO (or local path) and publishes
each row to txn-raw. Supports:
  - CSV and Parquet files
  - MinIO bucket watching (polls for new files)
  - Checkpoint: tracks processed files so restarts don't re-publish
  - Rate limiting (configurable TPS cap)

Usage:
  python adapter.py --file /path/to/transactions.csv
  python adapter.py --minio-bucket uploads --watch   # poll for new files
  python adapter.py --minio-bucket uploads --prefix 2024-06/
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Iterator, Optional

logger = logging.getLogger("adapter.batch")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_adapter import BaseAdapter, CanonicalTransaction

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT",   "http://localhost:9000")
MINIO_ACCESS   = os.getenv("MINIO_ACCESS_KEY",  "fraud_minio")
MINIO_SECRET   = os.getenv("MINIO_SECRET_KEY",  "fraud_minio_2024")
RATE_LIMIT_TPS = float(os.getenv("BATCH_RATE_TPS", "1000"))
POLL_INTERVAL  = int(os.getenv("BATCH_POLL_SECONDS", "60"))

# Checkpoint file tracks which MinIO objects have been processed
CHECKPOINT_PATH = os.getenv("BATCH_CHECKPOINT", "/tmp/batch_adapter_checkpoint.json")


class CSVBatchAdapter(BaseAdapter):

    REQUIRED_FIELDS = {"txn_id", "customer_id", "amount"}
    OPTIONAL_FIELDS = {
        "currency", "channel", "merchant_id", "merchant_category",
        "device_id", "ip_address", "country_code", "city",
        "lat", "lng", "txn_ts", "clv", "trust_score",
        "account_age_days", "customer_segment", "is_new_device",
    }

    def __init__(self):
        super().__init__("csv_batch")
        self._checkpoint = self._load_checkpoint()

    def _load_checkpoint(self) -> set:
        try:
            with open(CHECKPOINT_PATH) as f:
                return set(json.load(f).get("processed", []))
        except FileNotFoundError:
            return set()

    def _save_checkpoint(self):
        try:
            with open(CHECKPOINT_PATH, "w") as f:
                json.dump({"processed": list(self._checkpoint)}, f)
        except Exception as e:
            logger.warning("Checkpoint save failed: %s", e)

    def normalise(self, raw: dict) -> Optional[CanonicalTransaction]:
        """Convert CSV row dict to CanonicalTransaction."""
        try:
            missing = self.REQUIRED_FIELDS - set(raw.keys())
            if missing:
                logger.debug("Row missing required fields: %s", missing)
                return None

            return CanonicalTransaction(
                txn_id           = str(raw["txn_id"]),
                customer_id      = str(raw["customer_id"]),
                amount           = float(raw["amount"]),
                currency         = raw.get("currency",         "USD"),
                channel          = raw.get("channel",          "BATCH"),
                merchant_id      = raw.get("merchant_id",      ""),
                merchant_category= raw.get("merchant_category",""),
                device_id        = raw.get("device_id",        ""),
                ip_address       = raw.get("ip_address",       ""),
                is_new_device    = str(raw.get("is_new_device","false")).lower() in ("true","1","yes"),
                country_code     = raw.get("country_code",     ""),
                city             = raw.get("city",             ""),
                lat              = float(raw.get("lat",  0.0) or 0.0),
                lng              = float(raw.get("lng",  0.0) or 0.0),
                txn_ts           = raw.get("txn_ts",  datetime.now(timezone.utc).isoformat()),
                clv              = float(raw.get("clv",              0.0) or 0.0),
                trust_score      = float(raw.get("trust_score",      0.5) or 0.5),
                account_age_days = int(float(raw.get("account_age_days", 0) or 0)),
                customer_segment = raw.get("customer_segment",  "standard"),
                adapter_source   = "csv_batch",
            )
        except Exception as e:
            logger.debug("Row normalise failed: %s | row=%s", e, raw)
            return None

    def _stream_csv(self, fileobj) -> Iterator[dict]:
        reader = csv.DictReader(fileobj)
        for row in reader:
            yield dict(row)

    def _stream_parquet(self, fileobj) -> Iterator[dict]:
        import pyarrow.parquet as pq
        buf   = io.BytesIO(fileobj.read())
        table = pq.read_table(buf)
        for batch in table.to_batches(max_chunksize=1000):
            df = batch.to_pandas()
            for _, row in df.iterrows():
                yield row.to_dict()

    def process_file(self, fileobj, filename: str, rate_tps: float = RATE_LIMIT_TPS) -> dict:
        """
        Process a single file object, publish rows to Kafka.
        Returns processing stats.
        """
        stats = {"file": filename, "rows": 0, "published": 0, "skipped": 0, "errors": 0}
        interval = 1.0 / rate_tps if rate_tps > 0 else 0

        stream_fn = self._stream_parquet if filename.endswith(".parquet") else self._stream_csv

        t0 = time.monotonic()
        for row in stream_fn(fileobj):
            stats["rows"] += 1
            txn = self.normalise(row)
            if txn is None:
                stats["skipped"] += 1
                continue
            if self.publish(txn):
                stats["published"] += 1
            else:
                stats["errors"] += 1
            if interval > 0 and stats["rows"] % 100 == 0:
                time.sleep(interval * 100)

        elapsed = time.monotonic() - t0
        stats["elapsed_s"]  = round(elapsed, 2)
        stats["actual_tps"] = round(stats["published"] / max(elapsed, 0.001), 0)
        self.flush()
        return stats

    def process_local_file(self, path: str) -> dict:
        filename = os.path.basename(path)
        logger.info("Processing local file: %s", path)
        with open(path, "rb" if path.endswith(".parquet") else "r",
                  encoding=None if path.endswith(".parquet") else "utf-8") as f:
            stats = self.process_file(f, filename)
        logger.info("Done: %s", stats)
        return stats

    def process_minio_file(self, bucket: str, obj_name: str) -> dict:
        """Download from MinIO and process."""
        from minio import Minio
        endpoint = MINIO_ENDPOINT.replace("http://","").replace("https://","")
        client   = Minio(endpoint, access_key=MINIO_ACCESS,
                         secret_key=MINIO_SECRET, secure=False)
        response = client.get_object(bucket, obj_name)
        data     = response.read()
        response.close()
        fileobj  = io.StringIO(data.decode()) if obj_name.endswith(".csv") else io.BytesIO(data)
        stats    = self.process_file(fileobj, obj_name)
        logger.info("MinIO file done: %s/%s → %s", bucket, obj_name, stats)
        return stats

    def watch_minio(self, bucket: str, prefix: str = ""):
        """Poll MinIO bucket for new files and process them."""
        from minio import Minio
        endpoint = MINIO_ENDPOINT.replace("http://","").replace("https://","")
        client   = Minio(endpoint, access_key=MINIO_ACCESS,
                         secret_key=MINIO_SECRET, secure=False)
        logger.info("Watching s3://%s/%s (poll every %ds)", bucket, prefix, POLL_INTERVAL)

        while True:
            try:
                objects = client.list_objects(bucket, prefix=prefix, recursive=True)
                for obj in objects:
                    key = f"{bucket}/{obj.object_name}"
                    if key in self._checkpoint:
                        continue
                    if not (obj.object_name.endswith(".csv") or obj.object_name.endswith(".parquet")):
                        continue
                    logger.info("New file detected: %s", obj.object_name)
                    try:
                        self.process_minio_file(bucket, obj.object_name)
                        self._checkpoint.add(key)
                        self._save_checkpoint()
                    except Exception as e:
                        logger.error("Failed to process %s: %s", obj.object_name, e)
            except Exception as e:
                logger.warning("MinIO watch error: %s", e)
            time.sleep(POLL_INTERVAL)


def main():
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s | %(levelname)-8s | %(message)s")
    parser = argparse.ArgumentParser(description="CSV/Parquet batch transaction adapter")
    parser.add_argument("--file",          help="Local CSV or Parquet file to process")
    parser.add_argument("--minio-bucket",  help="MinIO bucket name")
    parser.add_argument("--prefix",        default="", help="MinIO object prefix filter")
    parser.add_argument("--watch",         action="store_true", help="Watch bucket for new files")
    parser.add_argument("--rate-tps",      type=float, default=RATE_LIMIT_TPS)
    args = parser.parse_args()

    adapter = CSVBatchAdapter()

    if args.file:
        stats = adapter.process_local_file(args.file)
        print(json.dumps(stats, indent=2))
    elif args.minio_bucket and args.watch:
        adapter.watch_minio(args.minio_bucket, args.prefix)
    elif args.minio_bucket:
        objects = []
        from minio import Minio
        endpoint = MINIO_ENDPOINT.replace("http://","").replace("https://","")
        client   = Minio(endpoint, access_key=MINIO_ACCESS, secret_key=MINIO_SECRET, secure=False)
        for obj in client.list_objects(args.minio_bucket, prefix=args.prefix, recursive=True):
            if obj.object_name.endswith((".csv", ".parquet")):
                objects.append(obj.object_name)
        logger.info("Found %d files to process", len(objects))
        for obj_name in objects:
            adapter.process_minio_file(args.minio_bucket, obj_name)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
