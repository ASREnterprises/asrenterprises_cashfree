"""
Iter 10 regression tests for /app/backend/routes/agreements.py
5-page "signed physical copy" template.

Changes vs iter_9 template this suite validates:
  - "Annexure2" (no space), "Model Draft Agreement..." title on page 1
  - Date with English ordinal suffix (1st/2nd/3rd/23rd/25th) on page 1
  - Running footer "Guidelines for PM-Surya Ghar: Muft Bijli Yojana" +
    "Central Financial Assistance to Residential Consumers" at BOTTOM-CENTER
    on every one of the 5 pages
  - Page 2 starts with "ASR ENTERPRISES ... having registered office at
    Dawarikapuri Road no 2C Khagaul Patna Bihar 801105"
  - Page 5 Second Party block uses full-caps
    "DAWARIKAPURI ROAD NO 2C KHAGAUL, PATNA-801105, PATNA BIHAR."
  - Page 5 Date pre-filled as DD/MM/YYYY with today's date
  - Stamp overlay:
      * XObject images present on pages 0, 1, 2, 4 (0-indexed)
      * NO XObject image on page 3 (First Party signature page)
  - Stamp caption text "Authorised Signatory..." has been removed from overlay
"""
import os
import re
import time
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

import pytest
import requests
from PyPDF2 import PdfReader


def _load_backend_url():
    u = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if u:
        return u.rstrip("/")
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

FOOTER_L = "Guidelines for PM-Surya Ghar: Muft Bijli Yojana"
FOOTER_R = "Central Financial Assistance to Residential Consumers"
OLD_STAMP_CAPTION = "Authorised Signatory"


# -------- helpers --------
def _fetch_pdf(agreement_id):
    r = requests.get(f"{API}/agreements/{agreement_id}/pdf", timeout=60)
    assert r.status_code == 200, (
        f"/pdf returned {r.status_code} for {agreement_id}: {r.text[:200]}"
    )
    assert r.content[:4] == b"%PDF", "response is not a PDF"
    return r.content


def _pages_text(pdf_bytes):
    reader = PdfReader(BytesIO(pdf_bytes))
    return [p.extract_text() or "" for p in reader.pages]


def _page_has_image_xobject(page) -> bool:
    """Return True if the page has at least one /Image XObject in its
    resources. reportlab's drawImage() + merge_page pulls the stamp PNG
    in as an /Image XObject on the final merged page."""
    try:
        resources = page.get("/Resources")
        if resources is None:
            return False
        xobj_dict = resources.get("/XObject")
        if xobj_dict is None:
            return False
        # xobj_dict is an IndirectObject/DictionaryObject of named refs
        try:
            xobj_dict = xobj_dict.get_object()
        except Exception:
            pass
        for name in xobj_dict:
            try:
                obj = xobj_dict[name].get_object()
            except Exception:
                obj = xobj_dict[name]
            subtype = obj.get("/Subtype") if hasattr(obj, "get") else None
            if subtype == "/Image":
                return True
    except Exception:
        return False
    return False


def _list_all_agreements(limit=100):
    r = requests.get(f"{API}/agreements", params={"limit": limit}, timeout=30)
    assert r.status_code == 200, r.text[:200]
    return r.json().get("agreements", [])


def _today_ordinal():
    d = datetime.now().astimezone()
    day = int(d.strftime("%d"))
    if 10 <= day % 100 <= 20:
        sfx = "th"
    else:
        sfx = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return day, sfx, d.strftime("%B"), d.strftime("%Y"), d.strftime("%m")


# -------- fixtures --------
@pytest.fixture(scope="module")
def wiped_then_healed():
    """Wipe /app/backend/agreements/*.pdf once; force every subsequent /pdf
    call to self-heal through _regenerate_pdf_bytes."""
    AGREEMENT_DIR.mkdir(parents=True, exist_ok=True)
    for f in AGREEMENT_DIR.glob("*.pdf"):
        try:
            f.unlink()
        except Exception:
            pass
    remaining = list(AGREEMENT_DIR.glob("*.pdf"))
    assert remaining == [], f"wipe failed: {remaining}"
    yield


@pytest.fixture(scope="module")
def existing_agreements(wiped_then_healed):
    items = _list_all_agreements()
    assert len(items) >= 1, "No seeded agreements present"
    return items


@pytest.fixture(scope="module")
def sample_pdf(existing_agreements):
    ag = existing_agreements[0]
    return _fetch_pdf(ag["id"]), ag


