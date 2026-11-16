"""Count enquiries by where the visitor first landed and where they enquired.

Shows whether guides lead to enquiries, either directly (the enquiry was sent
from a guide) or as an assist (the visitor first landed on a guide and enquired
later from another page). Also counts enquiries that came through the in-guide
quick check (their brief details start with "Quick check:").

Usage (run from the repo root, with a fresh CSV export of the enquiry sheet):
    python3 -I scripts/guide-assist.py leads/panoptic-enquiries-YYYY-MM-DD.csv

Only rows from 14 Nov 2026 onwards carry the attribution columns.
"""
import collections
import csv
import sys

GUIDES = (
    "is-it-normal-for-new-plaster-to-crack", "is-it-subsidence-or-settlement",
    "stepped-cracks-in-brickwork", "evidence-of-movement-on-a-survey",
    "does-home-insurance-cover-cracked-walls", "how-to-tell-if-a-wall-is-load-bearing",
    "chimney-breast-removal-party-wall", "guides",
)


def kind(path):
    path = (path or "").split("?")[0].strip("/").replace(".html", "")
    if not path:
        return "(home or blank)"
    return "guide" if path in GUIDES else path


rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig")))
rows = [r for r in rows if (r.get("Channel") or "").strip()]
print(f"{len(rows)} enquiries with attribution\n")

pairs = collections.Counter()
for r in rows:
    first = kind(r.get("First landing page"))
    sent = kind(r.get("Source page") or r.get("Session landing page"))
    pairs[(first, sent, r.get("Channel", ""))] += 1

print("first landing -> enquired from (channel): count")
for (first, sent, ch), n in pairs.most_common():
    print(f"  {first} -> {sent} ({ch}): {n}")

direct = sum(1 for r in rows if kind(r.get("Source page")) == "guide")
assist = sum(1 for r in rows if kind(r.get("First landing page")) == "guide"
             and kind(r.get("Source page")) != "guide")
quick = sum(1 for r in rows if (r.get("Brief details") or "").startswith("Quick check:"))
print(f"\nSent from a guide: {direct}")
print(f"First landed on a guide, enquired elsewhere: {assist}")
print(f"Came through the quick check: {quick}")
