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

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

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

HTTP_CODE="$(
  curl -fsS -o /tmp/pms-assessment-reminders-response.json -w "%{http_code}" \
    -X POST "${ENDPOINT}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Accept: application/json" \
    --connect-timeout 30 \
    --max-time 300
)"

BODY="$(cat /tmp/pms-assessment-reminders-response.json 2>/dev/null || true)"
echo "[$TS] [$SCRIPT_NAME] HTTP ${HTTP_CODE} ${BODY}"

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "[$TS] [$SCRIPT_NAME] FAILED — expected HTTP 200." >&2
  exit 1
fi

echo "[$TS] [$SCRIPT_NAME] OK"
