#!/usr/bin/env bash
set -Eeuo pipefail

: "${SMOKE_BASE_URL:?Defina SMOKE_BASE_URL}"
: "${SMOKE_ENV:?Defina SMOKE_ENV (staging, canary ou production-test)}"
[[ "${SMOKE_ALLOW_MUTATIONS:-}" == 1 ]] || { echo 'Refusing to run: set SMOKE_ALLOW_MUTATIONS=1 explicitly.' >&2; exit 2; }
[[ "$SMOKE_ENV" != production || "${SMOKE_ALLOW_PRODUCTION:-}" == 1 ]] || { echo 'Refusing to run against production without SMOKE_ALLOW_PRODUCTION=1.' >&2; exit 2; }
command -v curl >/dev/null || { echo 'curl is required' >&2; exit 2; }
command -v jq >/dev/null || { echo 'jq is required' >&2; exit 2; }

base="${SMOKE_BASE_URL%/}"
work="$(mktemp -d "${TMPDIR:-/tmp}/aloca-smoke.XXXXXX")"
trap 'rm -rf -- "$work"' EXIT
jar1="$work/a.cookies"; jar2="$work/b.cookies"
today="$(date -u +%F)"; stamp="$(date -u +%Y%m%d%H%M%S)"; email1="smoke_a_$stamp@example.com"; pass='SmokeTest-9x!'
fail() { echo "FAIL: $*" >&2; exit 1; }
check() { [[ "$1" == "$2" ]] || fail "$3 (expected $2, got $1)"; }

