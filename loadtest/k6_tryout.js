// k6 load test — 300 concurrent Try Out takers (full flow: login -> start -> submit)
// Install k6: https://k6.io/docs/get-started/installation/
// Run:
//   k6 run -e BASE=https://adaptive-edu-portal.emergent.host -e VUS=300 k6_tryout.js
//
// Requires accounts seeded by seed_loadtest.py (loadtest_1..N@lms.id / Load@12345)
// and the tryout id "lt_tryout".
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:8001";
const VUS = parseInt(__ENV.VUS || "300");
const TRYOUT = __ENV.TRYOUT || "lt_tryout";
const PASSWORD = "Load@12345";

const flowTime = new Trend("flow_duration_ms", true);
const flowOk = new Rate("flow_success");

export const options = {
  scenarios: {
    exam_burst: {
      // ramp to VUS over 30s (staggered start), hold 1m
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: VUS },
        { duration: "1m", target: VUS },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    flow_success: ["rate>0.99"],
    flow_duration_ms: ["p(95)<5000"],
  },
};

export default function () {
  const jar = http.cookieJar();
  const i = ((__VU - 1) % VUS) + 1;
  const email = `loadtest_${i}@lms.id`;
  const t0 = Date.now();
  let ok = true;

  let r = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password: PASSWORD }), { headers: { "Content-Type": "application/json" } });
  ok = ok && check(r, { "login 200": (x) => x.status === 200 });

  http.get(`${BASE}/api/student/tryouts`);

  r = http.post(`${BASE}/api/student/tryouts/${TRYOUT}/start`);
  ok = ok && check(r, { "start 200": (x) => x.status === 200 });
  const attemptId = r.status === 200 ? r.json("id") : null;

  http.get(`${BASE}/api/student/tryouts/${TRYOUT}`);
  sleep(1); // think time

  if (attemptId) {
    const answers = { answers: { lt_q1: ["o1"], lt_q2: ["o1"], lt_q3: ["o1"], lt_q4: ["o1"], lt_q5: ["o1"] } };
    r = http.post(`${BASE}/api/student/attempts/${attemptId}/submit`, JSON.stringify(answers), { headers: { "Content-Type": "application/json" } });
    ok = ok && check(r, { "submit 200": (x) => x.status === 200 });
  }

  flowTime.add(Date.now() - t0);
  flowOk.add(ok);
}
