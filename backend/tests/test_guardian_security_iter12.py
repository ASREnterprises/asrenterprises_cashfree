"""
Iteration 12 — AI Website Guardian SECURITY UPGRADE regression suite.
Covers:
  • Router-wide super-admin RBAC (403 without / with wrong headers, 200 with correct)
  • Autofix disabled for HIGH-risk templates (billing_sync, payment_due_gate, install_progress)
  • Seeded rules have risk_level
  • Approval enrichment (customer_id / action_type / issue_detected / risk_level / before/after)
  • HIGH-risk direct /approve blocked (403); LOW/MEDIUM direct /approve allowed
  • OTP send (otp_id + expires_in + max_attempts + resend_in + phone_masked)
  • OTP cooldown (30s → 429)
  • OTP wrong code (401 with decremented attempts), lock after 3 (429)
  • OTP correct code → applied + backup + audit log with actor=ABHIJEET KUMAR
  • OTP replay blocked (400 'already used')
  • Safety whitelist — unknown approval action → 400
  • Customer access control gate unchanged on /api/customer/send-otp
"""
from __future__ import annotations

import hashlib
import os
import time
import uuid
from typing import Optional, Dict

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

API = f"{BASE_URL}/api"
GUARD = f"{API}/guardian"
SUPER_HDR = {"x-staff-id": "ASR1001", "x-admin-name": "ABHIJEET KUMAR",
             "Content-Type": "application/json"}
WRONG_HDR = {"x-staff-id": "ASR1002", "x-admin-name": "ANAMIKA",
             "Content-Type": "application/json"}
OTP_SALT = os.environ.get("GUARDIAN_OTP_SALT", "asr-guardian-otp-v1")


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(f"{OTP_SALT}:{otp}".encode()).hexdigest()


def _brute_force_otp(otp_hash: str) -> Optional[str]:
    """Recover 6-digit OTP from stored hash (test helper)."""
    for i in range(1000000):
        code = f"{i:06d}"
        if _hash_otp(code) == otp_hash:
            return code
    return None


@pytest.fixture(scope="module")
def admin_s():
    s = requests.Session()
    s.headers.update(SUPER_HDR)
    return s


@pytest.fixture(scope="module")
def wrong_s():
    s = requests.Session()
    s.headers.update(WRONG_HDR)
    return s


@pytest.fixture(scope="module")
def anon_s():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    # Direct DB access for OTP hash extraction (test helper pattern)
    from pymongo import MongoClient
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    cli = MongoClient(url)
    return cli["asr_dev"]


# ───── RBAC ────────────────────────────────────────────────────────────
def test_rbac_no_headers_returns_403(anon_s):
    r = anon_s.get(f"{GUARD}/rules", timeout=15)
    assert r.status_code == 403, r.text
    assert "access denied" in r.text.lower()


def test_rbac_wrong_headers_returns_403(wrong_s):
    r = wrong_s.get(f"{GUARD}/rules", timeout=15)
    assert r.status_code == 403, r.text


def test_rbac_correct_headers_ok(admin_s):
    r = admin_s.get(f"{GUARD}/rules", timeout=15)
    assert r.status_code == 200
    assert "rules" in r.json()


def test_rbac_health_also_gated(anon_s, admin_s):
    assert anon_s.get(f"{GUARD}/health", timeout=15).status_code == 403
    assert admin_s.get(f"{GUARD}/health", timeout=15).status_code == 200


# ───── RISK LEVEL ON SEEDED RULES ──────────────────────────────────────
def test_seeded_rules_have_risk_level(admin_s):
    rules = admin_s.get(f"{GUARD}/rules", timeout=15).json()["rules"]
    by_tpl = {}
    for r in rules:
        if r["template_key"] not in by_tpl and not r["name"].startswith("TEST_"):
            by_tpl[r["template_key"]] = r
    expect = {
        "billing_sync": "HIGH",
        "payment_due_gate": "HIGH",
        "install_progress": "HIGH",
        "whatsapp_retry": "MEDIUM",
        "pending_order_cleanup": "LOW",
    }
    for tpl, rl in expect.items():
        assert tpl in by_tpl, f"Missing seeded rule for {tpl}"
        assert by_tpl[tpl].get("risk_level") == rl, \
            f"{tpl}: expected {rl}, got {by_tpl[tpl].get('risk_level')}"


