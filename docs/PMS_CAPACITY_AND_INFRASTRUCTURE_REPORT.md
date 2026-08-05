# PMS Portal — Capacity & Infrastructure Assessment Report

**System:** Performance Management System (PMS) — `https://pms-hr.uol.edu.pk`  
**Host:** `alumniportal` (shared Linux server)  
**Assessment date:** 5 August 2026  
**Audience:** Management / IT leadership  
**Method:** Live server inventory + authenticated load testing (k6)

---

## 1. Executive summary

| Question | Finding |
|----------|---------|
| Can the current server support **~4,000 employees using My Forms at the same time**? | **No.** Under a peak of ~4,000 concurrent virtual users, **~76% of requests failed** and most employee page/API calls did not return success. |
| Does the portal work well at **moderate** concurrent use? | **Yes, for light dashboard traffic.** A staged test up to **60 concurrent** users on `/dashboard` completed with **100% success** and **p95 latency ~39 ms**. |
| What limits capacity today? | **Shared 4‑core / ~8 GB host**, **one Node.js process** for PMS, **default DB connection pool (~10)**, **PostgreSQL on the same machine**, and **multiple other portals** competing for CPU/RAM. |
| Is “4,000 employees” the same as “4,000 concurrent users”? | **No.** 4,000 is total headcount. Concurrent users at one moment are normally a fraction of that. The test proved **true concurrent 4,000** is not viable on this host. |

**Bottom line for management:** The PMS application is functional and performs well under modest concurrent load. The **current shared server cannot safely absorb a mass concurrent open of My Forms by thousands of employees**. Capacity must be increased (dedicated resources / horizontal scale / DB pool tuning) and peak usage should be planned (staggered windows), or the portal will degrade (timeouts, errors) during peak events.

---

## 2. Scope and test method

### 2.1 What was measured

1. **Server configuration** (CPU, RAM, processes, nginx, PostgreSQL, PM2).  
2. **Authenticated load tests** against production URL `https://pms-hr.uol.edu.pk` using **k6**.  
3. Realistic traffic mix:
   - **Employees:** `/dashboard/my-forms` + `/api/my-forms`
   - **HR:** `/dashboard` + `/api/submissions/overview` (~10–20 concurrent)

### 2.2 What “concurrent users” means

| Term | Meaning |
|------|---------|
| **Total employees** | Headcount who may use the portal over a period (e.g. 4,000+) |
| **Concurrent users (VUs)** | Number of users hitting the server **at the same moment** |

Load tests measure **concurrent** demand. That is the correct stress metric for server capacity.

### 2.3 Tools

- **k6** (load generator, run from analyst workstation)  
- **PM2**, **nginx**, **PostgreSQL 18**, OS metrics on `alumniportal`

---

## 3. Current infrastructure (real inventory)

### 3.1 Hardware / OS resources

| Resource | Measured value |
|----------|----------------|
| CPU cores (`nproc`) | **4** |
| Memory | **~7.7 GiB** total (~2.2 GiB used at quiet times; under load RAM usage rose substantially) |
| Swap | **2.0 GiB** |
| Root disk | **~97 GiB** (~26% used) |
| Host role | **Shared** — multiple university portals on one VM |

### 3.2 Application runtime (PMS)

| Item | Measured value |
|------|----------------|
| Process manager | **PM2** (`pms_uol`) |
| Mode | **fork** → **single** Node/`next-server` process |
| Listen port | **3005** |
| Next.js version (observed) | **16.2.7** |
| Reverse proxy | **nginx** (ports 80/443 → app) |
| nginx workers | **4** (`worker_processes auto`) |
| nginx `worker_connections` | **768** (not the primary bottleneck) |

### 3.3 Database

| Item | Measured value |
|------|----------------|
| Engine | **PostgreSQL 18** on the **same host** |
| Database | `pms_uol` |
| `max_connections` | **100** (shared across **all** apps/DBs on this Postgres) |
| `shared_buffers` | **128 MB** |
| App DB pool (`pg.Pool` in code) | **No custom `max`** → library default **~10 connections per Node process** |

At rest, PMS typically held a handful of **idle** pool connections (e.g. 4 idle) — normal. Under heavy load, this pool size becomes a queue point.

### 3.4 Other applications on the same server (competition)

Observed PM2 apps (same host as PMS):

| App | Status (at assessment) | Notes |
|-----|------------------------|--------|
| `alumni-portal` | Online | Shares CPU/RAM |
| `student-alert-system` | Online | Shares CPU/RAM |
| `pgsqaf` | Online | Shares CPU/RAM |
| `ireb-system` | Online | Shares CPU/RAM |
| `cai-ping` | Online | Shares CPU/RAM |
| `edms` | **Stopped** during remediation | Frees RAM when left stopped |
| `pms_uol` | Online | Target system |

