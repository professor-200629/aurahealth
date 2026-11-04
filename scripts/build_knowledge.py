"""Build packs/knowledge/medlineplus_en.json: a small, offline evidence pack for Talk to Aura.

Run from the project root:  uv run --no-project python scripts/build_knowledge.py
Downloads about 150 small records (about 1 MB in all) from the MedlinePlus health topics web service, at most one
request a second (NLM asks for no more than 85 a minute). Only topic summaries are kept: MedlinePlus says these are
public domain, unlike its A.D.A.M. encyclopedia and drug monographs, which must never be added here.
https://medlineplus.gov/about/using/usingcontent/  https://medlineplus.gov/about/developers/webservices/
Attribute MedlinePlus. Do not use its logo and do not imply that it endorses AuraHealth.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "packs" / "knowledge" / "medlineplus_en.json"
API = "https://wsearch.nlm.nih.gov/ws/query"

# What to fetch: words to search for, chosen to cover common concerns at home in India and the high-risk groups.
QUERIES = """
Headache|Migraine|Fever|Dizziness and Vertigo|Fatigue|Cough|Back Pain|Neck Pain|Knee Injuries and Disorders|Joint Disorders
Muscle Cramps|Abdominal Pain|Nausea and Vomiting|Diarrhea|Constipation|Heartburn|Gas|Indigestion|Hemorrhoids|Dehydration
Sore Throat|Common Cold|Flu|COVID-19|Allergy|Food Allergy|Hay Fever|Rashes|Itching|Hives|Sleep Disorders|Insomnia
Anemia|Hepatitis|Hepatitis A|Hepatitis B|Liver Diseases|Malaria|Dengue|Typhoid Fever|Tuberculosis|Chikungunya
Urinary Tract Infections|Kidney Stones|Chronic Kidney Disease|Kidney Failure|Diabetes|Diabetes Type 2|Diabetes Type 1
Prediabetes|Diabetic Diet|Hypoglycemia|Hyperglycemia|A1C|Blood Glucose|High Blood Pressure|Low Blood Pressure
Heart Attack|Heart Failure|Heart Diseases|Chest Pain|Arrhythmia|Cholesterol|Cholesterol Levels|LDL: The "Bad" Cholesterol|HDL: The "Good" Cholesterol
Stroke|Asthma|COPD|Pneumonia|Bronchitis|Shortness of Breath|Seizures|Epilepsy|Dementia|Alzheimer's Disease|Parkinson's Disease
Falls|Osteoporosis|Osteoarthritis|Rheumatoid Arthritis|Gout|Thyroid Diseases|Hypothyroidism|Hyperthyroidism|Thyroid Tests
Depression|Anxiety|Panic Disorder|Suicide|Stress|Alcohol Use Disorder|Smoking|Grief|Mental Disorders
Periods|Menstruation|Menopause|Pregnancy|Pregnancy and Medicines|Birth Control|Polycystic Ovary Syndrome|Vaginal Diseases|Breastfeeding
Infant and Newborn Care|Children's Health|Childhood Immunization|Older Adult Health|Medicines|Medication Errors|Pain Relievers
Antibiotics|Drug Reactions|Over-the-Counter Medicines|Blood Thinners|Blood Pressure Medicines|Cancer|Breast Cancer|Cervical Cancer
Peptic Ulcer|Appendicitis|Gallstones|Food Poisoning|Heat Illness|Animal Bites|Rabies|Cuts and Puncture Wounds|Burns|Fractures
Sprains and Strains|Head Injuries|Nosebleeds|Eye Infections|Cataract|Tooth Disorders|Sepsis|Nutrition|Vitamin D|Vitamins|Iron
Exercise and Physical Fitness|Obesity|Blood Count Tests|Laboratory Tests|Liver Function Tests|Kidney Tests|Urinalysis
Vitamin B|Calcium|Chickenpox|Shingles|Fungal Infections|Scabies|Head Lice|Dry Mouth|Ear Infections|Sinusitis|Coronavirus Infections|Older Adults
""".replace("\n", "|").split("|")

BLOCK = re.compile(r"</?(p|li|ul|ol|br|div|h\d)\b[^>]*>", re.I)
TAG = re.compile(r"<[^>]+>")


def plain(summary: str) -> str:
    text = html.unescape(summary)
    text = TAG.sub("", BLOCK.sub(" ", text))
    text = " ".join(html.unescape(text).split())
    # US phone numbers do not belong in an India pilot: the app adds the right number itself.
    text = re.sub(r"\b(call|dial)\s+911\b", r"\1 your emergency number", text, flags=re.I)
    return re.sub(r"\b911\b", "your emergency number", text)


def fetch(query: str) -> dict | None:
    params = urllib.parse.urlencode({"db": "healthTopics", "term": query, "retmax": 5, "rettype": "brief", "tool": "aurahealth_knowledge_pack"})
    with urllib.request.urlopen(f"{API}?{params}", timeout=30) as resp:
        root = ET.fromstring(resp.read())
    best = None
    for doc in root.findall(".//document"):
        fields: dict[str, list[str]] = {}
        for node in doc.findall("content"):
            fields.setdefault(node.get("name") or "", []).append("".join(node.itertext()))
        title = plain(fields.get("title", [""])[0])
        summary = plain(fields.get("FullSummary", [""])[0])
        if not title or not summary:
            continue
        url = doc.get("url", "")
        topic = {
            "id": re.sub(r"[^a-z0-9]+", "-", url.rstrip("/").rsplit("/", 1)[-1].replace(".html", "").lower()),
            "title": title,
            "url": url,
            "groups": [plain(g) for g in fields.get("groupName", [])][:3],
            "also": sorted({plain(a) for a in fields.get("altTitle", []) if plain(a).lower() != title.lower()})[:8],
            "summary": summary,
        }
        if title.lower() == query.lower():  # the exact topic, if the search found it, beats a higher-ranked neighbour
            return topic
        best = best or topic
    return best


def main() -> int:
    topics: dict[str, dict] = {}
    missed: list[str] = []
    for query in dict.fromkeys(q.strip() for q in QUERIES if q.strip()):
        try:
            topic = fetch(query)
        except Exception as exc:  # one failed topic must not lose the others
            print(f"failed: {query}: {type(exc).__name__}", file=sys.stderr)
            missed.append(query)
            topic = None
        time.sleep(1.0)
        if topic:
            if topic["id"] not in topics:
                print(f"{query:36} -> {topic['title']} ({len(topic['summary'])} chars)")
            topics.setdefault(topic["id"], topic)
        else:
            missed.append(query)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pack = {
        "meta": {
            "source": "MedlinePlus, National Library of Medicine",
            "attribution": "Source: MedlinePlus, National Library of Medicine",
            "terms": "https://medlineplus.gov/about/using/usingcontent/",
            "kind": "Health topic summaries only (public domain according to MedlinePlus)",
            "retrieved": date.today().isoformat(),
            "region": "Written for the United States. Care, medicines and services in India can differ.",
            "review": "unreviewed",
            "review_note": "Published by NLM. No clinician has reviewed this pack for use in AuraHealth.",
            "not_found": sorted(set(missed)),
        },
        "topics": sorted(topics.values(), key=lambda t: t["title"]),
    }
    OUT.write_text(json.dumps(pack, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(topics)} topics, {OUT.stat().st_size // 1024} KB, not found: {sorted(set(missed))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
