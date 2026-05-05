#!/usr/bin/env python3
"""
parse_ris.py — Parse RIS files from OpenBibArt and extract citation counts per author.

Usage:
    python scripts/parse_ris.py [file1.ris file2.ris ...]

Defaults to ris-2026-05-04T22_38_47Z.ris if no arguments are given.

Output: citations.json with structure:
    {
      "generated_at": "...",
      "source_files": [...],
      "authors": {
        "Benjamin, Walter": {
          "faro_id": "benjamin",
          "citation_count": 23,
          "records": ["oba_1102949", ...]
        }
      }
    }

Exit code 0 on success.
"""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Thinker map: normalized author name → faro ID
# ---------------------------------------------------------------------------
THINKER_MAP: dict[str, str] = {
    "Benjamin, Walter": "benjamin",
    "BENJAMIN, Walter": "benjamin",
    "Benjamin, W.": "benjamin",
    "Heidegger, Martin": "heidegger",
    "Deleuze, Gilles": "deleuze",
    "Sontag, Susan": "sontag",
    "Agamben, Giorgio": "agamben",
    "Mbembe, Achille": "mbembe",
    "Saito, Yuriko": "saito",
    "Senghor, Léopold Sédar": "senghor",
    "Senghor, Leopold Sedar": "senghor",
    "Abhinavagupta": "abhinavagupta",
    "Shusterman, Richard": "shusterman",
    "Manovich, Lev": "manovich",
    "Herzog, Werner": "herzog",
}


def normalize_author(raw: str) -> str:
    """
    Normalize an author name from RIS format to title case.

    Examples:
        "KENEDY, R. C."  → "Kenedy, R. C."
        "BENJAMIN, Walter" → "Benjamin, Walter"
        "Lowy, Michael"  → "Lowy, Michael"  (already normalized)
    """
    raw = raw.strip()
    if not raw:
        return raw

    # Split on first comma to separate surname from given name(s)
    parts = raw.split(",", 1)
    if len(parts) == 2:
        surname = parts[0].strip()
        given = parts[1].strip()

        # Title-case the surname (handles hyphenated names like "SMITH-JONES")
        surname_tc = "-".join(word.capitalize() for word in surname.split("-"))

        # For the given name part, title-case each word but preserve initials
        # e.g. "R. C." stays "R. C.", "WALTER" → "Walter"
        given_words = given.split()
        given_tc_words = []
        for word in given_words:
            # Strip trailing period for check
            core = word.rstrip(".")
            if len(core) == 1:
                # Single letter initial — keep as-is (already uppercase)
                given_tc_words.append(word.upper())
            else:
                given_tc_words.append(word.capitalize())
        given_tc = " ".join(given_tc_words)

        return f"{surname_tc}, {given_tc}"
    else:
        # No comma — single name (e.g. "Abhinavagupta", "MICHELANGELO")
        # Title-case each word
        return " ".join(word.capitalize() for word in raw.split())


def extract_oba_record(n1_value: str) -> str | None:
    """
    Extract the OpenBibArt record number from an N1 field value.

    The N1 field looks like:
        "OpenBibArt record number oba_1102949"
    or may contain additional text after the record number.
    """
    match = re.search(r"oba_\d+", n1_value)
    return match.group(0) if match else None


def parse_ris_file(path: Path) -> list[dict]:
    """
    Parse a single RIS file and return a list of record dicts.

    Each record dict has:
        "authors": list of raw AU field values
        "record_id": str | None  (OpenBibArt oba_XXXXXXX)

    Handles both traditional multi-line RIS and the single-line format used by
    OpenBibArt, where fields are separated by spaces rather than newlines.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="latin-1")

    records = []

    # Split on "ER -" to get individual records.
    raw_records = re.split(r"ER\s+-", text)

    # Pattern to extract a field value: stops at the next RIS tag or end of string.
    # Works for both space-separated (single-line) and newline-separated formats.
    # A RIS tag is a 2-char uppercase code followed by optional spaces and " - ".
    FIELD_VALUE_RE = re.compile(
        r"\b([A-Z][A-Z0-9])\s+-\s+(.+?)(?=\s+[A-Z][A-Z0-9]\s+-|\Z)"
    )

    for raw in raw_records:
        raw = raw.strip()
        if not raw:
            continue

        authors: list[str] = []
        record_id: str | None = None

        for match in FIELD_VALUE_RE.finditer(raw):
            tag = match.group(1)
            value = match.group(2).strip()

            if tag == "AU":
                # In multi-line RIS, value may have continuation lines; take first line
                au_value = value.split("\n")[0].strip()
                if au_value:
                    authors.append(au_value)
            elif tag == "N1":
                n1_value = value.split("\n")[0].strip()
                record_id = extract_oba_record(n1_value)

        records.append({"authors": authors, "record_id": record_id})

    return records


def build_citations(records: list[dict]) -> dict[str, dict]:
    """
    Build the authors citation dict from parsed records.

    Returns:
        {
            "Normalized Name": {
                "faro_id": str | None,
                "citation_count": int,
                "records": [str, ...]
            }
        }
    """
    authors: dict[str, dict] = {}

    for record in records:
        record_id = record.get("record_id")
        for raw_author in record.get("authors", []):
            normalized = normalize_author(raw_author)
            if not normalized:
                continue

            if normalized not in authors:
                faro_id = THINKER_MAP.get(normalized)
                authors[normalized] = {
                    "faro_id": faro_id,
                    "citation_count": 0,
                    "records": [],
                }

            authors[normalized]["citation_count"] += 1
            if record_id and record_id not in authors[normalized]["records"]:
                authors[normalized]["records"].append(record_id)

    return authors


def main() -> int:
    # Determine input files
    if len(sys.argv) > 1:
        file_paths = [Path(p) for p in sys.argv[1:]]
    else:
        file_paths = [Path("ris-2026-05-04T22_38_47Z.ris")]

    # Validate that all files exist
    missing = [str(p) for p in file_paths if not p.exists()]
    if missing:
        print(f"Error: file(s) not found: {', '.join(missing)}", file=sys.stderr)
        return 1

    # Parse all files
    all_records: list[dict] = []
    for path in file_paths:
        print(f"Parsing: {path}")
        records = parse_ris_file(path)
        all_records.extend(records)
        print(f"  → {len(records)} records found")

    # Build citation counts
    authors = build_citations(all_records)

    # Count faros matched
    faros_matched = sum(1 for a in authors.values() if a["faro_id"] is not None)

    # Build output
    output = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_files": [str(p) for p in file_paths],
        "authors": authors,
    }

    # Write citations.json
    output_path = Path("citations.json")
    output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    # Print summary
    print(f"\nSummary:")
    print(f"  Total records parsed : {len(all_records)}")
    print(f"  Authors found        : {len(authors)}")
    print(f"  Faros matched        : {faros_matched}")
    print(f"\nOutput written to: {output_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