**Implication:** PMS does **not** own the full 4 cores / 8 GB. CPU and memory are contested. Idle apps use little CPU but can still hold significant RAM via `next-server` child processes.

### 3.5 Stability note

`pms_uol` showed a high historical PM2 restart count (**↺ 31** observed). Restarts under memory pressure or crashes reduce effective capacity and should be investigated separately (logs / OOM / deploy issues).

---

## 4. Load test results (real stats)

### 4.1 Test A — HR dashboard, moderate concurrency (staged 10 → 60)

**Target:** `GET /dashboard` (authenticated)  
**Profile:** Ramp and hold up to **60** virtual users  

| Metric | Result |
|--------|--------|
| Checks succeeded | **100%** |
| HTTP failures | **0%** |
| p95 latency | **~39 ms** |
| Outcome | **Pass** — comfortable |

**Interpretation:** At up to **~60 concurrent** users on the dashboard document path, the service remained healthy with excellent latency.

*Note: This path is lighter than full browser behaviour (client-side APIs). It is a lower bound on stress, not the heaviest case.*

---

### 4.2 Test B — HR dashboard, extreme concurrency (1,000 VUs)

**Target:** `GET /dashboard`  
**Peak:** **1,000** concurrent VUs  

| Metric | Result |
|--------|--------|
| HTTP 200 rate | **~99.7%** |
| p95 latency | **~17.7 seconds** (failed 3s threshold) |
| Median latency | **~3.4 s** |
| Max latency | **~56 s** |
| Outcome | **Technically mostly “up”, operationally unacceptable** |

**Interpretation:** The server largely avoided hard errors but **response times collapsed**. Users would experience a broken portal even when HTTP status is 200.

---

### 4.3 Test C — Production-shaped peak (employees + HR) → **4,000 employees + 15 HR**

**Duration:** ~24 minutes (full ramp)  
**Peak VUs:** **~4,015** (4,000 employees + 15 HR)  
**Employee journey:** My Forms page + `/api/my-forms`  
**HR journey:** Dashboard page + `/api/submissions/overview`

| Metric | Result |
|--------|--------|
| Total HTTP requests | **589,259** |
| Overall `http_req_failed` | **76.08%** |
| Employee failure rate | **76.28%** |
| HR failure rate | **41.33%** |
| Checks succeeded | **49.28%** |
| Employee My Forms **page** HTTP 200 | **~22%** |
| Employee My Forms **API** HTTP 200 | **~25%** |
| HR dashboard page HTTP 200 | **~57%** |
| HR overview API HTTP 200 | **~60%** |
| p95 latency (overall) | **~7.2 s** (skewed by failures; successful calls slower) |
| Successful-response p95 | **~10.9 s** |
| Max request time | **60 s** (timeouts) |
| Auth redirects | **Not** the failure mode (login-redirect checks largely passed) |
| Outcome | **Fail — system overloaded** |

**Interpretation:** At the modelled peak of **~4,000 concurrent employees on My Forms**, the platform **does not deliver a usable service**. Failures are consistent with saturation (Node process, DB pool/Postgres, and/or proxy/timeouts), not with bad login sessions.

---

## 5. Bottleneck analysis

### 5.1 Ranked bottlenecks (evidence-based)

| Priority | Bottleneck | Evidence | Effect |
|----------|------------|----------|--------|
| **P1** | **Single Node process** for PMS (PM2 `fork`) | One `next-server` on :3005; 4 CPUs underused by one event loop under queueing | Throughput ceiling; latency explodes as wait queues grow |
| **P1** | **DB pool ~10 connections / process** | Application uses default `pg.Pool` with no raised `max` | Beyond ~10 concurrent DB-heavy requests, work queues → timeouts/errors |
| **P1** | **Shared host** (CPU/RAM/Postgres) | Multiple Next apps + Postgres 18 on same 4‑core / 8 GB VM | PMS cannot use full machine; noisy neighbours |
| **P2** | **PostgreSQL on same VM** | Local Postgres; `max_connections=100` shared; `shared_buffers=128MB` | I/O and CPU contend with Node under peak |
| **P2** | **Heavy HR APIs** under load | Overview API slower / more failures than static-like paths | HR experience degrades when employees peak |
| **P3** | **Idle apps holding RAM** | Multiple `next-server` processes historically 100–700+ MB each | Less headroom for PMS/Postgres cache |
| **P3** | **Process instability** | High PM2 restart count on `pms_uol` | Intermittent capacity loss |

nginx connection limits were **not** indicated as the first failure point relative to app/DB saturation.

### 5.2 Architecture sketch (as deployed)

```text
[Employees / HR browsers]
          │
          ▼
     nginx :443
          │
          ▼
  next-server (1 process) :3005     ← PMS only one worker
          │
          ▼
   PostgreSQL 18 (same VM)          ← shared with other DBs/apps
          │
   pool ≈ 10 connections/process
```

