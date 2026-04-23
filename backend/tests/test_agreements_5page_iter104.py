"""
Iter 9 regression tests for /app/backend/routes/agreements.py 5-page template.

Validates:
  - Every generated agreement PDF has EXACTLY 5 pages
  - Page 1..5 content (Annexure 2, Between/And, Whereas, Site Survey,
    items 9-15, Disclaimer)
  - Running header on every page
  - Stamp overlay caption on pages 1, 2, 3, 5 (not page 4)
  - Self-heal after wiping /app/backend/agreements/
  - New PMSG quotation auto-triggers an agreement with same template
  - Trash delete + WhatsApp send endpoint doesn't regress
"""
import os
import re
import glob
import time
import uuid
from io import BytesIO
from pathlib import Path

import pytest
import requests
from PyPDF2 import PdfReader

def _load_backend_url():
    u = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if u:
        return u.rstrip("/")
    # fallback: read from /app/frontend/.env
    envp = Path("/app/frontend/.env")
    if envp.exists():
        for line in envp.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    return ""

BASE_URL = _load_backend_url()
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api"
AGREEMENT_DIR = Path("/app/backend/agreements")

HEADER_L = "Guidelines for PM-Surya Ghar"
HEADER_R = "Central Financial Assistance to Residential Consumers"
STAMP_CAPTION = "Authorised Signatory"


# -------- helpers --------
def _fetch_pdf(agreement_id):
    r = requests.get(f"{API}/agreements/{agreement_id}/pdf", timeout=60)
    assert r.status_code == 200, f"/pdf returned {r.status_code} for {agreement_id}: {r.text[:200]}"
    assert r.content[:4] == b"%PDF", "response is not a PDF"
    return r.content


def _pages_text(pdf_bytes):
    reader = PdfReader(BytesIO(pdf_bytes))
    return [p.extract_text() or "" for p in reader.pages]


def _list_all_agreements(limit=100):
    r = requests.get(f"{API}/agreements", params={"limit": limit}, timeout=30)
    assert r.status_code == 200, r.text[:200]
    return r.json().get("agreements", [])


# -------- fixtures --------
@pytest.fixture(scope="module")
def existing_agreements():
    items = _list_all_agreements()
    assert len(items) >= 1, "No seeded agreements present"
    return items


@pytest.fixture(scope="module")
def wiped_dir():
    """Wipe the agreements dir ONCE so self-heal has to regenerate."""
    AGREEMENT_DIR.mkdir(parents=True, exist_ok=True)
    for f in AGREEMENT_DIR.glob("*.pdf"):
        try:
            f.unlink()
        except Exception:
            pass
    # confirm wipe
    remaining = list(AGREEMENT_DIR.glob("*.pdf"))
    assert remaining == [], f"wipe failed: {remaining}"
    yield AGREEMENT_DIR


# -------- tests --------
class TestTemplate5Page:
    """Verify the 5-page template on self-healed PDFs."""

    def test_self_heal_regenerates_all_pdfs(self, wiped_dir, existing_agreements):
        """After wiping disk, every agreement's /pdf endpoint regenerates a valid PDF."""
        for ag in existing_agreements:
            pdf = _fetch_pdf(ag["id"])
            assert len(pdf) >= 150_000, f"PDF for {ag['id']} too small: {len(pdf)} bytes"

    def test_every_pdf_has_exactly_5_pages(self, existing_agreements):
        for ag in existing_agreements:
            pdf = _fetch_pdf(ag["id"])
            reader = PdfReader(BytesIO(pdf))
            assert len(reader.pages) == 5, (
                f"Agreement {ag['id']} has {len(reader.pages)} pages, expected 5"
            )

    def test_running_header_on_every_page(self, existing_agreements):
        ag = existing_agreements[0]
        pages = _pages_text(_fetch_pdf(ag["id"]))
        assert len(pages) == 5
        for idx, txt in enumerate(pages):
            assert HEADER_L in txt, f"page {idx+1} missing left header"
            assert HEADER_R in txt, f"page {idx+1} missing right header"

    def test_page1_content(self, existing_agreements):
        ag = existing_agreements[0]
        p1 = _pages_text(_fetch_pdf(ag["id"]))[0]
        norm = re.sub(r"\s+", " ", p1)
        assert "Annexure 2" in norm
        assert "Agreement between Consumer" in norm
        assert "grid connected rooftop solar" in norm
        assert "Between" in norm
        assert "And" in norm
        assert "ASR ENTERPRISES" in norm
        assert "Dawarikapuri Road no 2C Khagaul Patna Bihar 801105" in norm

    def test_page2_content(self, existing_agreements):
        ag = existing_agreements[0]
        p2 = _pages_text(_fetch_pdf(ag["id"]))[1]
        norm = re.sub(r"\s+", " ", p2)
        assert "Whereas" in norm
        assert "And whereas" in norm
        assert "First Party here by undertakes" in norm
        # item 1 of Second Party
        assert "follow all standards" in norm

    def test_page3_content(self, existing_agreements):
        ag = existing_agreements[0]
        p3 = _pages_text(_fetch_pdf(ag["id"]))[2]
        norm = re.sub(r"\s+", " ", p3)
        assert "Site Survey" in norm
        # ends around Operation & Maintenance (item 8)
        assert "Operation" in norm and "Maintenance" in norm

    def test_page4_content(self, existing_agreements):
        ag = existing_agreements[0]
        p4 = _pages_text(_fetch_pdf(ag["id"]))[3]
        norm = re.sub(r"\s+", " ", p4)
        # continuation "the scope of vendor"
        assert "scope of vendor" in norm
        assert "Insurance" in norm
        assert "Mutually Agreed Terms of Payment" in norm
        # First-party signature block
        assert "First Party" in norm
        assert "Sign" in norm and "Date" in norm

    def test_page5_content(self, existing_agreements):
        ag = existing_agreements[0]
        p5 = _pages_text(_fetch_pdf(ag["id"]))[4]
        norm = re.sub(r"\s+", " ", p5)
        assert "Second Party" in norm
        assert "ASR ENTERPRISES" in norm
        assert "Dwarikapuri Khagaul Patna Bihar 801105" in norm
        assert "Disclaimer" in norm

    def test_stamp_caption_on_pages_1_2_3_5_not_4(self, existing_agreements):
        ag = existing_agreements[0]
        pages = _pages_text(_fetch_pdf(ag["id"]))
        for idx in (0, 1, 2, 4):
            assert STAMP_CAPTION in pages[idx], (
                f"page {idx+1} missing stamp caption"
            )
        assert STAMP_CAPTION not in pages[3], (
            "page 4 unexpectedly contains stamp caption"
        )


