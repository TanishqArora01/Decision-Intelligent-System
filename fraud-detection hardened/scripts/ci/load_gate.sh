#!/usr/bin/env bash
# scripts/ci/load_gate.sh
# Runs the load test and fails if results don't meet thresholds.json targets.
#
# Usage:
#   ./scripts/ci/load_gate.sh                   # uses ENVIRONMENT=ci thresholds
#   ENVIRONMENT=staging ./scripts/ci/load_gate.sh
#   GATEWAY_URL=http://staging:8000 ENVIRONMENT=staging ./scripts/ci/load_gate.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENVIRONMENT="${ENVIRONMENT:-ci}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8000}"
THRESHOLDS_FILE="$ROOT/scripts/ci/thresholds.json"
REPORT_FILE="${LOAD_REPORT_FILE:-/tmp/load_test_result.json}"

ok()   { echo "  ✓  $*"; }
fail() { echo "  ✗  $*"; }

echo "=== Load Test Gate ==="
echo "  Environment: $ENVIRONMENT"
echo "  Gateway:     $GATEWAY_URL"
echo "  Thresholds:  $THRESHOLDS_FILE"
echo ""

# Read thresholds for this environment
python3 << PYEOF
import json, sys, subprocess, time, httpx

thresholds_file = '$THRESHOLDS_FILE'
environment     = '$ENVIRONMENT'
gateway_url     = '$GATEWAY_URL'

with open(thresholds_file) as f:
    config = json.load(f)

env_thresholds = config['environments'].get(environment)
if not env_thresholds:
    print(f"Unknown environment: {environment}")
    print(f"Available: {list(config['environments'].keys())}")
    sys.exit(1)

t = env_thresholds
print(f"Thresholds: TPS>={t['min_actual_tps']} p95<={t['p95_latency_ms']}ms "
      f"err<={t['error_rate_pct']}% duration={t['duration_seconds']}s")
print()

# Check gateway is reachable
import urllib.request
try:
    urllib.request.urlopen(f"{gateway_url}/health", timeout=10)
    print(f"✓  Gateway reachable: {gateway_url}")
except Exception as e:
    print(f"✗  Gateway not reachable: {e}")
    print("   Start services with: make up-all-production")
    sys.exit(1)

# Run load test as subprocess (captures stats)
import asyncio, random, uuid, time as time_mod

async def run_gate():
    target_tps  = t['target_tps']
    duration    = t['duration_seconds']
    concurrency = max(5, target_tps // 20)
    interval    = concurrency / target_tps

    stats = {'ok': 0, 'errors': 0, 'latencies': []}
    stop  = asyncio.Event()

    async def worker(wid):
        rng = random.Random(wid * 1337)
        async with __import__('httpx').AsyncClient(timeout=5.0) as c:
            while not stop.is_set():
                txn = {
                    'txn_id':      str(uuid.uuid4()),
                    'customer_id': f'gate-{rng.randint(1,500):05d}',
                    'amount':      round(rng.lognormvariate(4.5, 0.8), 2),
                    'currency':    'USD', 'channel': 'WEB',
                    'country_code':'IN', 'customer_segment': 'standard',
                }
                t0 = time_mod.perf_counter()
                try:
                    r = await c.post(f'{gateway_url}/transaction', json=txn)
                    ms = (time_mod.perf_counter() - t0) * 1000
                    if r.status_code == 200:
                        stats['ok'] += 1
                        stats['latencies'].append(ms)
                    else:
                        stats['errors'] += 1
                except Exception:
                    stats['errors'] += 1
                if interval > 0:
                    await asyncio.sleep(interval)

    workers = [asyncio.create_task(worker(i)) for i in range(concurrency)]
    for elapsed in range(duration):
        await asyncio.sleep(1)
        total = stats['ok'] + stats['errors']
        print(f"  t={elapsed+1:3d}s  ok={stats['ok']:5d}  err={stats['errors']:4d}  "
              f"tps={total/(elapsed+1):5.0f}", end='\r')
    stop.set()
    await asyncio.gather(*[w for w in workers], return_exceptions=True)
    print()
    return stats

stats = asyncio.run(run_gate())

# Evaluate
lats = sorted(stats['latencies'])
n    = max(len(lats), 1)
total= stats['ok'] + stats['errors']
p95  = lats[int(n*0.95)] if lats else 9999
p99  = lats[int(n*0.99)] if lats else 9999
err_pct = stats['errors'] / max(total, 1) * 100
actual_tps = stats['ok'] / t['duration_seconds']

print()
print(f"Results:")
print(f"  Actual TPS:   {actual_tps:.1f} (min: {t['min_actual_tps']})")
print(f"  p95 latency:  {p95:.0f}ms (max: {t['p95_latency_ms']}ms)")
print(f"  p99 latency:  {p99:.0f}ms (max: {t['p99_latency_ms']}ms)")
print(f"  Error rate:   {err_pct:.2f}% (max: {t['error_rate_pct']}%)")

failures = []
if actual_tps < t['min_actual_tps']:
    failures.append(f"TPS {actual_tps:.1f} < minimum {t['min_actual_tps']}")
if p95 > t['p95_latency_ms']:
    failures.append(f"p95 {p95:.0f}ms > max {t['p95_latency_ms']}ms")
if p99 > t['p99_latency_ms']:
    failures.append(f"p99 {p99:.0f}ms > max {t['p99_latency_ms']}ms")
if err_pct > t['error_rate_pct']:
    failures.append(f"error rate {err_pct:.2f}% > max {t['error_rate_pct']}%")

# Write report
import json as _json
with open('$REPORT_FILE', 'w') as f:
    _json.dump({
        'environment':  environment,
        'gateway_url':  gateway_url,
        'thresholds':   t,
        'actual_tps':   actual_tps,
        'p95_ms':       p95,
        'p99_ms':       p99,
        'error_rate_pct': err_pct,
        'total_requests': total,
        'passed':       len(failures) == 0,
        'failures':     failures,
    }, f, indent=2)

print()
if failures:
    print("✗ Load gate FAILED:")
    for f in failures:
        print(f"    - {f}")
    sys.exit(1)
else:
    print("✓ Load gate PASSED — all thresholds met")
    sys.exit(0)
PYEOF