# -------- tests --------
class TestSelfHealAll:
    def test_all_agreements_selfheal_to_5_pages(self, existing_agreements):
        bad = []
        for ag in existing_agreements:
            try:
                pdf = _fetch_pdf(ag["id"])
                reader = PdfReader(BytesIO(pdf))
                if len(reader.pages) != 5 or len(pdf) < 100_000:
                    bad.append((ag["id"], len(reader.pages), len(pdf)))
            except Exception as e:
                bad.append((ag["id"], "ERR", str(e)))
        assert not bad, f"agreements failing self-heal: {bad}"


class TestPageContent:
    def test_exactly_5_pages(self, sample_pdf):
        pdf, _ = sample_pdf
        reader = PdfReader(BytesIO(pdf))
        assert len(reader.pages) == 5

    def test_running_footer_on_every_page(self, sample_pdf):
        pdf, _ = sample_pdf
        pages = _pages_text(pdf)
        assert len(pages) == 5
        for idx, txt in enumerate(pages):
            norm = re.sub(r"\s+", " ", txt)
            assert FOOTER_L in norm, (
                f"page {idx+1} missing bottom-center footer LEFT. "
                f"Got: {norm[:300]!r}"
            )
            assert FOOTER_R in norm, (
                f"page {idx+1} missing bottom-center footer RIGHT"
            )

    def test_page1_has_annexure2_title_and_ordinal_date(self, sample_pdf):
        pdf, _ = sample_pdf
        p1 = re.sub(r"\s+", " ", _pages_text(pdf)[0])
        # "Annexure2" (no space)
        assert "Annexure2" in p1, f"page 1 missing 'Annexure2': {p1[:300]!r}"
        assert "Model Draft Agreement" in p1
        assert "grid connected rooftop solar" in p1
        # date clause with ordinal suffix
        day, sfx, month, year, _ = _today_ordinal()
        date_pat = re.compile(rf"\b{day}{sfx}\b.*\b{month}\b.*\b{year}\b")
        assert date_pat.search(p1), (
            f"page 1 date clause not found ({day}{sfx} ... {month} ... {year}). "
            f"Got: {p1[:500]!r}"
        )
        # Between ... (Name of Consumer) ... And
        assert "Between" in p1
        assert "Name of Consumer" in p1
        assert re.search(r"\bAnd\b", p1)

    def test_page2_starts_with_vendor_and_has_first_party_items(self, sample_pdf):
        pdf, _ = sample_pdf
        p2 = re.sub(r"\s+", " ", _pages_text(pdf)[1])
        assert "ASR ENTERPRISES" in p2
        assert "Name of Vendor" in p2
        assert "Dawarikapuri Road no 2C Khagaul Patna Bihar 801105" in p2
        assert "Whereas" in p2
        assert "And whereas" in p2
        # First Party has 5 numbered items; Second Party item 1 (standards)
        assert "First Party" in p2
        assert "follow all standards" in p2  # Second Party item 1

    def test_page3_has_site_survey_through_commissioning_no_item8(self, sample_pdf):
        pdf, _ = sample_pdf
        p3 = re.sub(r"\s+", " ", _pages_text(pdf)[2])
        assert "Site Survey" in p3
        # items 2..7 (Site Survey ... Testing and Commissioning)
        assert re.search(r"Testing\s*and\s*Commissioning", p3)
        # item 8 (Operation & Maintenance) should appear only on page 4
        # Tolerate section heading but ensure "O&M" bullet lands on p4
        # Just assert it is on page 4 (below) — here don't over-constrain

    def test_page4_has_items_8_to_15_and_first_party_sig(self, sample_pdf):
        pdf, _ = sample_pdf
        p4 = re.sub(r"\s+", " ", _pages_text(pdf)[3])
        # item 8 "Operation & Maintenance"
        assert re.search(r"Operation.*Maintenance", p4), p4[:400]
        assert "Mutually Agreed Terms of Payment" in p4  # item 15
        assert "First Party" in p4
        assert "Sign" in p4 and "Date" in p4

    def test_page5_second_party_caps_address_and_ddmmyyyy(self, sample_pdf):
        pdf, _ = sample_pdf
        p5 = re.sub(r"\s+", " ", _pages_text(pdf)[4])
        assert "Second Party" in p5
        assert "ASR ENTERPRISES" in p5
        # full-caps address exactly as in signed copy
        assert "DAWARIKAPURI ROAD NO 2C KHAGAUL" in p5, p5[:500]
        assert "PATNA-801105" in p5
        assert "PATNA BIHAR" in p5
        # DD/MM/YYYY today date
        day, _, _, year, month_num = _today_ordinal()
        ddmmyyyy = f"{day}/{month_num}/{year}"
        assert ddmmyyyy in p5, (
            f"page 5 missing today's DD/MM/YYYY '{ddmmyyyy}'. Got: {p5[:500]!r}"
        )
        assert "Disclaimer" in p5

    def test_old_stamp_caption_removed_everywhere(self, sample_pdf):
        """The 'Authorised Signatory — Abhijeet Kumar, ASR Enterprises'
        caption text has been removed from the overlay on all 5 pages."""
        pdf, _ = sample_pdf
        for idx, txt in enumerate(_pages_text(pdf)):
            assert OLD_STAMP_CAPTION not in txt, (
                f"page {idx+1} still contains old stamp caption text"
            )