### 5.3 Capacity statement (careful wording)

| Scenario | Supported on current host? |
|----------|----------------------------|
| Dozens of concurrent users (order of **≤ ~60** on light dashboard path in Test A) | **Yes** (measured, excellent latency) |
| Hundreds–thousands concurrent My Forms (Test C peak **4,000**) | **No** (measured, majority failures) |
| Exact “safe” concurrent My Forms ceiling (e.g. 150 vs 300) | **Not yet pinned** — requires stepped peaks (100 / 200 / 500) after optimisations; Test C mixed healthy early stages with failed peak into one average |

**Recommended wording for stakeholders:**

> *Under controlled load testing, the PMS portal on the current shared server handled moderate concurrent use well, but failed under a simulated peak of approximately 4,000 concurrent employees on My Forms (about three-quarters of requests failed). The limiting factors are shared infrastructure and single-process application design, not the business software features themselves.*

---

## 6. Business risk

| Risk | Impact |
|------|--------|
| Campus-wide “open appraisal forms now” spike | Portal timeouts/errors; support flood; incomplete submissions |
| HR working during employee peak | HR dashboard/overview also degrades (~40%+ failures in Test C) |
| Shared VM incident | Alumni / other portals can steal CPU/RAM during PMS peaks (and vice versa) |
| Misreading headcount as capacity | Planning for “4,000 users” without concurrency planning leads to outage-class events |

---

## 7. Recommendations

### 7.1 Immediate (operations — low cost)

1. **Keep unused PM2 apps stopped** (e.g. `edms`) and run `pm2 save` so they stay off after reboot.  
2. Stop any other unused portals (`cai-ping`, `ireb-system`, etc.) if business confirms.  
3. **Do not** schedule a single all-staff hit at one second; publish **staggered access windows** if a large campaign is imminent.  
4. Re-test with **stepped peaks** (`EMPLOYEE_PEAK=100, 200, 500`) to publish an exact safe concurrent number after changes.  
5. Investigate **`pms_uol` restart history** (`pm2 logs`) to rule out memory kills.

### 7.2 Short term (application / runtime — medium cost)

1. Run **2+ PMS Node instances** (PM2 cluster or dual port + nginx upstream) to use more than one CPU core.  
2. Explicitly configure PostgreSQL pool size per process (and keep **processes × pool ≪ 100** `max_connections`, leaving room for other apps).  
3. Add basic monitoring alerts: CPU, memory, Postgres connection count, nginx 5xx rate.  
4. Consider caching / lighter My Forms API payloads if profiling shows heavy queries.

### 7.3 Medium term (infrastructure — investment)

1. **Dedicated VM/host for PMS + its Postgres** (or managed DB), sized for expected **peak concurrent** users (not only headcount).  
2. Raise Postgres memory settings appropriately on a dedicated DB tier.  
3. Horizontal scale behind nginx/load balancer if concurrent targets remain in the thousands.

### 7.4 Target sizing (planning input)

Until stepped tests complete, use these **planning bands** (order-of-magnitude, current architecture):

| Concurrent My Forms users | Expectation on **current** shared host |
|---------------------------|----------------------------------------|
| Tens | Likely OK |
| Low hundreds | Needs verification; may need 2 app workers + pool tuning |
| Thousands simultaneous | **Not supported today** (proven at ~4,000) |

Exact SLA numbers should be updated after the 100/200/500 stepped campaign.

---

## 8. Remediation already started

| Action | Status |
|--------|--------|
| Identified shared-host contention | Complete |
| Load-tested production URL with employee + HR mix | Complete |
| Stopped unused `edms` to free resources | Done (confirm `pm2 save`) |
| Documented DB pool and single-process limits | Complete |

---

## 9. Appendix — key raw figures

### A. Server

- CPUs: **4**  
- RAM: **7.7 GiB**  
- Postgres `max_connections`: **100**  
- Postgres `shared_buffers`: **128 MB**  
- PMS: PM2 **fork**, port **3005**

### B. Test C (peak ~4,015 VUs) — headline numbers

- Requests: **589,259**  
- Failed: **76.08%**  
- Employee page 200: **22%**  
- Employee API 200: **25%**  
- HR page 200: **57%**  
- HR overview 200: **60%**  

### C. Test A (≤60 VUs, `/dashboard`)

- Success: **100%**  
- p95: **~39 ms**

---

## 10. Document control

| Field | Value |
|-------|--------|
| Prepared for | Management / IT leadership |
| System | UOL PMS (`pms_uol`) |
| Environment tested | Production URL on `alumniportal` |
| Classification | Internal — technical capacity assessment |

---

*This report is based on measured production-host configuration and authenticated k6 load tests. It does not estimate capacity by guesswork. Figures will improve only if infrastructure or concurrency architecture changes, or if peak concurrent demand is reduced through operational scheduling.*
