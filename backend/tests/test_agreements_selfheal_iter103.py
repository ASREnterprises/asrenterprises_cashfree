"""Iter 103 - Solar Agreement PDF Self-Heal regression + edge cases.

Scope:
  1. Self-heal after full disk wipe (rm -f /app/backend/agreements/*.pdf)
  2. Persistence of regenerated path + regenerated_at field
  3. Unique filename collision safety (two agreements / same quotation)
  4. Create→GET happy path (PMSG auto-trigger)
  5. Admin list + Delete → Trash regression
  6. WhatsApp self-heal after wipe (must not 500 with 'PDF file missing')
  7. Non-PMSG manual generate → 400
  8. Customer /documents endpoint still serves PDF inline
  9. GST-inclusive quotation regression (total_is_gst_inclusive=true)
  10. Edge cases: empty pdf_path, bad parent dir, concurrent self-heal
"""
import asyncio
import concurrent.futures
import os
import time
from io import BytesIO
from pathlib import Path

import pytest
import requests
from PyPDF2 import PdfReader

from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

MONGO_URL = None
DB_NAME = None
for line in Path("/app/backend/.env").read_text().splitlines():
    if line.startswith("MONGO_URL="):
        MONGO_URL = line.split("=", 1)[1].strip()
    elif line.startswith("DB_NAME="):
        DB_NAME = line.split("=", 1)[1].strip()


def _discover_db_name():
    """Find the DB that actually holds the agreements collection used by the running backend."""
    cli = MongoClient(MONGO_URL, serverSelectionTimeoutMS=3000)
    best = (DB_NAME, 0)
    try:
        for name in cli.list_database_names():
            if name in ("admin", "local", "config"):
                continue
            coll = cli[name].list_collection_names()
            if "agreements" in coll:
                cnt = cli[name].agreements.count_documents({})
                if cnt > best[1]:
                    best = (name, cnt)
    finally:
        cli.close()
    return best[0] or DB_NAME


DB_NAME = _discover_db_name()

AGREEMENT_DIR = Path("/app/backend/agreements")
TEST_PHONE_EXISTING = "9123456700"
TEST_PHONE_FRESH = "9296389097"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _wipe_all_pdfs():
    AGREEMENT_DIR.mkdir(parents=True, exist_ok=True)
    for f in AGREEMENT_DIR.glob("*.pdf"):
        f.unlink()
    for f in AGREEMENT_DIR.glob("*.bak"):
        f.unlink()


def _assert_valid_pdf_response(r):
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:200]}"
    assert r.headers.get("Content-Type", "").startswith("application/pdf"), (
        f"content-type={r.headers.get('Content-Type')}"
    )
    cd = r.headers.get("Content-Disposition", "")
    assert cd.lower().startswith("inline"), f"disposition={cd}"
    assert r.content[:4] == b"%PDF", f"magic={r.content[:4]!r}"
    assert len(r.content) > 100 * 1024, f"pdf too small: {len(r.content)} bytes"
    reader = PdfReader(BytesIO(r.content))
    assert len(reader.pages) >= 3, f"only {len(reader.pages)} pages"


class TestSelfHealAfterWipe:
    def test_01_wipe_all_and_heal_every_agreement(self, client):
        # List all agreements
        r = client.get(f"{BASE_URL}/api/agreements?limit=200")
        assert r.status_code == 200
        agreements = r.json().get("agreements", [])
        assert len(agreements) >= 1, "No agreements seeded — run iter101 first"

        _wipe_all_pdfs()
        assert len(list(AGREEMENT_DIR.glob("*.pdf"))) == 0, "wipe failed"

        healed = 0
        failures = []
        for a in agreements:
            aid = a["id"]
            try:
                r = client.get(f"{BASE_URL}/api/agreements/{aid}/pdf", timeout=60)
                _assert_valid_pdf_response(r)
                healed += 1
            except AssertionError as e:
                failures.append(f"{aid}: {e}")
        assert not failures, f"{len(failures)} healed failures: {failures[:3]}"
        assert healed == len(agreements), f"healed {healed}/{len(agreements)}"

    def test_02_persistence_after_heal(self, client):
        """After self-heal, disk file exists AND DB has updated pdf_path + regenerated_at."""
        r = client.get(f"{BASE_URL}/api/agreements?limit=5")
        a = r.json()["agreements"][0]
        aid = a["id"]

        # Wipe this one file
        p = Path(a["pdf_path"])
        if p.exists():
            p.unlink()

        r = client.get(f"{BASE_URL}/api/agreements/{aid}/pdf", timeout=60)
        _assert_valid_pdf_response(r)

        # Verify DB updated
        r2 = client.get(f"{BASE_URL}/api/agreements/{aid}")
        assert r2.status_code == 200
        doc = r2.json()
        assert doc.get("pdf_path"), "pdf_path missing after heal"
        new_path = Path(doc["pdf_path"])
        assert new_path.exists(), f"disk file not persisted: {new_path}"
        assert new_path.stat().st_size > 100 * 1024
        assert doc.get("regenerated_at"), "regenerated_at not set"


