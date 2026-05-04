#!/usr/bin/env python3
"""
validate_data.py — Validates public/data/archipelago.json against the full schema.

Validation rules (Requirements 12.4, 13.1–13.3):
  - Required top-level fields: regions, lenses, faros, islands, sources
  - regions and lenses must not be empty
  - Each Faro must have: id, hindex (>= 0), boost (all values > 0), afinidad (all values in [0,1])
  - Each Island must have: id, label, position (exactly 3 numeric coordinates)
  - Each island.faroId (if present) must reference an existing faro id

Exit code 0 on success, 1 on failure.
"""

import json
import sys
from pathlib import Path


def validate(data_path: str) -> list[str]:
    """
    Validate the archipelago JSON file at data_path.
    Returns a list of error messages (empty list means valid).
    """
    errors: list[str] = []

    # ── Load and parse ────────────────────────────────────────────────────────
    path = Path(data_path)
    if not path.exists():
        return [f"File not found: {data_path}"]

    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        return [f"Invalid JSON: {exc}"]

    if not isinstance(data, dict):
        return ["Root element must be a JSON object"]

    # ── Required top-level fields ─────────────────────────────────────────────
    required_fields = ["regions", "lenses", "faros", "islands", "sources"]
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required top-level field: '{field}'")

    if errors:
        # Cannot continue without the required fields
        return errors

    # ── regions and lenses must not be empty ──────────────────────────────────
    if not isinstance(data["regions"], list) or len(data["regions"]) == 0:
        errors.append("Field 'regions' must be a non-empty array")

    if not isinstance(data["lenses"], list) or len(data["lenses"]) == 0:
        errors.append("Field 'lenses' must be a non-empty array")

    # ── Validate faros ────────────────────────────────────────────────────────
    if not isinstance(data["faros"], list):
        errors.append("Field 'faros' must be an array")
    else:
        faro_ids: set[str] = set()
        for i, faro in enumerate(data["faros"]):
            prefix = f"faros[{i}]"

            if not isinstance(faro, dict):
                errors.append(f"{prefix}: must be an object")
                continue

            # id
            if "id" not in faro:
                errors.append(f"{prefix}: missing required field 'id'")
                faro_id = f"<unknown faro at index {i}>"
            else:
                faro_id = faro["id"]
                faro_ids.add(faro_id)

            # hindex >= 0
            if "hindex" not in faro:
                errors.append(f"faro '{faro_id}': missing required field 'hindex'")
            elif not isinstance(faro["hindex"], (int, float)):
                errors.append(f"faro '{faro_id}': 'hindex' must be a number, got {type(faro['hindex']).__name__}")
            elif faro["hindex"] < 0:
                errors.append(
                    f"faro '{faro_id}': 'hindex' must be >= 0, got {faro['hindex']}"
                )

            # boost: all values > 0
            if "boost" not in faro:
                errors.append(f"faro '{faro_id}': missing required field 'boost'")
            elif not isinstance(faro["boost"], dict):
                errors.append(f"faro '{faro_id}': 'boost' must be an object")
            else:
                for lens, value in faro["boost"].items():
                    if not isinstance(value, (int, float)):
                        errors.append(
                            f"faro '{faro_id}': boost['{lens}'] must be a number, got {type(value).__name__}"
                        )
                    elif value <= 0:
                        errors.append(
                            f"faro '{faro_id}': boost['{lens}'] must be > 0, got {value}"
                        )

            # afinidad: all values in [0, 1]
            if "afinidad" not in faro:
                errors.append(f"faro '{faro_id}': missing required field 'afinidad'")
            elif not isinstance(faro["afinidad"], dict):
                errors.append(f"faro '{faro_id}': 'afinidad' must be an object")
            else:
                for region, value in faro["afinidad"].items():
                    if not isinstance(value, (int, float)):
                        errors.append(
                            f"faro '{faro_id}': afinidad['{region}'] must be a number, got {type(value).__name__}"
                        )
                    elif not (0.0 <= value <= 1.0):
                        errors.append(
                            f"faro '{faro_id}': afinidad['{region}'] must be in [0, 1], got {value}"
                        )

    # ── Validate islands ──────────────────────────────────────────────────────
    if not isinstance(data["islands"], list):
        errors.append("Field 'islands' must be an array")
    else:
        # Build faro_ids set if faros were valid
        faro_ids_for_ref: set[str] = set()
        if isinstance(data["faros"], list):
            for faro in data["faros"]:
                if isinstance(faro, dict) and "id" in faro:
                    faro_ids_for_ref.add(faro["id"])

        for i, island in enumerate(data["islands"]):
            prefix = f"islands[{i}]"

            if not isinstance(island, dict):
                errors.append(f"{prefix}: must be an object")
                continue

            # id
            if "id" not in island:
                errors.append(f"{prefix}: missing required field 'id'")
                island_id = f"<unknown island at index {i}>"
            else:
                island_id = island["id"]

            # label
            if "label" not in island:
                errors.append(f"island '{island_id}': missing required field 'label'")

            # position: exactly 3 numeric coordinates
            if "position" not in island:
                errors.append(f"island '{island_id}': missing required field 'position'")
            elif not isinstance(island["position"], list):
                errors.append(f"island '{island_id}': 'position' must be an array")
            elif len(island["position"]) != 3:
                errors.append(
                    f"island '{island_id}': 'position' must have exactly 3 coordinates, "
                    f"got {len(island['position'])}"
                )
            else:
                for j, coord in enumerate(island["position"]):
                    if not isinstance(coord, (int, float)):
                        errors.append(
                            f"island '{island_id}': position[{j}] must be a number, "
                            f"got {type(coord).__name__}"
                        )

            # faroId (optional) must reference an existing faro
            if "faroId" in island:
                faro_ref = island["faroId"]
                if faro_ref not in faro_ids_for_ref:
                    errors.append(
                        f"island '{island_id}': faroId '{faro_ref}' does not reference "
                        f"an existing faro id"
                    )

    # ── Validate sources (basic check) ────────────────────────────────────────
    if not isinstance(data["sources"], list):
        errors.append("Field 'sources' must be an array")

    return errors


def main() -> int:
    data_path = sys.argv[1] if len(sys.argv) > 1 else "public/data/archipelago.json"

    print(f"Validating: {data_path}")
    errors = validate(data_path)

    if errors:
        print(f"\n✗ Validation failed with {len(errors)} error(s):\n")
        for error in errors:
            print(f"  • {error}")
        print()
        return 1

    print("✓ Validation passed — archipelago.json is valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
