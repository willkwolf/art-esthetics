#!/usr/bin/env python3
"""
validate_data.py — Validates public/data/cartografia.json against the v2 CartografiaData schema.

Validation rules (Requirements 12.5, 13.1):
  - Required root fields: version, lang, regiones, lentes, faros, archipielagos,
                          conexiones, tethers, fuentes
  - regiones, lentes, faros, archipielagos must be non-empty arrays
  - Each faro: citationCount >= 0, all boost values > 0, all afinidad values in [0,1],
               regionId must exist in regiones, lentes[] ids must exist in lentes
  - Each archipielago: regionId must exist in regiones, x and y in [0,1]
  - Each conexion: origen and destino must exist in faros
  - Each tether: archipielagoId must exist in archipielagos, faroId must exist in faros

Can be called as a function (from merge_weights.py) or as a CLI script.

Exit code 0 on success, 1 on failure.
"""

import json
import sys
from pathlib import Path


def validate(data) -> list[str]:
    """
    Validate a CartografiaData v2 object.

    Accepts either:
      - a str/Path pointing to a JSON file, or
      - a dict already loaded from JSON.

    Returns a list of error messages (empty list means valid).
    """
    errors: list[str] = []

    # ── Load from file if a path was given ────────────────────────────────────
    if isinstance(data, (str, Path)):
        path = Path(data)
        if not path.exists():
            return [f"File not found: {data}"]
        try:
            with path.open(encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            return [f"Invalid JSON: {exc}"]

    if not isinstance(data, dict):
        return ["Root element must be a JSON object"]

    # ── Required top-level fields ─────────────────────────────────────────────
    required_fields = [
        "version", "lang", "regiones", "lentes", "faros",
        "archipielagos", "conexiones", "tethers", "fuentes",
    ]
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required top-level field: '{field}'")

    if errors:
        # Cannot continue without the required fields
        return errors

    # ── Non-empty array checks ────────────────────────────────────────────────
    for field in ("regiones", "lentes", "faros", "archipielagos"):
        if not isinstance(data[field], list) or len(data[field]) == 0:
            errors.append(f"Field '{field}' must be a non-empty array")

    # Build lookup sets for cross-reference validation
    region_ids: set[str] = set()
    if isinstance(data["regiones"], list):
        for r in data["regiones"]:
            if isinstance(r, dict) and "id" in r:
                region_ids.add(r["id"])

    lente_ids: set[str] = set()
    if isinstance(data["lentes"], list):
        for l in data["lentes"]:
            if isinstance(l, dict) and "id" in l:
                lente_ids.add(l["id"])

    faro_ids: set[str] = set()
    if isinstance(data["faros"], list):
        for f in data["faros"]:
            if isinstance(f, dict) and "id" in f:
                faro_ids.add(f["id"])

    archipielago_ids: set[str] = set()
    if isinstance(data["archipielagos"], list):
        for a in data["archipielagos"]:
            if isinstance(a, dict) and "id" in a:
                archipielago_ids.add(a["id"])

    # ── Validate faros ────────────────────────────────────────────────────────
    if isinstance(data["faros"], list):
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

            # citationCount >= 0
            if "citationCount" not in faro:
                errors.append(f"faro '{faro_id}': missing required field 'citationCount'")
            elif not isinstance(faro["citationCount"], (int, float)):
                errors.append(
                    f"faro '{faro_id}': 'citationCount' must be a number, "
                    f"got {type(faro['citationCount']).__name__}"
                )
            elif faro["citationCount"] < 0:
                errors.append(
                    f"faro '{faro_id}': 'citationCount' must be >= 0, "
                    f"got {faro['citationCount']}"
                )

            # regionId must exist in regiones
            if "regionId" not in faro:
                errors.append(f"faro '{faro_id}': missing required field 'regionId'")
            elif faro["regionId"] not in region_ids:
                errors.append(
                    f"faro '{faro_id}': 'regionId' '{faro['regionId']}' "
                    f"does not reference an existing region"
                )

            # lentes[] must be a non-empty array of strings whose ids exist in lentes
            if "lentes" not in faro:
                errors.append(f"faro '{faro_id}': missing required field 'lentes'")
            elif not isinstance(faro["lentes"], list):
                errors.append(f"faro '{faro_id}': 'lentes' must be an array")
            elif len(faro["lentes"]) == 0:
                errors.append(f"faro '{faro_id}': 'lentes' must be a non-empty array")
            else:
                for lente_ref in faro["lentes"]:
                    if not isinstance(lente_ref, str):
                        errors.append(
                            f"faro '{faro_id}': lentes[] must contain strings, "
                            f"got {type(lente_ref).__name__}"
                        )
                    elif lente_ref not in lente_ids:
                        errors.append(
                            f"faro '{faro_id}': lentes[] contains '{lente_ref}' "
                            f"which does not reference an existing lente"
                        )

            # boost: all values > 0
            if "boost" not in faro:
                errors.append(f"faro '{faro_id}': missing required field 'boost'")
            elif not isinstance(faro["boost"], dict):
                errors.append(f"faro '{faro_id}': 'boost' must be an object")
            else:
                for lens_key, value in faro["boost"].items():
                    if not isinstance(value, (int, float)):
                        errors.append(
                            f"faro '{faro_id}': boost['{lens_key}'] must be a number, "
                            f"got {type(value).__name__}"
                        )
                    elif value <= 0:
                        errors.append(
                            f"faro '{faro_id}': boost['{lens_key}'] must be > 0, got {value}"
                        )

            # afinidad: all values in [0, 1]
            if "afinidad" not in faro:
                errors.append(f"faro '{faro_id}': missing required field 'afinidad'")
            elif not isinstance(faro["afinidad"], dict):
                errors.append(f"faro '{faro_id}': 'afinidad' must be an object")
            else:
                for region_key, value in faro["afinidad"].items():
                    if not isinstance(value, (int, float)):
                        errors.append(
                            f"faro '{faro_id}': afinidad['{region_key}'] must be a number, "
                            f"got {type(value).__name__}"
                        )
                    elif not (0.0 <= value <= 1.0):
                        errors.append(
                            f"faro '{faro_id}': afinidad['{region_key}'] must be in [0, 1], "
                            f"got {value}"
                        )

            # x and y: numbers in [0, 1]
            for coord in ("x", "y"):
                if coord not in faro:
                    errors.append(
                        f"faro '{faro_id}': missing required field '{coord}'"
                    )
                elif not isinstance(faro[coord], (int, float)):
                    errors.append(
                        f"faro '{faro_id}': '{coord}' must be a number, "
                        f"got {type(faro[coord]).__name__}"
                    )
                elif not (0.0 <= faro[coord] <= 1.0):
                    errors.append(
                        f"faro '{faro_id}': '{coord}' must be in [0, 1], "
                        f"got {faro[coord]}"
                    )

    # ── Validate archipielagos ────────────────────────────────────────────────
    if isinstance(data["archipielagos"], list):
        for i, arch in enumerate(data["archipielagos"]):
            prefix = f"archipielagos[{i}]"

            if not isinstance(arch, dict):
                errors.append(f"{prefix}: must be an object")
                continue

            if "id" not in arch:
                errors.append(f"{prefix}: missing required field 'id'")
                arch_id = f"<unknown archipielago at index {i}>"
            else:
                arch_id = arch["id"]

            # regionId must exist in regiones
            if "regionId" not in arch:
                errors.append(f"archipielago '{arch_id}': missing required field 'regionId'")
            elif arch["regionId"] not in region_ids:
                errors.append(
                    f"archipielago '{arch_id}': 'regionId' '{arch['regionId']}' "
                    f"does not reference an existing region"
                )

            # x and y in [0, 1]
            for coord in ("x", "y"):
                if coord not in arch:
                    errors.append(
                        f"archipielago '{arch_id}': missing required field '{coord}'"
                    )
                elif not isinstance(arch[coord], (int, float)):
                    errors.append(
                        f"archipielago '{arch_id}': '{coord}' must be a number, "
                        f"got {type(arch[coord]).__name__}"
                    )
                elif not (0.0 <= arch[coord] <= 1.0):
                    errors.append(
                        f"archipielago '{arch_id}': '{coord}' must be in [0, 1], "
                        f"got {arch[coord]}"
                    )

    # ── Validate conexiones ───────────────────────────────────────────────────
    if not isinstance(data["conexiones"], list):
        errors.append("Field 'conexiones' must be an array")
    else:
        for i, conexion in enumerate(data["conexiones"]):
            prefix = f"conexiones[{i}]"

            if not isinstance(conexion, dict):
                errors.append(f"{prefix}: must be an object")
                continue

            for field in ("origen", "destino"):
                if field not in conexion:
                    errors.append(f"{prefix}: missing required field '{field}'")
                elif conexion[field] not in faro_ids:
                    errors.append(
                        f"{prefix}: '{field}' '{conexion[field]}' "
                        f"does not reference an existing faro"
                    )

    # ── Validate tethers ──────────────────────────────────────────────────────
    if not isinstance(data["tethers"], list):
        errors.append("Field 'tethers' must be an array")
    else:
        for i, tether in enumerate(data["tethers"]):
            prefix = f"tethers[{i}]"

            if not isinstance(tether, dict):
                errors.append(f"{prefix}: must be an object")
                continue

            if "archipielagoId" not in tether:
                errors.append(f"{prefix}: missing required field 'archipielagoId'")
            elif tether["archipielagoId"] not in archipielago_ids:
                errors.append(
                    f"{prefix}: 'archipielagoId' '{tether['archipielagoId']}' "
                    f"does not reference an existing archipielago"
                )

            if "faroId" not in tether:
                errors.append(f"{prefix}: missing required field 'faroId'")
            elif tether["faroId"] not in faro_ids:
                errors.append(
                    f"{prefix}: 'faroId' '{tether['faroId']}' "
                    f"does not reference an existing faro"
                )

    # ── Validate fuentes (basic check) ────────────────────────────────────────
    if not isinstance(data["fuentes"], list):
        errors.append("Field 'fuentes' must be an array")

    return errors


def main() -> int:
    data_path = sys.argv[1] if len(sys.argv) > 1 else "public/data/cartografia.json"

    print(f"Validating: {data_path}")
    errors = validate(data_path)

    if errors:
        print(f"\n✗ Validation failed with {len(errors)} error(s):\n")
        for error in errors:
            print(f"  • {error}")
        print()
        return 1

    print("✓ Validation passed — cartografia.json is valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