class TestUniqueFilenames:
    def test_03_same_quotation_two_agreements_distinct_files(self, client):
        # find any PMSG quotation id
        r = client.get(f"{BASE_URL}/api/agreements?limit=200").json()
        pmsg_qid = None
        for a in r["agreements"]:
            if a.get("quotation_id") and a.get("scheme") == "pm_surya_ghar":
                pmsg_qid = a["quotation_id"]
                break
        assert pmsg_qid, "No existing PMSG agreement to reuse"

        # Generate twice
        r1 = client.post(f"{BASE_URL}/api/agreements/generate",
                         json={"quotation_id": pmsg_qid}, timeout=60)
        assert r1.status_code == 200, r1.text
        r2 = client.post(f"{BASE_URL}/api/agreements/generate",
                         json={"quotation_id": pmsg_qid}, timeout=60)
        assert r2.status_code == 200, r2.text

        a1 = r1.json()["agreement"]
        a2 = r2.json()["agreement"]
        assert a1["id"] != a2["id"]
        assert a1["pdf_path"] != a2["pdf_path"], "filename collision!"
        assert Path(a1["pdf_path"]).exists()
        assert Path(a2["pdf_path"]).exists()
        # filename should carry 8-char agreement id suffix
        assert a1["id"][:8] in a1["pdf_path"]
        assert a2["id"][:8] in a2["pdf_path"]


class TestRegressionCreateFlow:
    def test_04_pmsg_create_then_pdf_fetch(self, client):
        body = {
            "customer": {
                "name": "TEST SelfHeal iter103",
                "phone": TEST_PHONE_FRESH,
                "address": "Patna, Bihar",
                "state": "Bihar", "state_code": "10", "pincode": "800001",
            },
            "project_type": "solar_project",
            "total_amount": 300000,
            "project_name": "5 kW PM Surya Ghar Rooftop",
            "doc_type": "quotation",
            "scheme": "pm_surya_ghar",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = client.post(f"{BASE_URL}/api/gst/invoices", json=body, timeout=60)
        assert r.status_code == 200, r.text
        qid = r.json()["id"]

        # Wait for background agreement creation
        agreement = None
        for _ in range(15):
            time.sleep(1)
            r = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE_FRESH}")
            for a in r.json().get("agreements", []):
                if a.get("quotation_id") == qid:
                    agreement = a
                    break
            if agreement:
                break
        assert agreement, "agreement not auto-created within 15s"

        r = client.get(f"{BASE_URL}/api/agreements/{agreement['id']}/pdf", timeout=60)
        _assert_valid_pdf_response(r)
        pytest.iter103_agreement_id = agreement["id"]


class TestRegressionAdminList:
    def test_05_list_with_search_and_pagination(self, client):
        r = client.get(f"{BASE_URL}/api/agreements?page=1&limit=5")
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "agreements" in d
        assert d["page"] == 1 and d["limit"] == 5
        assert len(d["agreements"]) <= 5

        r2 = client.get(f"{BASE_URL}/api/agreements?search=TEST")
        assert r2.status_code == 200

    def test_06_delete_moves_to_trash(self, client):
        # Create throwaway agreement to delete
        r = client.get(f"{BASE_URL}/api/agreements?limit=200").json()
        pmsg_qid = next((a["quotation_id"] for a in r["agreements"]
                         if a.get("scheme") == "pm_surya_ghar"), None)
        assert pmsg_qid
        gen = client.post(f"{BASE_URL}/api/agreements/generate",
                          json={"quotation_id": pmsg_qid}, timeout=60).json()
        aid = gen["agreement"]["id"]

        r = client.delete(f"{BASE_URL}/api/agreements/{aid}")
        assert r.status_code == 200
        d = r.json()
        assert d.get("moved_to_trash") is True

        # Verify gone from list
        r2 = client.get(f"{BASE_URL}/api/agreements/{aid}")
        assert r2.status_code == 404


class TestRegressionWhatsAppSelfHeal:
    def test_07_send_whatsapp_after_wipe_never_500(self, client):
        aid = getattr(pytest, "iter103_agreement_id", None)
        if not aid:
            r = client.get(f"{BASE_URL}/api/agreements?limit=5").json()
            aid = r["agreements"][0]["id"]

        # Wipe this agreement's file
        meta = client.get(f"{BASE_URL}/api/agreements/{aid}").json()
        p = Path(meta["pdf_path"])
        if p.exists():
            p.unlink()

        r = client.post(f"{BASE_URL}/api/agreements/{aid}/send-whatsapp", timeout=60)
        # Either 200 success or graceful failure — must never be 500 with "PDF file missing"
        assert r.status_code != 500, f"500 regression: {r.text[:200]}"
        body_text = r.text.lower()
        assert "pdf file missing" not in body_text, f"old error msg leaked: {r.text[:300]}"

        # After call, file should be back on disk (self-heal ran regardless of send outcome)
        # Re-fetch DB to get latest path
        meta2 = client.get(f"{BASE_URL}/api/agreements/{aid}").json()
        p2 = Path(meta2["pdf_path"])
        assert p2.exists(), f"file not self-healed: {p2}"


