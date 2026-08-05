import http from "k6/http";
import { check, group, sleep } from "k6";


const BASE = __ENV.BASE_URL || "https://pms-hr.uol.edu.pk";
const EMPLOYEE_PEAK = Number(__ENV.EMPLOYEE_PEAK || 4000);
const HR_PEAK = Number(__ENV.HR_PEAK || 15);

const EMPLOYEE_COOKIE =
  __ENV.EMPLOYEE_COOKIE ||
  "__Secure-next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..Lv3MYrTtiJDh_w3W.NoQ5PpJqfBpm1p7Zxu18zvpNaFWgD9v9Q2znQm_LeJCi91SqgHRVyTopynsYwPPDmQyPAvs19GXjcSFQXcuLZtiE9co_kQmw6whtU7QIA1Yne1twlKz7OIptFupUb942yqXf8oGTtZJES13Z2Go7F8WrgeuXDWlWnkPaxtS_LTn1-TAhdH9EnUD7IMcqXh8uRRZfKqGGmF4ENC70TNOad4yBAA-smZIYYZXEex38nmVQlANyF30StewR7emwiKjw7X1bn7JqDnGH9-cImQMQzuA290DRa-tRKV8d95YZe9LRf46FM8soCbgFfCP7cU-vnWNP.13Pw8mpSNfXiECxEr6piKA";

const HR_COOKIE =
  __ENV.HR_COOKIE ||
  "__Secure-next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..-EFy2QohNFFdM3V8.0T_3UAH0pXm29IgJFXPgOh5GCIlQF1vtcc38ALhAYGM26JKGUiWfBmz8Nt2UxVF2m7SUXC5BjyATpYLTQgYQit8nOrrzCEDO-oK3_E2qUh8T_yl9W_zrPmpepCUk8PZQQCzf0XzdGJl2NnLKqUAARO7Pwph5QlmYz3B-3Yo1liggHOiDpovT95qUSlAVem5Ni3ZkqWOYiH-qhZwoBDT8mm3gegoe4sHZHm3eImcspFgo9bmMK44P0NMr7iNvaOkKKxfNosZIR2Jzv2W6epyAcZ35MWDZ6kkDAYFbZdolPttObZY0tV4z70Yk_USKALky7HtTS2gX6vQ.L1NmuJfwhBzTkT56ko00MQ";

function authHeaders(cookie) {
  return {
    Cookie: cookie,
    Accept: "application/json, text/html",
  };
}

export const options = {
  scenarios: {
    // Majority traffic: employees opening My Forms
    employees_myforms: {
      executor: "ramping-vus",
      exec: "employeeMyForms",
      startVUs: 0,
      stages: [
        { duration: "1m", target: Math.min(100, EMPLOYEE_PEAK) },
        { duration: "2m", target: Math.min(100, EMPLOYEE_PEAK) },
        { duration: "2m", target: Math.min(500, EMPLOYEE_PEAK) },
        { duration: "2m", target: Math.min(500, EMPLOYEE_PEAK) },
        { duration: "2m", target: Math.min(1000, EMPLOYEE_PEAK) },
        { duration: "2m", target: Math.min(1000, EMPLOYEE_PEAK) },
        { duration: "3m", target: Math.min(2000, EMPLOYEE_PEAK) },
        { duration: "2m", target: Math.min(2000, EMPLOYEE_PEAK) },
        { duration: "3m", target: EMPLOYEE_PEAK },
        { duration: "3m", target: EMPLOYEE_PEAK },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "30s",
      tags: { role: "employee" },
    },

    // Minority traffic: HR on dashboard (overlaps employee peak)
    hr_dashboard: {
      executor: "ramping-vus",
      exec: "hrDashboard",
      startVUs: 0,
      stages: [
        { duration: "1m", target: Math.min(10, HR_PEAK) },
        { duration: "1m", target: HR_PEAK },
        { duration: "20m", target: HR_PEAK },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "30s",
      tags: { role: "hr" },
    },
  },

  thresholds: {
    checks: ["rate>0.95"],
    "http_req_failed{role:employee}": ["rate<0.05"],
    "http_req_duration{name:employee_myforms_page}": ["p(95)<5000"],
    "http_req_duration{name:employee_myforms_api}": ["p(95)<5000"],
    "http_req_failed{role:hr}": ["rate<0.05"],
    "http_req_duration{name:hr_dashboard_page}": ["p(95)<8000"],
    "http_req_duration{name:hr_overview_api}": ["p(95)<10000"],
  },
};

/** Employee journey: list page + forms API (what the browser loads). */
export function employeeMyForms() {
  group("employee_myforms", () => {
    const page = http.get(`${BASE}/dashboard/my-forms`, {
      headers: authHeaders(EMPLOYEE_COOKIE),
      redirects: 0,
      tags: { name: "employee_myforms_page", role: "employee" },
    });

    check(page, {
      "employee page 200": (r) => r.status === 200,
      "employee page not login redirect": (r) =>
        r.status !== 302 && r.status !== 307,
    });

    const api = http.get(`${BASE}/api/my-forms`, {
      headers: authHeaders(EMPLOYEE_COOKIE),
      redirects: 0,
      tags: { name: "employee_myforms_api", role: "employee" },
    });

    check(api, {
      "employee api 200": (r) => r.status === 200,
    });

    if (__ITER === 0 && __VU === 1) {
      console.log(
        `employee page=${page.status} api=${api.status} peak=${EMPLOYEE_PEAK}`,
      );
    }
  });

  // Think time: employee reads the list / picks a form
  sleep(2 + Math.random() * 3);
}

/** HR journey: dashboard shell + heavy overview API. */
export function hrDashboard() {
  group("hr_dashboard", () => {
    const page = http.get(`${BASE}/dashboard`, {
      headers: authHeaders(HR_COOKIE),
      redirects: 0,
      tags: { name: "hr_dashboard_page", role: "hr" },
    });

    check(page, {
      "hr page 200": (r) => r.status === 200,
      "hr page not login redirect": (r) =>
        r.status !== 302 && r.status !== 307,
    });

    const overview = http.get(`${BASE}/api/submissions/overview`, {
      headers: authHeaders(HR_COOKIE),
      redirects: 0,
      tags: { name: "hr_overview_api", role: "hr" },
    });

    check(overview, {
      "hr overview 200": (r) => r.status === 200,
    });

    if (__ITER === 0 && __VU === 1) {
      console.log(
        `hr page=${page.status} overview=${overview.status} hrPeak=${HR_PEAK}`,
      );
    }
  });

  // Think time: HR reviews filters / tables
  sleep(3 + Math.random() * 5);
}
