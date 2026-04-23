"""Iter 101 - Solar Agreement (PM Surya Ghar Yojana) end-to-end tests."""
import os, time, pytest, requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
# fallback to frontend .env
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

TEST_PHONE = "9123456700"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _make_quotation(client, scheme="pm_surya_ghar", project_name="5 kW Solar Rooftop (PM Surya Ghar)"):
    body = {
        "customer": {
            "name": "TEST Agreement User",
            "phone": TEST_PHONE,
            "address": "Khagaul, Patna, Bihar",
            "state": "Bihar", "state_code": "10", "pincode": "801105",
        },
        "project_type": "solar_project",
        "total_amount": 250000,
        "project_name": project_name,
        "doc_type": "quotation",
        "scheme": scheme,
        "auto_send_whatsapp": False,
        "auto_send_email": False,
    }
    r = client.post(f"{BASE_URL}/api/gst/invoices", json=body, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


class TestAgreementAutoGen:
    def test_01_pmsg_quotation_triggers_agreement(self, client):
        pre = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE}").json()
        pre_count = pre.get("total", 0)

        q = _make_quotation(client, scheme="pm_surya_ghar")
        assert q["doc_type"] == "quotation"
        assert q["scheme"] == "pm_surya_ghar"

        # Poll up to 15s for background task to complete
        found = None
        for _ in range(15):
            time.sleep(1)
            r = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE}")
            assert r.status_code == 200
            data = r.json()
            if data.get("total", 0) > pre_count:
                # Locate by quotation id
                for a in data["agreements"]:
                    if a.get("quotation_id") == q["id"]:
                        found = a
                        break
                if found:
                    break
        assert found is not None, "Agreement was not auto-generated within 15s"
        pytest.agreement_id = found["id"]
        pytest.quotation_id = q["id"]

    def test_02_get_agreement_by_id(self, client):
        aid = pytest.agreement_id
        r = client.get(f"{BASE_URL}/api/agreements/{aid}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == aid
        assert d["scheme"] == "pm_surya_ghar"
        assert d.get("pdf_path")

    def test_03_stream_pdf_valid(self, client):
        aid = pytest.agreement_id
        r = client.get(f"{BASE_URL}/api/agreements/{aid}/pdf", timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 100 * 1024, f"PDF too small: {len(r.content)} bytes"

    def test_04_stamp_overlay_on_expected_pages(self, client):
        aid = pytest.agreement_id
        r = client.get(f"{BASE_URL}/api/agreements/{aid}/pdf", timeout=30)
        from io import BytesIO
        from PyPDF2 import PdfReader
        reader = PdfReader(BytesIO(r.content))
        stamped_pages = []
        for idx, pg in enumerate(reader.pages):
            txt = pg.extract_text() or ""
            if "Authorised Signatory" in txt or "Authorized Signatory" in txt:
                stamped_pages.append(idx)
        # First 3 pages + last page expected
        assert 0 in stamped_pages, f"Page 1 missing stamp. got={stamped_pages}"
        assert (len(reader.pages) - 1) in stamped_pages, f"Last page missing stamp. got={stamped_pages}"

    def test_05_manual_generate_pmsg_ok(self, client):
        qid = pytest.quotation_id
        r = client.post(f"{BASE_URL}/api/agreements/generate", json={"quotation_id": qid}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert d["agreement"]["scheme"] == "pm_surya_ghar"

    def test_06_manual_generate_non_pmsg_rejected(self, client):
        q = _make_quotation(client, scheme="", project_name="Plain Solar Rooftop")
        r = client.post(f"{BASE_URL}/api/agreements/generate", json={"quotation_id": q["id"]}, timeout=30)
        assert r.status_code == 400

    def test_07_non_pmsg_does_not_auto_generate(self, client):
        q = _make_quotation(client, scheme="", project_name="Plain Solar Rooftop")
        time.sleep(4)
        r = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE}").json()
        for a in r.get("agreements", []):
            assert a.get("quotation_id") != q["id"], "Non-PMSG quotation must not create agreement"

    def test_08_pmsg_via_project_name_auto_detect(self, client):
        pre = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE}").json().get("total", 0)
        # No scheme, but PM Surya Ghar in project_name → _create_and_persist_invoice auto-sets scheme
        q = _make_quotation(client, scheme="", project_name="Rooftop under PM Surya Ghar Yojana")
        assert q.get("scheme") == "pm_surya_ghar"  # auto-detected
        found = False
        for _ in range(15):
            time.sleep(1)
            data = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE}").json()
            if any(a.get("quotation_id") == q["id"] for a in data.get("agreements", [])):
                found = True
                break
        assert found, "PMSG detected via project_name did not auto-generate agreement"

    def test_09_customer_docs_include_agreement(self, client):
        r = client.get(f"{BASE_URL}/api/customer/documents/{TEST_PHONE}")
        # customer may or may not exist in CRM; if 404, skip
        if r.status_code == 404:
            pytest.skip("Customer CRM profile not found for documents endpoint")
        assert r.status_code == 200
        docs = r.json().get("documents", [])
        agreements = [d for d in docs if d.get("type") == "agreement"]
        assert agreements, "No agreement entries in /customer/documents response"
        a = agreements[0]
        assert "PM Surya Ghar" in a.get("label", "")
        assert a.get("url", "").startswith("/api/agreements/")
        assert a["url"].endswith("/pdf")

    def test_10_whatsapp_send_graceful(self, client):
        aid = pytest.agreement_id
        r = client.post(f"{BASE_URL}/api/agreements/{aid}/send-whatsapp", timeout=60)
        assert r.status_code == 200, f"Should never 500: {r.status_code} {r.text}"
        d = r.json()
        assert "success" in d
        if not d["success"]:
            assert d.get("error"), "Must return error text when not successful"

    def test_11_invalid_agreement_id_404(self, client):
        r = client.get(f"{BASE_URL}/api/agreements/does-not-exist-xyz")
        assert r.status_code == 404
        r2 = client.get(f"{BASE_URL}/api/agreements/does-not-exist-xyz/pdf")
        assert r2.status_code == 404
        r3 = client.post(f"{BASE_URL}/api/agreements/does-not-exist-xyz/send-whatsapp")
        assert r3.status_code == 404

    def test_12_invalid_phone_400(self, client):
        r = client.get(f"{BASE_URL}/api/agreements/customer/123")
        assert r.status_code == 400

    def test_13_missing_pdf_file_400_on_whatsapp(self, client):
        aid = pytest.agreement_id
        # Temporarily rename the pdf
        meta = client.get(f"{BASE_URL}/api/agreements/{aid}").json()
        pdf_path = Path(meta["pdf_path"])
        if not pdf_path.exists():
            pytest.skip("pdf already missing")
        backup = pdf_path.with_suffix(".pdf.bak")
        pdf_path.rename(backup)
        try:
            # GET /pdf should 404 (file missing on disk)
            r = client.get(f"{BASE_URL}/api/agreements/{aid}/pdf")
            assert r.status_code == 404
            # send-whatsapp should 400
            r2 = client.post(f"{BASE_URL}/api/agreements/{aid}/send-whatsapp")
            assert r2.status_code == 400
        finally:
            backup.rename(pdf_path)