class TestRegressionNonPMSG:
    def test_08_non_pmsg_manual_generate_400(self, client):
        # Create a plain quotation
        body = {
            "customer": {"name": "TEST NonPMSG", "phone": TEST_PHONE_FRESH,
                         "address": "x", "state": "Bihar", "state_code": "10", "pincode": "800001"},
            "project_type": "solar_project",
            "total_amount": 50000,
            "project_name": "Regular Rooftop",
            "doc_type": "quotation",
            "scheme": "",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = client.post(f"{BASE_URL}/api/gst/invoices", json=body, timeout=60)
        assert r.status_code == 200
        qid = r.json()["id"]
        r2 = client.post(f"{BASE_URL}/api/agreements/generate",
                         json={"quotation_id": qid}, timeout=30)
        assert r2.status_code == 400


class TestRegressionCustomerDocs:
    def test_09_customer_documents_pdf_inline(self, client):
        r = client.get(f"{BASE_URL}/api/customer/documents/{TEST_PHONE_EXISTING}")
        if r.status_code == 404:
            pytest.skip("Customer not found in CRM")
        assert r.status_code == 200
        docs = r.json().get("documents", [])
        agreements = [d for d in docs if d.get("type") == "agreement"]
        assert agreements, "no agreement in customer docs"
        url = agreements[0]["url"]
        assert url.startswith("/api/agreements/") and url.endswith("/pdf")

        r2 = client.get(f"{BASE_URL}{url}", timeout=60)
        _assert_valid_pdf_response(r2)


class TestRegressionGSTInclusive:
    def test_10_gst_inclusive_grand_total(self, client):
        body = {
            "customer": {"name": "TEST GSTInclusive iter103",
                         "phone": TEST_PHONE_FRESH, "address": "x",
                         "state": "Bihar", "state_code": "10", "pincode": "800001"},
            "project_type": "solar_project",
            "total_amount": 210000,
            "total_is_gst_inclusive": True,
            "project_name": "5kW Rooftop",
            "doc_type": "quotation",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = client.post(f"{BASE_URL}/api/gst/invoices", json=body, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        gt = float(d.get("grand_total", 0))
        assert abs(gt - 210000.00) < 0.01, f"grand_total={gt}"


# ---------- Edge cases (direct DB mutation via sync pymongo) ----------
class TestEdgeCases:
    def _get_mongo(self):
        cli = MongoClient(MONGO_URL)
        return cli, cli[DB_NAME]

    def test_11_empty_pdf_path_string(self, client):
        """Agreement doc has pdf_path='' → self-heal must still regenerate + persist."""
        cli, db = self._get_mongo()
        try:
            r = client.get(f"{BASE_URL}/api/agreements?limit=200").json()
            a = next((x for x in r["agreements"] if x.get("scheme") == "pm_surya_ghar"), None)
            assert a
            aid = a["id"]
            db.agreements.update_one({"id": aid}, {"$set": {"pdf_path": ""}})

            resp = client.get(f"{BASE_URL}/api/agreements/{aid}/pdf", timeout=60)
            _assert_valid_pdf_response(resp)

            doc = db.agreements.find_one({"id": aid}, {"_id": 0})
            assert doc.get("pdf_path"), "pdf_path empty after heal"
            assert Path(doc["pdf_path"]).exists()
        finally:
            cli.close()

    def test_12_pdf_path_bad_parent_dir(self, client):
        """pdf_path points to nonexistent dir → self-heal recreates in AGREEMENT_DIR."""
        cli, db = self._get_mongo()
        try:
            r = client.get(f"{BASE_URL}/api/agreements?limit=200").json()
            a = next((x for x in r["agreements"] if x.get("scheme") == "pm_surya_ghar"), None)
            aid = a["id"]
            db.agreements.update_one(
                {"id": aid},
                {"$set": {"pdf_path": "/nonexistent/dir/agreement_bogus.pdf"}},
            )

            resp = client.get(f"{BASE_URL}/api/agreements/{aid}/pdf", timeout=60)
            _assert_valid_pdf_response(resp)

            doc = db.agreements.find_one({"id": aid}, {"_id": 0})
            new_path = Path(doc["pdf_path"])
            assert new_path.exists()
            assert str(new_path).startswith(str(AGREEMENT_DIR))
        finally:
            cli.close()

    def test_13_concurrent_self_heal_same_id(self, client):
        """5 concurrent fetches of same agreement after wipe — all must 200 with valid PDF."""
        r = client.get(f"{BASE_URL}/api/agreements?limit=5").json()
        a = r["agreements"][0]
        aid = a["id"]

        p = Path(a["pdf_path"])
        if p.exists():
            p.unlink()
        cli, db = self._get_mongo()
        try:
            doc = db.agreements.find_one({"id": aid}, {"_id": 0})
            p2 = Path(doc.get("pdf_path") or "")
            if p2.exists():
                p2.unlink()
        finally:
            cli.close()

        def _fetch(_):
            return requests.get(f"{BASE_URL}/api/agreements/{aid}/pdf", timeout=60)

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
            results = list(ex.map(_fetch, range(5)))

        for resp in results:
            _assert_valid_pdf_response(resp)
