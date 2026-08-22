"""Concurrent Try Out load test using real HTTP + cookies (no external tools).

Simulates each virtual user doing the FULL exam flow:
    login -> GET /student/tryouts -> POST /start -> GET tryout detail -> POST /submit

Usage:
    python run_loadtest.py [BASE_URL] [CONCURRENCY] [TRYOUT_ID]

Examples:
    python run_loadtest.py https://adaptive-edu-portal.emergent.host 300 lt_tryout
    python run_loadtest.py <preview_url> 300

Reads default BASE_URL from ../frontend/.env (REACT_APP_BACKEND_URL) if not given.
Requires accounts seeded by seed_loadtest.py.
"""
import os
import sys
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests


def default_base():
    envp = os.path.join(os.path.dirname(__file__), "..", "frontend", ".env")
    try:
        for line in open(envp):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.strip().split("=", 1)[1]
    except Exception:
        pass
    return "http://localhost:8001"


BASE = (sys.argv[1] if len(sys.argv) > 1 else default_base()).rstrip("/")
CONC = int(sys.argv[2]) if len(sys.argv) > 2 else 300
TRYOUT = sys.argv[3] if len(sys.argv) > 3 else "lt_tryout"
PASSWORD = "Load@12345"
TIMEOUT = 60


def one_user(i):
    """Run the full exam flow for one virtual student. Returns (ok, total_ms, step_failed)."""
    s = requests.Session()
    email = f"loadtest_{i}@lms.id"
    t0 = time.perf_counter()
    try:
        r = s.post(f"{BASE}/api/auth/login", json={"email": email, "password": PASSWORD}, timeout=TIMEOUT)
        if r.status_code != 200:
            return (False, (time.perf_counter() - t0) * 1000, f"login:{r.status_code}")
        s.get(f"{BASE}/api/student/tryouts", timeout=TIMEOUT)
        r = s.post(f"{BASE}/api/student/tryouts/{TRYOUT}/start", timeout=TIMEOUT)
        if r.status_code != 200:
            return (False, (time.perf_counter() - t0) * 1000, f"start:{r.status_code}")
        attempt_id = r.json().get("id")
        s.get(f"{BASE}/api/student/tryouts/{TRYOUT}", timeout=TIMEOUT)
        answers = {f"lt_q{n}": ["o1"] for n in range(1, 6)}
        r = s.post(f"{BASE}/api/student/attempts/{attempt_id}/submit", json={"answers": answers}, timeout=TIMEOUT)
        if r.status_code != 200:
            return (False, (time.perf_counter() - t0) * 1000, f"submit:{r.status_code}")
        return (True, (time.perf_counter() - t0) * 1000, None)
    except Exception as e:
        return (False, (time.perf_counter() - t0) * 1000, f"exc:{type(e).__name__}")


def pct(vals, p):
    if not vals:
        return 0
    vals = sorted(vals)
    k = int(round((p / 100) * (len(vals) - 1)))
    return vals[k]


def main():
    print(f"Target={BASE} | concurrency={CONC} | tryout={TRYOUT}")
    print("Menjalankan... (login+start+detail+submit per user)\n")
    results, fails = [], {}
    wall0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=CONC) as ex:
        futs = [ex.submit(one_user, i) for i in range(1, CONC + 1)]
        for f in as_completed(futs):
            ok, ms, step = f.result()
            results.append((ok, ms))
            if not ok:
                fails[step] = fails.get(step, 0) + 1
    wall = time.perf_counter() - wall0

    lat = [ms for ok, ms in results if ok]
    n_ok = sum(1 for ok, _ in results if ok)
    n = len(results)
    print("================ HASIL LOAD TEST ================")
    print(f"Total virtual users : {n}")
    print(f"Sukses (full flow)  : {n_ok}  ({round(n_ok / n * 100, 1)}%)")
    print(f"Gagal               : {n - n_ok}  -> {fails if fails else '-'}")
    print(f"Wall time           : {round(wall, 2)} s")
    print(f"Throughput          : {round(n / wall, 1)} user-flow/detik")
    if lat:
        print(f"Latensi per flow (ms): p50={round(pct(lat,50))}  p95={round(pct(lat,95))}  "
              f"p99={round(pct(lat,99))}  max={round(max(lat))}  avg={round(statistics.mean(lat))}")
    print("=================================================")


if __name__ == "__main__":
    main()
