#!/usr/bin/env bash
# Prints the Worker's workers.dev URL. Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
set -euo pipefail
name=$(grep -m1 '^name' worker/wrangler.toml | sed -E 's/.*"(.*)".*/\1/')
sub=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" | jq -r '.result.subdomain')
if [ -z "$sub" ] || [ "$sub" = "null" ]; then
  echo "::error::This Cloudflare account has no workers.dev subdomain yet. Open Workers & Pages in the dashboard once to create it." >&2
  exit 1
fi
echo "https://$name.$sub.workers.dev"
