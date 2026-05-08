#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3001}"
ADMIN_API_KEY="${ADMIN_API_KEY:?Set ADMIN_API_KEY first}"
TENANT_ID="${TENANT_ID:-tenant_example}"

echo "Provisioning operator agent..."
PROVISION_JSON="$(
  curl -fsS "$API_URL/api/agents/provision" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Key: $ADMIN_API_KEY" \
    -d "{
      \"tenantId\": \"$TENANT_ID\",
      \"name\": \"Example Operator Agent\",
      \"role\": \"operator\",
      \"type\": \"supervised\"
    }"
)"

TOKEN="$(printf '%s' "$PROVISION_JSON" | node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(data.token)")"

echo "Creating contact..."
curl -fsS "$API_URL/api/contacts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"firstName\": \"Taylor\",
    \"lastName\": \"Example\",
    \"email\": \"taylor@example.com\",
    \"title\": \"Revenue Ops\"
  }"

echo
echo "Done."