class TestAutoTriggerFromNewQuotation:
    """New PMSG quotation → agreement with same 5-page template."""

    PHONE = "9123455501"

    def test_create_pmsg_quotation_triggers_agreement(self):
        payload = {
            "customer": {
                "name": f"TEST_5Page_{uuid.uuid4().hex[:6]}",
                "phone": self.PHONE,
                "address": "Sai Chak Anisabad Patna Bihar 800002",
                "state": "Bihar", "state_code": "10", "pincode": "800002",
            },
            "project_type": "solar_project",
            "total_amount": 210000,
            "project_name": "3 kW Solar Rooftop (PMSG 5-page test)",
            "doc_type": "quotation",
            "scheme": "pm_surya_ghar",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = requests.post(f"{API}/gst/invoices", json=payload, timeout=45)
        assert r.status_code in (200, 201), f"create invoice failed: {r.status_code} {r.text[:300]}"
        q = r.json()
        quote_id = q.get("id")
        # Background task — allow up to 15s
        agreement = None
        for _ in range(15):
            time.sleep(1)
            g = requests.get(f"{API}/agreements/customer/{self.PHONE}", timeout=20)
            if g.status_code == 200:
                items = g.json().get("agreements", [])
                for a in items:
                    if a.get("quotation_id") == quote_id:
                        agreement = a
                        break
                if agreement:
                    break
        assert agreement is not None, "Agreement not auto-generated within 15s"
        pdf = _fetch_pdf(agreement["id"])
        reader = PdfReader(BytesIO(pdf))
        assert len(reader.pages) == 5, f"auto-trigger PDF has {len(reader.pages)} pages"
        pages = [p.extract_text() or "" for p in reader.pages]
        assert "Annexure 2" in pages[0]
        assert "Disclaimer" in pages[4]
        assert STAMP_CAPTION in pages[0]
        assert STAMP_CAPTION not in pages[3]
        # stash id for WhatsApp/trash tests via class attr
        TestAutoTriggerFromNewQuotation.LAST_AG_ID = agreement["id"]


class TestRegressionTrashAndWhatsApp:
    def test_whatsapp_send_endpoint_returns_json(self, existing_agreements):
        ag = existing_agreements[0]
        r = requests.post(f"{API}/agreements/{ag['id']}/send-whatsapp", timeout=60)
        # Endpoint must not 500. Meta may not be configured → expect 200 JSON
        # with success=false or 503. Anything else is a regression.
        assert r.status_code in (200, 503), f"unexpected status {r.status_code}: {r.text[:200]}"
        if r.status_code == 200:
            j = r.json()
            assert "success" in j, j

    def test_trash_delete_and_restore(self):
        # Create a throwaway agreement via /generate on an existing quotation,
        # or pick the newest agreement and soft-delete it.
        items = _list_all_agreements()
        # Prefer a TEST_ one to avoid touching real data
        target = next((a for a in items if (a.get("customer_name") or "").startswith("TEST_")), None)
        if not target:
            pytest.skip("No TEST_ agreement available to safely trash")
        ag_id = target["id"]
        d = requests.delete(f"{API}/agreements/{ag_id}", timeout=20)
        assert d.status_code == 200, d.text[:200]
        body = d.json()
        assert body.get("moved_to_trash") is True
        trash_id = body.get("trash_id")
        assert trash_id
        # verify gone from active list
        g = requests.get(f"{API}/agreements/{ag_id}", timeout=15)
        assert g.status_code == 404
        # attempt restore (best-effort)
        rs = requests.post(f"{API}/trash/{trash_id}/restore", timeout=20)
        # restore is optional in this test — just ensure endpoint doesn't 500
        assert rs.status_code in (200, 201, 400, 404), f"restore unexpected {rs.status_code}"