request() {
  local jar="$1" method="$2" path="$3" body="${4-}" out="$work/response.json" code
  local args=(--silent --show-error --output "$out" --write-out '%{http_code}' --dump-header "$work/headers" --cookie "$jar" --cookie-jar "$jar" -X "$method" -H 'Accept: application/json')
  [[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' --data "$body")
  code="$(curl "${args[@]}" "$base$path")" || fail "curl failed for $method $path"
  RESPONSE="$(cat "$out")"; RESPONSE_CODE="$code"
}
mutate() { request "$1" "$2" "$3" "${4-}"; }
expect_json() { check "$RESPONSE_CODE" "$1" "$2"; jq -e . >/dev/null <<<"$RESPONSE" || fail "$2 returned invalid JSON"; }

echo "Smoke test: $base ($SMOKE_ENV)"
code="$(curl --silent --show-error --output "$work/health" --write-out '%{http_code}' "$base/health")" || fail 'curl failed for /health'
check "$code" 200 '/health'; grep -qi 'healthy\|"status"[[:space:]]*:[[:space:]]*"Healthy"' "$work/health" || fail '/health is not healthy'
[[ "${base%%:*}" == https ]] || fail 'SMOKE_BASE_URL must use HTTPS'
http_base="${SMOKE_HTTP_BASE_URL:-http://${base#https://}}"; http_base="${http_base%/}"
redirect_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --head "$http_base/health")" || fail 'curl failed for HTTP redirect'
[[ "$redirect_code" == 301 || "$redirect_code" == 308 ]] || fail "HTTP to HTTPS redirect expected (got $redirect_code)"
curl --silent --show-error --head "$base/health" >"$work/head" || fail 'curl failed for HTTPS headers'
for h in strict-transport-security x-content-type-options referrer-policy permissions-policy content-security-policy x-frame-options; do grep -qi "^$h:" "$work/head" || fail "missing security header: $h"; done

mutate "$jar1" POST /api/account/local "$(jq -nc --arg n "Smoke A $stamp" '{displayName:$n}')"; expect_json 200 'create account A'
mutate "$jar1" POST /api/account/protect "$(jq -nc --arg e "$email1" --arg p "$pass" '{displayName:"Smoke A",email:$e,password:$p,confirmPassword:$p}')"; expect_json 200 'protect account A'
grep -q 'aloca.auth' "$jar1" || fail 'auth cookie missing'; grep -q 'aloca.device' "$jar1" || fail 'device cookie missing'
mutate "$jar1" POST /api/account/logout '{}'; check "$RESPONSE_CODE" 204 'logout'
request "$jar1" GET /api/categories; check "$RESPONSE_CODE" 401 'logout invalidates session'
mutate "$jar1" POST /api/account/login "$(jq -nc --arg e "$email1" --arg p "$pass" '{email:$e,password:$p}')"; expect_json 200 'login'
mutate "$jar1" POST /api/categories '{"name":"Smoke group"}'; expect_json 201 'create group'; category="$(jq -r .id <<<"$RESPONSE")"
mutate "$jar1" PUT "/api/categories/$category" '{"name":"Smoke group updated"}'; expect_json 200 'update group'
mutate "$jar1" POST /api/transactions "$(jq -nc --arg c "$category" --arg d "$today" '{description:"Smoke income",amount:100,type:"Income",date:$d,categoryId:$c}')"; expect_json 201 'income'
mutate "$jar1" POST /api/transactions "$(jq -nc --arg c "$category" --arg d "$today" '{description:"Smoke expense",amount:10,type:"Expense",date:$d,categoryId:$c}')"; expect_json 201 'expense'
commitment_body="$(jq -nc --arg d "$today" '{name:"Smoke commitment",installmentAmount:20,totalInstallments:1,priority:1,isFullyCommitted:false,dueDate:$d,objective:"smoke",automaticProcessing:true}')"
mutate "$jar1" POST /api/financial-commitments "$commitment_body"; expect_json 201 'commitment'; commitment="$(jq -r .id <<<"$RESPONSE")"
mutate "$jar1" POST "/api/financial-commitments/$commitment/allocations" '{"amount":20}'; expect_json 200 'allocation'
mutate "$jar1" POST "/api/financial-commitments/$commitment/payments"; expect_json 200 'payment'
mutate "$jar1" DELETE "/api/financial-commitments/$commitment/payments/latest"; expect_json 200 'payment reversal'
mutate "$jar1" DELETE "/api/financial-commitments/$commitment/allocations"; expect_json 200 'allocation reversal'
mutate "$jar1" POST /api/recurring-incomes "$(jq -nc --arg d "$today" --arg c "$category" '{description:"Smoke recurring",amount:7,frequency:"Monthly",startDate:$d,dayOfMonth:1,categoryId:$c,automaticProcessing:true}')"; expect_json 200 'recurrence'
recurring="$(jq -r .id <<<"$RESPONSE")"; occurrence="$(jq -r '.occurrences[0].id // empty' <<<"$RESPONSE")"; [[ -n "$occurrence" ]] || fail 'recurrence has no occurrence'
mutate "$jar1" POST "/api/recurring-incomes/occurrences/$occurrence/receive"; expect_json 200 'receive'; transaction1="$(jq -r .transactionId <<<"$RESPONSE")"
mutate "$jar1" POST "/api/recurring-incomes/occurrences/$occurrence/receive"; expect_json 200 'idempotent receive'; check "$(jq -r .transactionId <<<"$RESPONSE")" "$transaction1" 'duplicate receipt'
mutate "$jar1" POST "/api/recurring-incomes/$recurring/pause"; check "$RESPONSE_CODE" 204 'pause'; mutate "$jar1" POST "/api/recurring-incomes/$recurring/activate"; check "$RESPONSE_CODE" 204 'reactivation'
mutate "$jar2" POST /api/account/local "$(jq -nc '{displayName:"Smoke B"}')"; expect_json 200 'create account B'
request "$jar2" GET /api/categories; check "$RESPONSE_CODE" 200 'account B groups'; [[ "$(jq 'length' <<<"$RESPONSE")" == 0 ]] || fail 'group isolation'
request "$jar2" GET '/api/transactions?search=Smoke'; check "$RESPONSE_CODE" 200 'account B transactions'; [[ "$(jq '.items|length' <<<"$RESPONSE")" == 0 ]] || fail 'transaction isolation'
mutate "$jar2" POST /api/account/logout '{}'; check "$RESPONSE_CODE" 204 'logout B'; request "$jar1" GET /api/financial-commitments; check "$RESPONSE_CODE" 200 'automatic processing readback'
echo 'PASS: health/PostgreSQL, HTTP redirect/HTTPS headers, account/login/logout/session, cookies, isolation, groups, income/expense, commitment, allocation/payment/reversal, recurrence/idempotent receipt, pause/reactivation and automatic-processing configuration'
