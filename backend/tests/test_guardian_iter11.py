"""
Regression + edge-case suite for AI Website Guardian (iteration 11).
Covers /api/guardian/* endpoints:
  • Templates list, seeded defaults, rule CRUD + validation
  • Run rule + run-all + disabled-rule skip
  • Backups whitelist enforcement, backup restore
  • Approval flow: queue → approve (create_invoice_for_customer) → reject
  • Customer access control gate via /customer/send-otp (internal admin OTP)
  • Command console: preview/execute, unknown command, catalog commands
  • Logs filtering and health endpoint
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    # fallback (frontend/.env)
    "https://asrenterprise-pay.preview.emergentagent.com",
).rstrip("/")

API = f"{BASE_URL}/api"
GUARD = f"{API}/guardian"
TEST_PHONE = "9123456700"
EXPECTED_TEMPLATE_KEYS = {
    "billing_sync", "payment_due_gate", "install_progress",
    "whatsapp_retry", "pending_order_cleanup",
}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ──────────────────────────────────────────────────────────────────────
#  TEMPLATES + SEEDED RULES
# ──────────────────────────────────────────────────────────────────────
def test_templates_list(s):
    r = s.get(f"{GUARD}/rules/templates", timeout=15)
    assert r.status_code == 200
    tpls = r.json()["templates"]
    keys = {t["key"] for t in tpls}
    assert keys == EXPECTED_TEMPLATE_KEYS, f"Got {keys}"
    # supports_modes sanity
    by_key = {t["key"]: t for t in tpls}
    assert by_key["pending_order_cleanup"]["supports_modes"] == ["alert"]
    assert "autofix" in by_key["payment_due_gate"]["supports_modes"]
    assert "approval" in by_key["billing_sync"]["supports_modes"]


def test_seeded_rules_present_and_idempotent(s):
    r = s.get(f"{GUARD}/rules", timeout=15)
    assert r.status_code == 200
    rules = r.json()["rules"]
    # At least the 5 seeded default rules are there (plus any TEST_ we may have created)
    seeded = [x for x in rules if x["template_key"] in EXPECTED_TEMPLATE_KEYS and not x["name"].startswith("TEST_")]
    tks = {x["template_key"] for x in seeded}
    assert tks == EXPECTED_TEMPLATE_KEYS, f"Expected all 5 seeded template keys, got {tks}"


# ──────────────────────────────────────────────────────────────────────
#  RULE CRUD + VALIDATION
# ──────────────────────────────────────────────────────────────────────
def test_create_rule_invalid_mode_for_template_returns_400(s):
    # pending_order_cleanup only supports ["alert"] — autofix must 400
    r = s.post(f"{GUARD}/rules", json={
        "name": "TEST_bad_mode",
        "template_key": "pending_order_cleanup",
        "action_mode": "autofix",
        "frequency_minutes": 60,
    }, timeout=15)
    assert r.status_code == 400, r.text


def test_create_rule_invalid_template_key_returns_400(s):
    r = s.post(f"{GUARD}/rules", json={
        "name": "TEST_bad_tpl",
        "template_key": "does_not_exist",
        "action_mode": "alert",
        "frequency_minutes": 60,
    }, timeout=15)
    assert r.status_code == 400, r.text


def test_create_rule_invalid_frequency_returns_400_or_422(s):
    # Pydantic Field(ge=5, le=10080) returns 422; we accept either.
    for freq in (1, 99999):
        r = s.post(f"{GUARD}/rules", json={
            "name": f"TEST_bad_freq_{freq}",
            "template_key": "whatsapp_retry",
            "action_mode": "alert",
            "frequency_minutes": freq,
        }, timeout=15)
        assert r.status_code in (400, 422), f"freq={freq} got {r.status_code}: {r.text}"


def test_rule_crud_and_patch_enabled_skips_run_all(s):
    # Create
    name = f"TEST_{uuid.uuid4().hex[:8]}"
    r = s.post(f"{GUARD}/rules", json={
        "name": name, "template_key": "whatsapp_retry",
        "action_mode": "alert", "frequency_minutes": 60,
    }, timeout=15)
    assert r.status_code == 200, r.text
    rule = r.json()["rule"]
    rid = rule["id"]
    assert rule["enabled"] is True

    # Run it directly
    rr = s.post(f"{GUARD}/rules/{rid}/run", timeout=30)
    assert rr.status_code == 200
    body = rr.json()
    assert "issue_count" in body

    # PATCH toggle enabled=false + frequency
    p = s.patch(f"{GUARD}/rules/{rid}", json={"enabled": False, "frequency_minutes": 120}, timeout=15)
    assert p.status_code == 200
    assert p.json()["rule"]["enabled"] is False
    assert p.json()["rule"]["frequency_minutes"] == 120

    # Invalid freq via PATCH → 400
    pbad = s.patch(f"{GUARD}/rules/{rid}", json={"frequency_minutes": 2}, timeout=15)
    assert pbad.status_code == 400

    # Invalid mode for template via PATCH → 400
    pbadmode = s.patch(f"{GUARD}/rules/{rid}", json={"action_mode": "autofix"}, timeout=15)
    assert pbadmode.status_code == 400

    # run-all should skip disabled
    ra = s.post(f"{GUARD}/rules/run-all", timeout=60)
    assert ra.status_code == 200
    ran_ids = {res.get("rule_id") for res in ra.json().get("results", [])}
    assert rid not in ran_ids, "Disabled rule should be skipped by run-all"

    # DELETE
    d = s.delete(f"{GUARD}/rules/{rid}", timeout=15)
    assert d.status_code == 200
    # Second delete → 404
    d2 = s.delete(f"{GUARD}/rules/{rid}", timeout=15)
    assert d2.status_code == 404


# ──────────────────────────────────────────────────────────────────────
#  APPROVAL FLOW — create → approve + reject
# ──────────────────────────────────────────────────────────────────────
def _find_rule_by_template(s, tpl_key):
    rs = s.get(f"{GUARD}/rules", timeout=15).json()["rules"]
    for r in rs:
        if r["template_key"] == tpl_key and not r["name"].startswith("TEST_"):
            return r
    return None


def test_approval_flow_billing_sync(s):
    # Create a billing_sync rule in approval mode
    name = f"TEST_approval_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{GUARD}/rules", json={
        "name": name, "template_key": "billing_sync",
        "action_mode": "approval", "frequency_minutes": 60,
    }, timeout=15)
    assert r.status_code == 200
    rid = r.json()["rule"]["id"]

    # Run the rule
    rr = s.post(f"{GUARD}/rules/{rid}/run", timeout=60)
    assert rr.status_code == 200
    body = rr.json()
    approvals_created = body.get("approvals_created", 0)

    # Fetch pending approvals for this rule
    pend = s.get(f"{GUARD}/approvals?status=pending", timeout=15).json()["approvals"]
    mine = [a for a in pend if a.get("rule_id") == rid]

    if approvals_created == 0 or not mine:
        # No orphan customers — approve flow cannot be exercised on real data.
        pytest.skip("No billing mismatches present; approval queue empty.")

    # Approve the first one (create_invoice_for_customer → sets needs_invoice_flag)
    ap = mine[0]
    appr = s.post(
        f"{GUARD}/approvals/{ap['id']}/approve",
        json={"actor": "test_admin", "note": "regression test"}, timeout=15,
    )
    assert appr.status_code == 200, appr.text
    assert appr.json()["applied"] is True

    # Approval must now be "approved"
    any_pend = s.get(f"{GUARD}/approvals?status=approved", timeout=15).json()["approvals"]
    assert any(a["id"] == ap["id"] for a in any_pend)

    # Reject path: find another pending one if present, else create & reject a block-customer style approval
    pend2 = s.get(f"{GUARD}/approvals?status=pending", timeout=15).json()["approvals"]
    mine2 = [a for a in pend2 if a.get("rule_id") == rid]
    if mine2:
        rej = s.post(f"{GUARD}/approvals/{mine2[0]['id']}/reject",
                     json={"actor": "test_admin", "note": "nope"}, timeout=15)
        assert rej.status_code == 200
        listed = s.get(f"{GUARD}/approvals?status=rejected", timeout=15).json()["approvals"]
        assert any(a["id"] == mine2[0]["id"] for a in listed)

    # Double-approve returns 404
    dbl = s.post(f"{GUARD}/approvals/{ap['id']}/approve", json={"actor": "test"}, timeout=15)
    assert dbl.status_code == 404

    # Cleanup
    s.delete(f"{GUARD}/rules/{rid}")


# ──────────────────────────────────────────────────────────────────────
#  BACKUPS — create via console → restore
# ──────────────────────────────────────────────────────────────────────
def test_backup_created_and_restored_via_console(s):
    # Use command console to flip 9123456700 → ensure clean starting state
    pre = s.get(f"{GUARD}/customers/{TEST_PHONE}/status").json()
    # Block → backup created
    ex = s.post(f"{GUARD}/command/execute",
                json={"command": f"block customer {TEST_PHONE}", "actor": "t"}, timeout=20)
    assert ex.status_code == 200
    exj = ex.json()
    assert exj["success"] is True
    bid = exj["backup_id"]
    assert bid

    # Status should be inactive
    after = s.get(f"{GUARD}/customers/{TEST_PHONE}/status").json()
    assert after["status"] == "inactive"
    assert after["allowed"] is False

    # send-otp should 403
    r403 = s.post(f"{API}/customer/send-otp", json={"mobile": TEST_PHONE}, timeout=15)
    assert r403.status_code == 403, r403.text
    assert "deactivated" in r403.json().get("detail", "").lower() or \
           "deactivated" in r403.text.lower()

    # Unknown phone → 404 via send-otp gate
    unk = s.post(f"{API}/customer/send-otp", json={"mobile": "9000000001"}, timeout=15)
    assert unk.status_code == 404, unk.text

    # Restore via backup
    res = s.post(f"{GUARD}/backups/{bid}/restore", json={"actor": "test"}, timeout=15)
    assert res.status_code == 200, res.text
    assert "customer_status" in res.json()["restored_fields"]

    # Second restore of same backup → 400
    res2 = s.post(f"{GUARD}/backups/{bid}/restore", json={"actor": "test"}, timeout=15)
    assert res2.status_code == 400

    # Final state must match pre-state (active by default)
    final = s.get(f"{GUARD}/customers/{TEST_PHONE}/status").json()
    assert final["status"] == pre.get("status", "active")


def test_backup_whitelist_only_contains_allowed_fields(s):
    # Each backup's before/after keys must be in AUTOFIX_ALLOWED_WRITES set
    ALLOWED = {
        "customer_status", "due_amount", "pay_button_force",
        "install_progress", "install_status", "pay_now_enabled",
        "payment_status_synced_at", "stale_flagged_at",
    }
    HARD_BLOCKED = {"password", "otp_hash", "mobile", "phone", "email",
                    "total_cost", "grand_total", "invoice_number"}
    rows = s.get(f"{GUARD}/backups?limit=50", timeout=15).json()["backups"]
    for b in rows:
        before_keys = set((b.get("before") or {}).keys())
        after_keys = set((b.get("after") or {}).keys())
        assert before_keys.issubset(ALLOWED), f"Non-whitelisted fields in backup before: {before_keys - ALLOWED}"
        assert after_keys.issubset(ALLOWED), f"Non-whitelisted fields in backup after: {after_keys - ALLOWED}"
        assert not (before_keys & HARD_BLOCKED)
        assert not (after_keys & HARD_BLOCKED)


# ──────────────────────────────────────────────────────────────────────
#  COMMAND CONSOLE — preview + catalog
# ──────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("cmd,expected_kind", [
    ("block customer 9123456700", "block_customer"),
    ("activate customer 9123456700", "activate_customer"),
    ("mark payment_due 9123456700", "flag_payment_due"),
    ("run billing sync", "run_billing_sync"),
    ("show health", "show_health"),
    ("show issues", "show_issues"),
    ("show approvals", "show_approvals"),
])
def test_command_preview_catalog(s, cmd, expected_kind):
    r = s.post(f"{GUARD}/command/preview", json={"command": cmd}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["parsed"]["kind"] == expected_kind, f"cmd={cmd!r} got {j}"
    assert "preview" in j and "summary" in j["preview"]


def test_command_execute_unknown_safe(s):
    r = s.post(f"{GUARD}/command/execute", json={"command": "xyzzy please hack the mainframe"}, timeout=15)
    assert r.status_code == 200  # never 500
    j = r.json()
    assert j["success"] is False
    assert "error" in j


def test_command_execute_show_health(s):
    r = s.post(f"{GUARD}/command/execute", json={"command": "show health"}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["success"] is True
    assert "health" in j and j["health"].get("status") in ("good", "warning", "critical")


def test_command_execute_block_unknown_phone(s):
    r = s.post(f"{GUARD}/command/execute",
               json={"command": "block customer 9000000002"}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["success"] is False
    assert "No customer" in j.get("error", "")


# ──────────────────────────────────────────────────────────────────────
#  LOGS + HEALTH
# ──────────────────────────────────────────────────────────────────────
def test_logs_filter_by_module(s):
    r = s.get(f"{GUARD}/logs?limit=50", timeout=15)
    assert r.status_code == 200
    logs = r.json()["logs"]
    assert isinstance(logs, list) and len(logs) > 0
    for row in logs:
        assert "level" in row and "module" in row and "message" in row

    # Filter by module
    r2 = s.get(f"{GUARD}/logs?module=payment&limit=20", timeout=15)
    assert r2.status_code == 200
    for row in r2.json()["logs"]:
        assert row["module"] == "payment"

    # Filter by level
    r3 = s.get(f"{GUARD}/logs?level=info&limit=20", timeout=15)
    assert r3.status_code == 200
    for row in r3.json()["logs"]:
        assert row["level"] == "info"


def test_health_structure(s):
    r = s.get(f"{GUARD}/health", timeout=15)
    assert r.status_code == 200
    j = r.json()
    for k in ("status", "errors_24h", "warns_24h", "pending_approvals",
              "rules_total", "rules_enabled", "checked_at"):
        assert k in j
    assert j["status"] in ("good", "warning", "critical")


def test_summary_endpoint(s):
    r = s.get(f"{GUARD}/summary", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "health" in j and "recent_logs" in j and "pending_approvals" in j


# ──────────────────────────────────────────────────────────────────────
#  CUSTOMER STATUS TOGGLE + OTP GATE
# ──────────────────────────────────────────────────────────────────────
def test_set_status_endpoint_toggles_and_restores(s):
    # inactive → send-otp blocked
    r = s.post(f"{GUARD}/customers/{TEST_PHONE}/status",
               json={"status": "inactive", "actor": "test"}, timeout=15)
    assert r.status_code == 200
    otp = s.post(f"{API}/customer/send-otp", json={"mobile": TEST_PHONE}, timeout=15)
    assert otp.status_code == 403

    # invalid status → 400
    bad = s.post(f"{GUARD}/customers/{TEST_PHONE}/status", json={"status": "wibble"}, timeout=15)
    assert bad.status_code == 400

    # unknown phone → 404
    unk = s.post(f"{GUARD}/customers/9000000003/status", json={"status": "active"}, timeout=15)
    assert unk.status_code == 404

    # active → send-otp moves past gate (allowed to fail at OTP delivery, must NOT be 403)
    r2 = s.post(f"{GUARD}/customers/{TEST_PHONE}/status", json={"status": "active"}, timeout=15)
    assert r2.status_code == 200
    otp2 = s.post(f"{API}/customer/send-otp", json={"mobile": TEST_PHONE}, timeout=20)
    assert otp2.status_code != 403, f"Expected gate-open, got {otp2.status_code}: {otp2.text}"
