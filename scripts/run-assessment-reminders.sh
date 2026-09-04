#!/usr/bin/env bash
# Daily PMS assessment reminder cron runner.
#
# Matches the UOL cron style used by other services:
#   APP_BASE_URL=... CRON_SECRET=... ./run-assessment-reminders.sh
#
# Crontab example (09:00 daily):
#   0 9 * * * APP_BASE_URL="http://localhost:3005" CRON_SECRET="your-secret" /root/pms_uol/scripts/run-assessment-reminders.sh >> /var/log/pms-assessment-reminders.log 2>&1
#
# Requirements:
# - PMS Next.js app must be running and reachable at APP_BASE_URL
# - CRON_SECRET must match the CRON_SECRET env var configured for the PMS process
# - /api/cron/* must be excluded from NextAuth middleware (see middleware.ts)

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RESPONSE_FILE="${TMPDIR:-/tmp}/pms-assessment-reminders-response.$$"

cleanup() {
  rm -f "${RESPONSE_FILE}"
}
trap cleanup EXIT

if [[ -z "${APP_BASE_URL:-}" ]]; then
  echo "[$TS] [$SCRIPT_NAME] ERROR: APP_BASE_URL is not set." >&2
  exit 1
fi

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "[$TS] [$SCRIPT_NAME] ERROR: CRON_SECRET is not set." >&2
  exit 1
fi

# Trim trailing slash from base URL
BASE_URL="${APP_BASE_URL%/}"
ENDPOINT="${BASE_URL}/api/cron/assessment-reminders"

echo "[$TS] [$SCRIPT_NAME] POST ${ENDPOINT}"

# Do not follow redirects: a 307 to /api/auth/signin must fail loudly.
HTTP_CODE="$(
  curl -sS -o "${RESPONSE_FILE}" -w "%{http_code}" \
    --path-as-is \
    -X POST "${ENDPOINT}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Accept: application/json" \
    --connect-timeout 30 \
    --max-time 300
)"

BODY="$(cat "${RESPONSE_FILE}" 2>/dev/null || true)"
echo "[$TS] [$SCRIPT_NAME] HTTP ${HTTP_CODE} ${BODY}"

if [[ "${HTTP_CODE}" == "307" || "${HTTP_CODE}" == "302" || "${HTTP_CODE}" == "301" ]]; then
  echo "[$TS] [$SCRIPT_NAME] FAILED — redirected (auth middleware?). Deploy middleware that excludes /api/cron/*." >&2
  exit 1
fi

if [[ "${HTTP_CODE}" == "401" ]]; then
  echo "[$TS] [$SCRIPT_NAME] FAILED — unauthorized. Ensure CRON_SECRET matches the PMS process env." >&2
  exit 1
fi

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "[$TS] [$SCRIPT_NAME] FAILED — expected HTTP 200." >&2
  exit 1
fi

echo "[$TS] [$SCRIPT_NAME] OK"