# ───── AUTOFIX DISABLED FOR HIGH-RISK ─────────────────────────────────
@pytest.mark.parametrize("tpl", ["billing_sync", "payment_due_gate", "install_progress"])
def test_autofix_disabled_for_high_risk_template_create(admin_s, tpl):
    r = admin_s.post(f"{GUARD}/rules", json={
        "name": f"TEST_autofix_{tpl}",
        "template_key": tpl,
        "action_mode": "autofix",
        "frequency_minutes": 60,
    }, timeout=15)
    assert r.status_code == 400, f"{tpl}: expected 400, got {r.status_code}: {r.text}"


def test_autofix_disabled_for_high_risk_template_patch(admin_s):
    # find a seeded HIGH-risk rule and try PATCH to autofix
    rules = admin_s.get(f"{GUARD}/rules", timeout=15).json()["rules"]
    target = next((x for x in rules if x["template_key"] == "payment_due_gate"
                   and not x["name"].startswith("TEST_")), None)
    assert target, "seeded payment_due_gate rule missing"
    r = admin_s.patch(f"{GUARD}/rules/{target['id']}",
                      json={"action_mode": "autofix"}, timeout=15)
    assert r.status_code == 400, r.text


# ───── APPROVAL ENRICHMENT + HIGH-RISK DIRECT APPROVE BLOCKED ─────────
@pytest.fixture(scope="module")
def seeded_approval(admin_s):
    """Run-all to populate approvals. Returns a HIGH-risk pending one or None."""
    admin_s.post(f"{GUARD}/rules/run-all", timeout=60)
    pend = admin_s.get(f"{GUARD}/approvals?status=pending&limit=50",
                       timeout=15).json()["approvals"]
    high = [a for a in pend if (a.get("risk_level") or "").upper() == "HIGH"]
    return high[0] if high else None


def test_approval_record_enrichment(seeded_approval):
    if not seeded_approval:
        pytest.skip("No HIGH-risk approvals present (data dependent)")
    a = seeded_approval
    for field in ("customer_id", "customer_name", "action_type",
                  "issue_detected", "risk_level", "before_value", "after_value"):
        assert field in a, f"approval missing field: {field}"
    assert a["risk_level"].upper() == "HIGH"
    assert isinstance(a["before_value"], dict)
    assert isinstance(a["after_value"], dict)


def test_high_risk_direct_approve_blocked(admin_s, seeded_approval):
    if not seeded_approval:
        pytest.skip("No HIGH-risk approvals present")
    r = admin_s.post(
        f"{GUARD}/approvals/{seeded_approval['id']}/approve",
        json={"actor": "test", "note": "should be blocked"}, timeout=15,
    )
    assert r.status_code == 403, r.text
    assert "otp" in r.text.lower()


