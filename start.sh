#!/bin/sh
# Container entrypoint. PORT is provided by Cloud Run / Render / Railway / Heroku (default 8080).
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8080}" --proxy-headers --forwarded-allow-ips="*"
