"""Seed realistic solar products for the ASR Enterprises shop.

Safe to run repeatedly — only inserts when `products` collection has < 5 docs
so it won't duplicate admin-created items.
"""
import asyncio
import uuid
from datetime import datetime, timezone
from db_client import get_db


def _p(**kw):
    now_iso = datetime.now(timezone.utc).isoformat()
    base = {
        "id": str(uuid.uuid4()),
        "name": "",
        "description": "",
        "short_description": "",
        "category": "solar_panel",
        "price": 0.0,
        "sale_price": None,
        "stock": 20,
        "sku": "",
        "brand": "",
        "specifications": {},
        "electrical_specs": {},
        "mechanical_specs": {},
        "warranty_info": {},
        "shipping_info": "Free delivery across Bihar (4-7 business days)",
        "product_highlights": [],
        "images": [],
        "is_active": True,
        "is_featured": False,
        "warranty": "",
        "delivery_available": True,
        "pickup_available": True,
        "delivery_districts": [],
        "delivery_fees": {},
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    base.update(kw)
    return base


PRODUCTS = [
    _p(
        name="Waaree 540W Mono-PERC Solar Panel",
        category="solar_panel",
        brand="Waaree",
        price=15990,
        sale_price=13490,
        stock=120,
        sku="WAA-540M-PERC",
        short_description="Tier-1 540W mono-PERC panel, 21.5% efficiency, 25-year warranty.",
        description="Waaree 540W Mono-PERC half-cut cell panel with PID-resistant design. Ideal for rooftop, ground-mount and net-metering installations across Bihar. BIS-certified, DCR-compliant for PM Surya Ghar subsidy.",
        product_highlights=[
            "540W Mono-PERC half-cut cell",
            "21.5% module efficiency",
            "25-year performance warranty",
            "BIS certified, DCR-compliant (PM Surya Ghar)",
            "Anti-PID, anti-LID, anti-hotspot technology",
        ],
        electrical_specs={"Peak Power": "540W", "Efficiency": "21.5%", "Cells": "144 (half-cut)", "Voc": "49.5V"},
        mechanical_specs={"Weight": "27.5 kg", "Dimensions": "2279 x 1134 x 35 mm", "Frame": "Anodised Aluminium"},
        warranty_info={"Product Warranty": "12 years", "Performance Warranty": "25 years (84.8%)"},
        is_featured=True,
        images=["https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="Adani 550W Mono-PERC Solar Panel",
        category="solar_panel",
        brand="Adani Solar",
        price=16200,
        sale_price=13990,
        stock=85,
        sku="ADN-550M-BIS",
        short_description="Adani 550W mono-PERC premium panel with 21.8% efficiency.",
        description="Make in India panel from Adani Solar's Mundra facility. Ideal for 3kW–10kW rooftop systems. IEC, BIS, ALMM certified — qualifies for CFA subsidy under PM Surya Ghar Yojana.",
        product_highlights=[
            "550W rated output, 21.8% efficiency",
            "ALMM & BIS certified",
            "Qualifies for PM Surya Ghar subsidy",
            "Salt-mist, ammonia, PID-resistant",
            "Linear 25-year performance warranty",
        ],
        electrical_specs={"Peak Power": "550W", "Efficiency": "21.8%", "Voc": "50.1V"},
        warranty_info={"Product Warranty": "12 years", "Performance Warranty": "25 years"},
        is_featured=True,
        images=["https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="Luminous NXG 1400 Hybrid Solar Inverter 1.5kVA",
        category="inverter",
        brand="Luminous",
        price=14999,
        sale_price=11990,
        stock=40,
        sku="LUM-NXG1400",
        short_description="1.5kVA hybrid solar inverter with MPPT charge controller.",
        description="Runs home appliances directly off solar, charges battery when sun is high, and auto-switches to grid/battery at night. Perfect for 1-2 BHK homes in Bihar. Supports up to 6 solar panels (1.5kW).",
        product_highlights=[
            "1500VA / 1200W capacity",
            "Built-in MPPT charge controller",
            "Works with lead-acid or lithium battery",
            "Auto grid changeover",
            "Pure sine wave — runs all appliances",
        ],
        electrical_specs={"Capacity": "1500VA / 1200W", "Input": "12V DC", "Output": "230V ±5% AC"},
        warranty_info={"Product Warranty": "2 years"},
        images=["https://images.unsplash.com/photo-1559628233-100c798642d4?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="Microtek SMU PCU 3KVA-48V Solar Inverter",
        category="inverter",
        brand="Microtek",
        price=42500,
        sale_price=37999,
        stock=22,
        sku="MTK-PCU-3KVA48",
        short_description="3kVA / 48V solar PCU with 50A MPPT — handles up to 3kW PV.",
        description="Industrial-grade 3kVA PCU with dual MPPT tracking. Ideal for 3-5kW home systems with battery backup. Digital LCD display, real-time monitoring via Bluetooth app.",
        product_highlights=[
            "3000VA / 2400W pure sine wave",
            "50A solar MPPT charge controller",
            "Supports 3kW PV / 48V battery bank",
            "Bluetooth app monitoring",
            "LCD real-time display",
        ],
        is_featured=True,
        warranty_info={"Product Warranty": "2 years"},
        images=["https://images.unsplash.com/photo-1569097387886-57b70a64a5e5?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="Exide 150Ah C10 Solar Tubular Battery",
        category="battery",
        brand="Exide",
        price=16500,
        sale_price=14490,
        stock=60,
        sku="EXD-150AH-C10",
        short_description="150Ah C10 deep-cycle solar tubular battery, 60 months warranty.",
        description="Deep-cycle tubular battery designed for daily solar cycling. Low water topping, long 7-8 year life when paired with ASR-recommended charging pattern.",
        product_highlights=[
            "150Ah C10 rating",
            "Deep-cycle tubular design",
            "60-month warranty (36 free + 24 pro-rata)",
            "Low maintenance — topping every 4 months",
            "Corrosion-resistant HADI casting",
        ],
        warranty_info={"Product Warranty": "60 months (36 free + 24 pro-rata)"},
        images=["https://images.unsplash.com/photo-1626195829255-ff48c1c9692c?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="Luminous Lithium-ion 5.12 kWh Solar Battery",
        category="battery",
        brand="Luminous",
        price=185000,
        sale_price=159000,
        stock=12,
        sku="LUM-LION-5120",
        short_description="5.12 kWh lithium-ion solar battery, 6000+ cycles, 10-year warranty.",
        description="Next-gen LiFePO4 battery — zero maintenance, 3× the lifespan of tubular, 90% depth-of-discharge. Wall-mountable, silent, and works seamlessly with Luminous NXG hybrid inverters.",
        product_highlights=[
            "5.12 kWh usable (LiFePO4)",
            "6000+ cycles @ 80% DoD",
            "10-year warranty",
            "Wall mounted, IP65, silent",
            "Built-in BMS with app monitoring",
        ],
        warranty_info={"Product Warranty": "10 years"},
        is_featured=True,
        images=["https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="Polycab 4mm² DC Solar Cable (Red + Black, 50m)",
        category="wire",
        brand="Polycab",
        price=4800,
        sale_price=3990,
        stock=200,
        sku="POL-SOLAR-4MM-50",
        short_description="UV-resistant 4mm² solar DC cable, 50m pair (red + black).",
        description="Copper conductor, TUV-certified, UV & ozone resistant XLPO insulation. Rated for 1500V DC — the ASR-recommended cable for all panel strings.",
        product_highlights=[
            "4mm² tinned copper conductor",
            "50m red + 50m black pair",
            "1500V DC rated, TUV certified",
            "UV, ozone, salt-mist resistant",
            "Ideal for 3kW–10kW installations",
        ],
        images=["https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="MC4 Solar Connector Pair (Pack of 10)",
        category="accessory",
        brand="Staubli-compatible",
        price=650,
        sale_price=499,
        stock=300,
        sku="MC4-PAIR-10",
        short_description="10 pairs of IP68 MC4 connectors for solar panel strings.",
        description="Industry-standard MC4 male+female connectors. IP68 rated, 1500V DC, 30A current. Crimps onto 4mm² and 6mm² solar cables.",
        product_highlights=[
            "10 male + 10 female pairs",
            "IP68 waterproof, UV resistant",
            "1500V DC / 30A rating",
            "Fits 4mm² and 6mm² cables",
        ],
        images=["https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="GI Mounting Structure for 1kW Solar System",
        category="accessory",
        brand="ASR Enterprises",
        price=5500,
        sale_price=4750,
        stock=80,
        sku="ASR-MS-1KW-GI",
        short_description="Pre-galvanized GI rooftop mounting kit for 2 panels (1 kW).",
        description="Heavy-duty GI rails, clamps and rafters pre-cut for a 1kW system. ASR's standard installation kit — survives Bihar monsoons for 20+ years.",
        product_highlights=[
            "Hot-dip galvanized rails (80 micron)",
            "Fits 2× 540W panels",
            "Includes mid clamps, end clamps, L-feet",
            "20-year structural warranty",
        ],
        is_featured=False,
        warranty_info={"Product Warranty": "20 years"},
        images=["https://images.unsplash.com/photo-1605980776566-0486c3ac7617?w=800&auto=format&fit=crop&q=60"],
    ),
    _p(
        name="ASR Annual Maintenance Contract (AMC)",
        category="service",
        brand="ASR Enterprises",
        price=2999,
        sale_price=2499,
        stock=999,
        sku="ASR-AMC-ANNUAL",
        short_description="Annual cleaning, inspection & performance monitoring — Bihar-wide.",
        description="Includes 4 scheduled cleanings, 2 performance audits, free emergency visit, priority WhatsApp support, and quarterly generation reports for any rooftop solar up to 10 kW.",
        product_highlights=[
            "4 scheduled panel cleanings / year",
            "2 performance & wiring audits",
            "1 emergency visit FREE",
            "Priority WhatsApp support",
            "Quarterly generation report (PDF)",
        ],
        is_featured=True,
        warranty_info={"Service Level": "72-hour response across Bihar"},
        images=["https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=60"],
    ),
]


async def main():
    db = get_db()
    existing = await db.products.count_documents({})
    if existing >= 5:
        print(f"Already have {existing} products — skipping seed.")
        return
    result = await db.products.insert_many(PRODUCTS)
    print(f"Seeded {len(result.inserted_ids)} products.")


if __name__ == "__main__":
    asyncio.run(main())
