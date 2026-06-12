# Tiny cron pinger for /api/cron/wc-remind — runs on Railway with
# deploy.cronSchedule (see railway.json). GitHub Actions' free-tier schedule
# proved to skip/delay runs by hours; Railway cron is the reliable primary,
# the GH workflow stays as a free redundant backstop (the endpoint's
# wc_push_log dedup makes double-triggers harmless).
FROM curlimages/curl:8.14.1
# CRON_SECRET comes from Railway service variables.
CMD curl -fsS --max-time 110 -H "Authorization: Bearer ${CRON_SECRET}" "https://www.pre-daily.com/api/cron/wc-remind"
