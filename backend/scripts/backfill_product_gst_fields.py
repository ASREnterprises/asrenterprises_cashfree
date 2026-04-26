"""One-shot operational migration: backfill `hsn_sac` and `is_gst_inclusive`
on existing shop products. Idempotent — safe to re-run.

HSN/SAC mapping per CBIC notification 1/2017:
  • 8541 — Solar PV cells / panels / modules         → 5%
  • 8504 — Solar inverters / converters              → 5%
  • 8507 — Lithium / lead-acid storage batteries     → 5%
  • 8544 — Insulated cables / wires (non-PV-specific)→ 18%
  • 7308 — Mounting structures (steel)               → 5% if part of solar kit
  • 8536 — Connectors (incl. MC4)                    → 5% if solar
  • 9954 — Construction / installation services      → 18%
  • 9987 — Maintenance & repair services             → 18%
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))


def hsn_for(product: dict) -> str:
    nm = (product.get("name") or "").lower()
    cat = (product.get("category") or "").lower()
    if "panel" in nm or "module" in nm or cat == "solar_panel":
        return "8541"
    if "inverter" in nm or cat == "inverter":
        return "8504"
    if "battery" in nm or cat == "battery":
        return "8507"
    if "mc4" in nm or "connector" in nm:
        return "8536"
    if "mount" in nm or "structure" in nm:
        return "7308"
    if "cable" in nm or "wire" in nm or cat == "wire":
        return "8544"
    if cat == "service" or "amc" in nm or "maintenance" in nm:
        return "9987"
    return ""


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    cur = db.products.find({})
    updated = 0
    async for p in cur:
        patch = {}
        if "hsn_sac" not in p or not p.get("hsn_sac"):
            patch["hsn_sac"] = hsn_for(p)
        if "is_gst_inclusive" not in p:
            patch["is_gst_inclusive"] = True
        if patch:
            await db.products.update_one({"id": p["id"]}, {"$set": patch})
            updated += 1
            print(f"  ✓ {p.get('name')[:50]:50s} → hsn={patch.get('hsn_sac', p.get('hsn_sac', '?'))}, "
                  f"inclusive={patch.get('is_gst_inclusive', p.get('is_gst_inclusive', '?'))}")
    total = await db.products.count_documents({})
    with_hsn = await db.products.count_documents({"hsn_sac": {"$exists": True}})
    with_incl = await db.products.count_documents({"is_gst_inclusive": {"$exists": True}})
    print(f"\nDONE — updated {updated} of {total} products. "
          f"hsn_sac coverage: {with_hsn}/{total}, is_gst_inclusive coverage: {with_incl}/{total}")


if __name__ == "__main__":
    asyncio.run(main())
