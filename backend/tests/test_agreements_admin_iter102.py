"""Iter 102 — Solar Agreement Admin Panel + Trash + GST-inclusive Quotation tests.

Scope:
  * GET /api/agreements — admin list w/ pagination + search
  * DELETE /api/agreements/{id} — soft-delete into trash
  * GET /api/trash?source=agreements — trash listing + days_remaining + label
  * POST /api/trash/{trash_id}/restore — restores agreement to db.agreements
  * DELETE /api/trash/{trash_id} — permanent purge
  * GST-inclusive quotation CREATE/EDIT (total_is_gst_inclusive)
  * GST-exclusive invoice regression (6.3% added on top)
"""
import os
import time
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
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


def _make_pmsg_quotation(client, total_amount=250000):
    body = {
        "customer": {
            "name": "TEST Admin Agreement",
            "phone": TEST_PHONE,
            "address": "Khagaul, Patna, Bihar",
            "state": "Bihar", "state_code": "10", "pincode": "801105",
        },
        "project_type": "solar_project",
        "total_amount": total_amount,
        "project_name": "5 kW Solar Rooftop (PM Surya Ghar)",
        "doc_type": "quotation",
        "scheme": "pm_surya_ghar",
        "auto_send_whatsapp": False,
        "auto_send_email": False,
    }
    r = client.post(f"{BASE_URL}/api/gst/invoices", json=body, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Admin Agreement Panel ----------
class TestAgreementsAdminList:
    def test_01_list_no_filter(self, client):
        r = client.get(f"{BASE_URL}/api/agreements?page=1&limit=50")
        assert r.status_code == 200
        d = r.json()
        assert set(["total", "page", "limit", "agreements"]).issubset(d.keys())
        assert d["page"] == 1 and d["limit"] == 50
        assert isinstance(d["agreements"], list)
        # No _id leakage
        for a in d["agreements"]:
            assert "_id" not in a
            assert "id" in a

    def test_02_pagination_works(self, client):
        r1 = client.get(f"{BASE_URL}/api/agreements?page=1&limit=2")
        assert r1.status_code == 200
        d1 = r1.json()
        assert len(d1["agreements"]) <= 2
        assert d1["limit"] == 2

    def test_03_search_by_phone(self, client):
        r = client.get(f"{BASE_URL}/api/agreements?search={TEST_PHONE}")
        assert r.status_code == 200
        d = r.json()
        for a in d["agreements"]:
            blob = f"{a.get('customer_name','')} {a.get('customer_phone','')} {a.get('quotation_number','')}"
            assert TEST_PHONE in blob or a.get("customer_phone", "").endswith(TEST_PHONE)

    def test_04_search_nonexistent_returns_empty(self, client):
        r = client.get(f"{BASE_URL}/api/agreements?search=ZZZ_NO_SUCH_AGREEMENT_999")
        assert r.status_code == 200
        assert r.json()["total"] == 0
        assert r.json()["agreements"] == []


# ---------- Soft-delete → Trash → Restore → Purge lifecycle ----------
class TestAgreementTrashLifecycle:
    def test_05_seed_agreement(self, client):
        """Create a PMSG quotation → agreement autogen → keep agreement_id."""
        pre_ids = set()
        pre = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE}").json()
        for a in pre.get("agreements", []):
            pre_ids.add(a["id"])
        q = _make_pmsg_quotation(client)
        aid = None
        for _ in range(20):
            time.sleep(1)
            data = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE}").json()
            for a in data.get("agreements", []):
                if a["id"] not in pre_ids and a.get("quotation_id") == q["id"]:
                    aid = a["id"]
                    break
            if aid:
                break
        assert aid, "Failed to seed agreement for trash tests"
        pytest.seeded_aid = aid
        pytest.seeded_qnum = next(
            (a.get("quotation_number") for a in data["agreements"] if a["id"] == aid), None
        )

    def test_06_soft_delete_moves_to_trash(self, client):
        aid = pytest.seeded_aid
        r = client.delete(f"{BASE_URL}/api/agreements/{aid}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert d.get("moved_to_trash") is True
        assert d.get("trash_id")
        pytest.trash_id = d["trash_id"]

        # Source now returns 404
        r2 = client.get(f"{BASE_URL}/api/agreements/{aid}")
        assert r2.status_code == 404

        # Also gone from customer list
        r3 = client.get(f"{BASE_URL}/api/agreements/customer/{TEST_PHONE}").json()
        assert all(a["id"] != aid for a in r3.get("agreements", []))

    def test_07_trash_list_source_agreements(self, client):
        r = client.get(f"{BASE_URL}/api/trash?source=agreements&page=1&limit=50")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "counts" in d
        assert d["counts"].get("agreements", 0) >= 1
        entry = next((it for it in d["items"] if it["id"] == pytest.trash_id), None)
        assert entry, "Trash entry for our agreement not found"
        assert entry["source_collection"] == "agreements"
        assert entry["original_id"] == pytest.seeded_aid
        assert 28 <= entry["days_remaining"] <= 30
        assert entry["label"].startswith("Solar Agreement —")
        # Label includes quotation_number
        if pytest.seeded_qnum:
            assert pytest.seeded_qnum in entry["label"]
        assert "_id" not in entry

    def test_08_trash_invalid_source_400(self, client):
        r = client.get(f"{BASE_URL}/api/trash?source=invalid_src")
        assert r.status_code == 400

    def test_09_restore_brings_agreement_back(self, client):
        r = client.post(f"{BASE_URL}/api/trash/{pytest.trash_id}/restore")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["restored_id"] == pytest.seeded_aid
        assert d["source"] == "agreements"
        # Fetchable again
        r2 = client.get(f"{BASE_URL}/api/agreements/{pytest.seeded_aid}")
        assert r2.status_code == 200
        # Same trash_id can't be restored again
        r3 = client.post(f"{BASE_URL}/api/trash/{pytest.trash_id}/restore")
        assert r3.status_code == 404

    def test_10_second_delete_and_permanent_purge(self, client):
        # Re-delete for purge test
        aid = pytest.seeded_aid
        r = client.delete(f"{BASE_URL}/api/agreements/{aid}")
        assert r.status_code == 200
        tid = r.json()["trash_id"]
        # Purge
        rp = client.delete(f"{BASE_URL}/api/trash/{tid}")
        assert rp.status_code == 200
        assert rp.json()["success"] is True
        # Not recoverable
        rr = client.post(f"{BASE_URL}/api/trash/{tid}/restore")
        assert rr.status_code == 404
        # Source still 404
        rg = client.get(f"{BASE_URL}/api/agreements/{aid}")
        assert rg.status_code == 404
        # Second purge → 404
        rp2 = client.delete(f"{BASE_URL}/api/trash/{tid}")
        assert rp2.status_code == 404

    def test_11_delete_invalid_agreement_404(self, client):
        r = client.delete(f"{BASE_URL}/api/agreements/does-not-exist-zzz-123")
        assert r.status_code == 404


# ---------- GST-inclusive Quotation logic ----------
class TestGstInclusiveQuotation:
    def test_12_create_gst_inclusive_quotation(self, client):
        body = {
            "customer": {
                "name": "TEST Inclusive Quote",
                "phone": "9123000011",
                "address": "Patna, Bihar",
                "state": "Bihar", "state_code": "10", "pincode": "800001",
            },
            "doc_type": "quotation",
            "project_type": "solar_project",
            "total_amount": 210000,
            "total_is_gst_inclusive": True,
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = client.post(f"{BASE_URL}/api/gst/invoices", json=body, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert abs(d["grand_total"] - 210000.00) < 0.01, f"grand_total={d['grand_total']} expected 210000.00"
        # subtotal ≈ 197554.09, tax ≈ 12445.9
        assert 197500 <= d["subtotal"] <= 197610, f"subtotal out of range: {d['subtotal']}"
        tax = (d.get("cgst_total") or 0) + (d.get("sgst_total") or 0) + (d.get("igst_total") or 0)
        assert 12400 <= tax <= 12500, f"tax out of range: {tax}"
        pytest.inclusive_q_id = d["id"]

    def test_13_edit_gst_inclusive_quotation(self, client):
        qid = pytest.inclusive_q_id
        body = {
            "total_amount": 185000,
            "total_is_gst_inclusive": True,
            "project_type": "solar_project",
        }
        r = client.put(f"{BASE_URL}/api/gst/invoices/{qid}", json=body, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        inv = d.get("invoice") or d
        assert abs(inv["grand_total"] - 185000.00) < 0.01, f"edit grand_total={inv['grand_total']}"

    def test_14_gst_exclusive_invoice_regression(self, client):
        body = {
            "customer": {
                "name": "TEST Exclusive Invoice",
                "phone": "9123000012",
                "address": "Patna, Bihar",
                "state": "Bihar", "state_code": "10", "pincode": "800001",
            },
            "doc_type": "invoice",
            "project_type": "solar_project",
            "total_amount": 100000,
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        r = client.post(f"{BASE_URL}/api/gst/invoices", json=body, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        # Should add 6.3% → 106300, NOT 100000
        assert abs(d["grand_total"] - 106300.00) < 1.0, f"grand_total={d['grand_total']} expected ~106300"

    def test_15_edit_quotation_full_flow(self, client):
        # Create a baseline quotation first
        base_body = {
            "customer": {
                "name": "TEST EditFlow",
                "phone": "9123000013",
                "address": "Patna, Bihar",
                "state": "Bihar", "state_code": "10", "pincode": "800001",
            },
            "doc_type": "quotation",
            "project_type": "solar_project",
            "total_amount": 150000,
            "project_name": "Old Project Name",
            "notes": "old notes",
            "auto_send_whatsapp": False,
            "auto_send_email": False,
        }
        c = client.post(f"{BASE_URL}/api/gst/invoices", json=base_body, timeout=60)
        assert c.status_code == 200, c.text
        qid = c.json()["id"]

        upd = {
            "customer": {
                "name": "TEST EditFlow Updated",
                "phone": "9123000013",
                "address": "Patna, Bihar",
                "state": "Bihar", "state_code": "10", "pincode": "800001",
            },
            "doc_type": "quotation",
            "project_type": "solar_project",
            "total_amount": 220000,
            "total_is_gst_inclusive": True,
            "project_name": "5 kW Rooftop PM Surya Ghar",
            "notes": "updated notes",
            "scheme": "pm_surya_ghar",
        }
        r = client.put(f"{BASE_URL}/api/gst/invoices/{qid}", json=upd, timeout=60)
        assert r.status_code == 200, r.text
        inv = (r.json().get("invoice") or r.json())
        assert abs(inv["grand_total"] - 220000.00) < 0.01
        # Fetch back
        g = client.get(f"{BASE_URL}/api/gst/invoices/{qid}")
        assert g.status_code == 200
        gi = g.json()
        assert gi["customer"]["name"] == "TEST EditFlow Updated"
        # project_name is embedded in line_items descriptions
        descs = " ".join(li.get("description", "") for li in gi.get("line_items", []))
        assert "5 kW Rooftop PM Surya Ghar" in descs
        assert gi.get("notes") == "updated notes"
        assert gi.get("scheme") == "pm_surya_ghar"
        assert abs(gi["grand_total"] - 220000.00) < 0.01
        # PDF regenerated
        pdf_path = gi.get("pdf_path")
        if pdf_path:
            assert Path(pdf_path).exists(), f"pdf_path missing: {pdf_path}"