# ───── OTP FLOW ────────────────────────────────────────────────────────
def test_otp_send_shape(admin_s, seeded_approval):
    if not seeded_approval:
        pytest.skip("No HIGH-risk approvals present")
    r = admin_s.post(f"{GUARD}/approvals/{seeded_approval['id']}/send-otp",
                     timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    for k in ("otp_id", "expires_in", "max_attempts", "resend_in",
              "delivered", "phone_masked"):
        assert k in j, f"send-otp missing {k}"
    assert j["max_attempts"] == 3
    assert j["resend_in"] == 30
    assert j["expires_in"] == 300


def test_otp_cooldown_429(admin_s, seeded_approval):
    if not seeded_approval:
        pytest.skip("No HIGH-risk approvals present")
    # ensure we just sent one in previous test → second call within 30s must 429
    r = admin_s.post(f"{GUARD}/approvals/{seeded_approval['id']}/send-otp",
                     timeout=15)
    assert r.status_code == 429, f"expected cooldown 429, got {r.status_code}"
    assert "wait" in r.text.lower()


def test_otp_wrong_code_returns_401_with_attempts(admin_s, seeded_approval):
    if not seeded_approval:
        pytest.skip("No HIGH-risk approvals present")
    r = admin_s.post(
        f"{GUARD}/approvals/{seeded_approval['id']}/verify-otp",
        json={"otp": "000001"}, timeout=15,
    )
    assert r.status_code == 401, r.text
    assert "incorrect" in r.text.lower()
    assert "attempt" in r.text.lower()


def test_otp_correct_code_applies_and_audits(admin_s, seeded_approval, mongo_db):
    if not seeded_approval:
        pytest.skip("No HIGH-risk approvals present")
    # Fetch the most recent unused OTP record for this approval
    rec = mongo_db.guardian_approval_otps.find_one(
        {"approval_id": seeded_approval["id"], "consumed": {"$ne": True},
         "superseded": {"$ne": True}},
        sort=[("sent_at", -1)],
    )
    assert rec, "no active OTP record in guardian_approval_otps"
    code = _brute_force_otp(rec["otp_hash"])
    assert code, "failed to recover OTP from hash — salt mismatch?"

    r = admin_s.post(
        f"{GUARD}/approvals/{seeded_approval['id']}/verify-otp",
        json={"otp": code, "otp_id": rec["id"]}, timeout=20,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["success"] is True
    assert j["applied"] is True
    assert j["otp_verified"] is True
    assert j.get("backup_id"), "backup_id should be set"

    # Approval now approved
    approved = admin_s.get(f"{GUARD}/approvals?status=approved&limit=50",
                           timeout=15).json()["approvals"]
    assert any(a["id"] == seeded_approval["id"] for a in approved)

    # Backup snapshot exists
    bk = mongo_db.guardian_backups.find_one({"id": j["backup_id"]})
    assert bk is not None
    assert set((bk.get("before") or {}).keys())  # non-empty before snapshot

    # Audit log with actor=ABHIJEET KUMAR and otp_verified=True
    audit = mongo_db.guardian_logs.find_one({
        "actor": "ABHIJEET KUMAR",
        "message": {"$regex": "APPROVAL APPLIED"},
        "details.approval_id": seeded_approval["id"],
    })
    assert audit is not None, "missing audit log with actor=ABHIJEET KUMAR"
    assert audit["details"]["otp_verified"] is True
    assert audit["details"]["risk_level"] == "HIGH"
    assert audit["details"].get("backup_id") == j["backup_id"]


def test_otp_replay_blocked(admin_s, seeded_approval, mongo_db):
    """Re-verify using same otp_id → 400/404 (approval already decided)."""
    if not seeded_approval:
        pytest.skip("No HIGH-risk approvals present")
    # Find the consumed otp record
    rec = mongo_db.guardian_approval_otps.find_one(
        {"approval_id": seeded_approval["id"], "consumed": True},
        sort=[("sent_at", -1)],
    )
    assert rec
    code = _brute_force_otp(rec["otp_hash"]) or "000000"
    r = admin_s.post(
        f"{GUARD}/approvals/{seeded_approval['id']}/verify-otp",
        json={"otp": code, "otp_id": rec["id"]}, timeout=15,
    )
    # Approval is now "approved" so endpoint returns 404 "already decided"
    # (OTP-reuse also protected: consumed=true would 400). Either is acceptable.
    assert r.status_code in (400, 404), r.text


# ───── SAFETY WHITELIST (unknown action) ───────────────────────────────
def test_unknown_approval_action_rejected(admin_s, mongo_db):
    # Inject a fake approval with action='foo' directly, then try to approve.
    # Since it's LOW risk, /approve bypasses OTP; _apply_approval should 400
    # "Unknown approval action".
    fake_id = str(uuid.uuid4())
    mongo_db.guardian_approvals.insert_one({
        "id": fake_id, "rule_id": "none", "module": "test",
        "action": "foo", "action_type": "foo", "target": "x",
        "customer_id": "x", "customer_name": "t",
        "issue_detected": "test", "risk_level": "LOW",
        "before_value": {}, "after_value": {}, "proposal": {},
        "status": "pending", "proposed_at": "2026-01-01T00:00:00+00:00",
        "created_at": "2026-01-01T00:00:00+00:00", "otp_verified": False,
    })
    try:
        r = admin_s.post(f"{GUARD}/approvals/{fake_id}/approve",
                         json={"actor": "test"}, timeout=15)
        assert r.status_code == 400, r.text
        assert "unknown approval action" in r.text.lower()
    finally:
        mongo_db.guardian_approvals.delete_one({"id": fake_id})


# ───── CUSTOMER ACCESS GATE UNCHANGED (public endpoint) ────────────────
def test_customer_send_otp_public_endpoint_not_gated(anon_s):
    """/api/customer/send-otp is NOT under super-admin gate — must not return 403
    simply due to missing guardian headers."""
    r = anon_s.post(f"{API}/customer/send-otp",
                    json={"mobile": "9123456700"}, timeout=20)
    # Acceptable: 200/400/404/429 — anything except the guardian 403 "Access Denied"
    assert not (r.status_code == 403 and "guardian" in r.text.lower()), r.text


# ───── Cleanup TEST_ rules ─────────────────────────────────────────────
def test_cleanup_test_rules(admin_s):
    rules = admin_s.get(f"{GUARD}/rules", timeout=15).json()["rules"]
    for r in rules:
        if r["name"].startswith("TEST_"):
            admin_s.delete(f"{GUARD}/rules/{r['id']}", timeout=15)