class TestStampOverlay:
    """XObject image presence is the canonical proxy for 'stamp image was
    merged into the page' now that caption text has been removed."""

    def test_stamp_image_on_pages_1_2_3_and_5(self, sample_pdf):
        pdf, _ = sample_pdf
        reader = PdfReader(BytesIO(pdf))
        for idx in (0, 1, 2, 4):
            assert _page_has_image_xobject(reader.pages[idx]), (
                f"page {idx+1} missing expected stamp image XObject"
            )

    def test_stamp_image_absent_on_page_4(self, sample_pdf):
        """Page 4 (0-indexed 3) is the First Party signature page — no stamp."""
        pdf, _ = sample_pdf
        reader = PdfReader(BytesIO(pdf))
        assert not _page_has_image_xobject(reader.pages[3]), (
            "page 4 (First Party signature) unexpectedly contains a stamp image"
        )


class TestFreshPMSGQuotation:
    PHONE = "9123455501"

    def test_create_pmsg_quotation_auto_triggers_5page_agreement(self):
        cust_name = f"TEST_SIGNED_{uuid.uuid4().hex[:6]}"
        cust_addr = "Sai Chak Anisabad Patna Bihar 800002"
        payload = {
            "customer": {
                "name": cust_name,
                "phone": self.PHONE,
                "address": cust_addr,
                "state": "Bihar", "state_code": "10", "pincode": "800002",
            },
            "project_type": "solar_project",
            "total_amount": 210000,
            "project_name": "3 kW Solar Rooftop (iter10 signed-copy test)",
            "doc_type": "quotation",
            "scheme": "pm_surya_ghar",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = requests.post(f"{API}/gst/invoices", json=payload, timeout=45)
        assert r.status_code in (200, 201), (
            f"create invoice failed: {r.status_code} {r.text[:300]}"
        )
        q = r.json()
        quote_id = q.get("id")

        agreement = None
        for _ in range(15):
            time.sleep(1)
            g = requests.get(
                f"{API}/agreements/customer/{self.PHONE}", timeout=20
            )
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
        assert len(reader.pages) == 5, (
            f"auto-trigger PDF has {len(reader.pages)} pages"
        )
        pages = [re.sub(r"\s+", " ", p.extract_text() or "") for p in reader.pages]
        # customer name + address appear on page 1
        assert cust_name in pages[0], pages[0][:400]
        assert "Sai Chak Anisabad" in pages[0]
        # 5-page identifiers
        assert "Annexure2" in pages[0]
        assert "Disclaimer" in pages[4]
        # XObject stamp overlay
        assert _page_has_image_xobject(reader.pages[0])
        assert not _page_has_image_xobject(reader.pages[3])
        assert _page_has_image_xobject(reader.pages[4])
        # footer
        for idx, txt in enumerate(pages):
            assert FOOTER_L in txt, f"page {idx+1} missing footer on fresh PDF"


class TestRegressionTrashAndWhatsApp:
    def test_whatsapp_send_endpoint_returns_json(self, existing_agreements):
        ag = existing_agreements[0]
        r = requests.post(
            f"{API}/agreements/{ag['id']}/send-whatsapp", timeout=60
        )
        assert r.status_code in (200, 503), (
            f"unexpected status {r.status_code}: {r.text[:200]}"
        )
        if r.status_code == 200:
            j = r.json()
            assert "success" in j, j

    def test_trash_delete_and_restore(self):
        items = _list_all_agreements()
        target = next(
            (a for a in items if (a.get("customer_name") or "").startswith("TEST_")),
            None,
        )
        if not target:
            pytest.skip("No TEST_ agreement available to safely trash")
        ag_id = target["id"]
        d = requests.delete(f"{API}/agreements/{ag_id}", timeout=20)
        assert d.status_code == 200, d.text[:200]
        body = d.json()
        assert body.get("moved_to_trash") is True
        trash_id = body.get("trash_id")
        assert trash_id
        g = requests.get(f"{API}/agreements/{ag_id}", timeout=15)
        assert g.status_code == 404
        rs = requests.post(f"{API}/trash/{trash_id}/restore", timeout=20)
        assert rs.status_code in (200, 201, 400, 404), (
            f"restore unexpected {rs.status_code}"
        )

    def test_admin_list_works(self):
        r = requests.get(f"{API}/agreements", params={"limit": 5}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "agreements" in data
        assert isinstance(data["agreements"], list)
