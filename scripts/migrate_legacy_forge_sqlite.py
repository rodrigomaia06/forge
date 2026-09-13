#!/usr/bin/env python3
"""Convert a read-only Forge Swift/Core Data SQLite database into Forge JSON."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
import sys
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any


APPLE_REFERENCE_SECONDS = 978_307_200
CURRENT_TYPE_NAMES = {
    "strength": ("strength", "Strength"),
    "court sports": ("court-sport", "Court sport"),
    "court sport": ("court-sport", "Court sport"),
    "martial arts": ("martial-arts", "Martial arts"),
    "cardio": ("cardio", "Cardio"),
    "mobility": ("mobility", "Mobility"),
}
SET_TAGS = {"dropset": "Drop Set", "failure": "Failure", "backoff": "Back-Off", "warmup": "Warm Up"}


def text_id(value: Any) -> str:
    if isinstance(value, bytes) and len(value) == 16:
        return str(uuid.UUID(bytes=value))
    if isinstance(value, bytes):
        return value.hex()
    return str(value or "")


def optional_text(value: Any) -> str | None:
    value = str(value or "").strip()
    return value or None


def parse_json(value: Any, fallback: Any) -> Any:
    if not isinstance(value, str) or not value.strip():
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def normalized(value: Any) -> str:
    return "".join(character for character in str(value or "").lower() if character.isalnum())


def apple_millis(value: Any) -> int:
    return round((float(value) + APPLE_REFERENCE_SECONDS) * 1000)


def value_text(value: Any) -> str:
    if value is None:
        return ""
    number = float(value)
    return str(int(number)) if number.is_integer() else str(number)


def interval_text(minimum: Any, maximum: Any) -> str:
    if minimum is None and maximum is None:
        return ""
    if minimum is None:
        return value_text(maximum)
    if maximum is None or float(minimum) == float(maximum):
        return value_text(minimum)
    return f"{value_text(minimum)}–{value_text(maximum)}"


def clean_attributes(raw: Any) -> dict[str, str] | None:
    value = parse_json(raw, {})
    if not isinstance(value, dict):
        return None
    cleaned = {
        str(label).strip().rstrip(":").strip(): str(content or "").strip()
        for label, content in value.items()
        if str(label).strip().rstrip(":").strip()
    }
    return cleaned or None


def dedupe_targets(targets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_kind: dict[str, dict[str, Any]] = {}
    for target in targets:
        if target["kind"] not in by_kind:
            by_kind[target["kind"]] = target
    return list(by_kind.values())


def target(row: sqlite3.Row, prefix: str, owner_id: str) -> dict[str, Any]:
    return {
        "id": text_id(row["ZUUID"]) or f"{owner_id}-{row['ZKIND']}-target",
        "kind": row["ZKIND"],
        "unit": row["ZUNIT"],
        **({"minValue": row[f"{prefix}MINVALUE"]} if row[f"{prefix}MINVALUE"] is not None else {}),
        **({"maxValue": row[f"{prefix}MAXVALUE"]} if row[f"{prefix}MAXVALUE"] is not None else {}),
    }


def scalar_target(owner_id: str, kind: str, unit: str, minimum: Any, maximum: Any) -> dict[str, Any] | None:
    if minimum is None and maximum is None:
        return None
    return {
        "id": f"{owner_id}-{kind}-legacy-target",
        "kind": kind,
        "unit": unit,
        **({"minValue": minimum} if minimum is not None else {}),
        **({"maxValue": maximum} if maximum is not None else {}),
    }


def tracking_type(definition: sqlite3.Row | None, assisted: bool = False, measurement_kinds: set[str] | None = None) -> str:
    kinds = measurement_kinds or set()
    metric = str(definition["ZDEFAULTMETRIC"] if definition else "reps").lower()
    load_mode = str(definition["ZLOADMODETITLE"] if definition else "").lower()
    if "distance" in kinds and "duration" in kinds:
        return "distance-duration"
    if "distance" in kinds and "weight" in kinds:
        return "weight-distance"
    if "duration" in kinds and "weight" in kinds:
        return "duration-weight"
    if metric in {"duration", "time"} or "duration" in kinds:
        return "duration"
    if metric == "distance" or "distance" in kinds:
        return "weight-distance" if "weight" in kinds else "distance-duration"
    if assisted:
        return "assisted-bodyweight"
    if "addedWeight" in kinds:
        return "weighted-bodyweight"
    if "bodyweight" in load_mode or "body weight" in load_mode:
        return "bodyweight-reps"
    return "weight-reps" if "weight" in kinds else "reps-only"


def snapshot(definition: sqlite3.Row, exercise_id: str | None, mode: str) -> dict[str, Any]:
    equipment = parse_json(definition["ZEQUIPMENTJSON"], [])
    equipment = [str(item) for item in equipment if str(item).strip()] if isinstance(equipment, list) else []
    if not equipment and optional_text(definition["ZEQUIPMENTTITLE"]):
        equipment = [str(definition["ZEQUIPMENTTITLE"])]
    primary = parse_json(definition["ZPRIMARYMUSCLESJSON"], [])
    secondary = parse_json(definition["ZSECONDARYMUSCLESJSON"], [])
    categories = parse_json(definition["ZACTIVITYCATEGORIESJSON"], [])
    return {
        **({"id": exercise_id} if exercise_id else {}),
        "name": str(definition["ZTITLE"]),
        "trackingType": mode,
        "familyId": optional_text(definition["ZMOVEMENTID"]),
        "group": optional_text(definition["ZMOVEMENTTITLE"]) or str(definition["ZTITLE"]),
        "variation": optional_text(definition["ZVARIATIONTITLE"]),
        "equipment": equipment,
        "primaryEquipment": equipment[0] if equipment else None,
        "category": str(categories[0]) if isinstance(categories, list) and categories else None,
        "primaryMuscle": str(primary[0]) if isinstance(primary, list) and primary else None,
        "secondaryMuscles": [str(item) for item in secondary] if isinstance(secondary, list) else [],
    }


def compact(record: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in record.items() if value is not None and value != [] and value != ""}


def legacy_tag(value: Any) -> str | None:
    key = normalized(value)
    return SET_TAGS.get(key) or optional_text(value)


def default_settings(workout_types: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "appearance": "system", "units": "metric", "bodyweightKg": 0, "weekStartsOn": 1,
        "showRestTimer": True, "defaultRestSeconds": 90, "keepRestTimerRunning": True,
        "restTimerSound": True, "restTimerHaptic": True, "unfinishedWorkoutReminderEnabled": False,
        "unfinishedWorkoutReminderDelay": 1800, "exerciseRestSeconds": {}, "workoutTypes": workout_types,
        "dailyMeasurementDefinitions": [], "dailyMeasurementEntries": [],
    }


def convert(source: Path) -> tuple[dict[str, Any], dict[str, int]]:
    connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    rows = lambda table: connection.execute(f"SELECT * FROM {table} ORDER BY Z_PK").fetchall()
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    required = {"ZWORKOUT", "ZWORKOUTSET", "ZWORKOUTROUTINE", "ZEXERCISEDEFINITION"}
    if not required.issubset(tables):
        raise ValueError("This is not a compatible legacy Forge Core Data SQLite database.")

    definitions = {row["Z_PK"]: row for row in rows("ZEXERCISEDEFINITION")}
    legacy_types = {row["Z_PK"]: row for row in rows("ZWORKOUTTYPE")}
    plans = {row["Z_PK"]: row for row in rows("ZWORKOUTPLAN")}
    routines = {row["Z_PK"]: row for row in rows("ZWORKOUTROUTINE")}
    catalog = json.loads((Path(__file__).parents[1] / "src/data/catalog/forge_exercise_catalog_v3_flat.json").read_text())["exercises"]
    by_name = {normalized(item["name"]): item for item in catalog}
    by_alias = {normalized(alias): item for item in catalog for alias in item.get("aliases", [])}
    by_movement = {normalized(item["movementPattern"]): item for item in catalog}

    def catalog_match(definition: sqlite3.Row) -> dict[str, Any] | None:
        return by_name.get(normalized(definition["ZTITLE"])) or by_alias.get(normalized(definition["ZTITLE"])) or by_movement.get(normalized(definition["ZMOVEMENTID"]))

    extra_types: list[dict[str, Any]] = []
    type_names: dict[int, str] = {}
    for primary_key, item in legacy_types.items():
        legacy_name = str(item["ZTITLE"])
        current = CURRENT_TYPE_NAMES.get(legacy_name.lower())
        if current:
            type_names[primary_key] = current[1]
        else:
            type_names[primary_key] = legacy_name
            extra_types.append(compact({
                "id": text_id(item["ZUUID"]), "name": legacy_name, "color": optional_text(item["ZCOLORHEX"]) or "#9CA3AF",
                "source": "custom", "hidden": bool(item["ZISARCHIVED"]),
            }))

    custom_rows = rows("ZCUSTOMEXERCISE")
    custom_by_title = {str(row["ZTITLE"]): text_id(row["ZUUID"]) for row in custom_rows}
    custom_exercises = []
    for item in custom_rows:
        definition = next((row for row in definitions.values() if str(row["ZTITLE"]) == str(item["ZTITLE"]) and row["ZSOURCE"] == "custom"), None)
        mode = tracking_type(definition)
        raw_equipment = parse_json(item["ZEQUIPMENTJSON"], [])
        equipment = [str(value) for value in raw_equipment] if isinstance(raw_equipment, list) else []
        muscles = parse_json(item["ZPRIMARYMUSCLESJSON"], [])
        secondary = parse_json(item["ZSECONDARYMUSCLESJSON"], [])
        categories = parse_json(item["ZACTIVITYCATEGORIESJSON"], [])
        custom_exercises.append(compact({
            "id": text_id(item["ZUUID"]), "name": str(item["ZTITLE"]),
            "familyId": optional_text(item["ZMOVEMENTID"]), "group": optional_text(item["ZMOVEMENTTITLE"]) or str(item["ZTITLE"]),
            "equipment": optional_text(item["ZEQUIPMENTTITLE"]) or "Unspecified", "equipmentIds": equipment,
            "primaryEquipment": equipment[0] if equipment else None, "variation": optional_text(item["ZVARIATIONTITLE"]),
            "category": str(categories[0]) if isinstance(categories, list) and categories else "custom",
            "primaryMuscle": str(muscles[0]) if isinstance(muscles, list) and muscles else "unspecified",
            "secondaryMuscles": [str(value) for value in secondary] if isinstance(secondary, list) else [],
            "aliases": [], "workoutTypeIds": ["strength"], "trackingType": mode,
            "movementPattern": optional_text(item["ZMOVEMENTID"]) or "custom",
        }))

    measurements_by_set: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for item in rows("ZSETMEASUREMENT"):
        measurements_by_set[item["ZWORKOUTSET"]].append(item)
    targets_by_set: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for item in rows("ZSETTARGET"):
        targets_by_set[item["ZWORKOUTSET"]].append(item)
    routine_targets_by_set: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for item in rows("ZROUTINESETTARGET"):
        routine_targets_by_set[item["ZWORKOUTROUTINESET"]].append(item)
    sets_by_exercise: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for item in rows("ZWORKOUTSET"):
        sets_by_exercise[item["ZWORKOUTEXERCISE"]].append(item)
    routine_sets_by_exercise: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for item in rows("ZWORKOUTROUTINESET"):
        routine_sets_by_exercise[item["ZWORKOUTROUTINEEXERCISE"]].append(item)
    workout_exercises_by_workout: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for item in rows("ZWORKOUTEXERCISE"):
        workout_exercises_by_workout[item["ZWORKOUT"]].append(item)
    routine_exercises_by_routine: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for item in rows("ZWORKOUTROUTINEEXERCISE"):
        routine_exercises_by_routine[item["ZWORKOUTROUTINE"]].append(item)

    def convert_set(item: sqlite3.Row, definition: sqlite3.Row, assisted: bool) -> dict[str, Any]:
        identifier = text_id(item["ZUUID"])
        measurement_rows = measurements_by_set[item["Z_PK"]]
        kinds = {str(measurement["ZKIND"]) for measurement in measurement_rows}
        mode = tracking_type(definition, assisted, kinds)
        measurements = [compact({"id": text_id(measurement["ZUUID"]), "kind": measurement["ZKIND"], "unit": measurement["ZUNIT"], "value": measurement["ZVALUE"]}) for measurement in measurement_rows]
        existing = {measurement["kind"] for measurement in measurements}
        for kind, unit, value in (("reps", "count", item["ZREPETITIONS"]), ("addedWeight", "kg", item["ZADDEDWEIGHT"]), ("weight", "kg", item["ZWEIGHT"]), ("distance", "km", item["ZDISTANCE"]), ("duration", "sec", item["ZDURATION"])):
            if value is not None and kind not in existing:
                measurements.append({"id": f"{identifier}-{kind}", "kind": kind, "unit": unit, "value": value})
                existing.add(kind)
        if item["ZRPE"] not in (None, 0) and "rpe" not in existing:
            measurements.append({"id": f"{identifier}-rpe", "kind": "rpe", "unit": "rpe", "value": item["ZRPE"]})
        targets = [target(row, "Z", identifier) for row in targets_by_set[item["Z_PK"]]]
        for kind, unit, minimum, maximum in (("reps", "count", item["ZMINTARGETREPETITIONS"], item["ZMAXTARGETREPETITIONS"]), ("duration", "sec", item["ZMINTARGETDURATION"], item["ZMAXTARGETDURATION"]), ("distance", "km", item["ZTARGETDISTANCE"], item["ZTARGETDISTANCE"]), ("weight", "kg", item["ZTARGETWEIGHT"], item["ZTARGETWEIGHT"])):
            candidate = scalar_target(identifier, kind, unit, minimum, maximum)
            if candidate: targets.append(candidate)
        targets = dedupe_targets(targets)
        by_kind = {entry["kind"]: entry for entry in targets}
        return compact({
            "id": identifier, "weight": value_text(item["ZADDEDWEIGHT"] if item["ZADDEDWEIGHT"] is not None else item["ZWEIGHT"]),
            "reps": value_text(item["ZREPETITIONS"]), "tag": legacy_tag(item["ZTAG"]), "comment": optional_text(item["ZCOMMENT"]),
            "completed": bool(item["ZISCOMPLETED"]), "measurements": measurements, "targets": targets,
            "targetWeight": interval_text(by_kind["weight"].get("minValue"), by_kind["weight"].get("maxValue")) if "weight" in by_kind else None,
            "targetReps": interval_text(by_kind["reps"].get("minValue"), by_kind["reps"].get("maxValue")) if "reps" in by_kind else None,
            "_trackingType": mode,
        })

    def convert_workout_exercise(item: sqlite3.Row) -> dict[str, Any]:
        definition = definitions[item["ZEXERCISEDEFINITION"]]
        converted_sets = [convert_set(row, definition, bool(item["ZASSISTED"])) for row in sets_by_exercise[item["Z_PK"]]]
        mode = next((entry.pop("_trackingType") for entry in converted_sets if "_trackingType" in entry), tracking_type(definition, bool(item["ZASSISTED"])))
        matched = catalog_match(definition)
        exercise_id = custom_by_title.get(str(definition["ZTITLE"])) if definition["ZSOURCE"] == "custom" else (matched or {}).get("id")
        return compact({
            "id": text_id(item["ZUUID"]), "exerciseId": exercise_id, "name": str(definition["ZTITLE"]),
            "note": optional_text(item["ZCOMMENT"]), "supersetId": text_id(item["ZSUPERSETUUID"]) or None,
            "metric": optional_text(item["ZMETRIC"]), "trackingType": mode,
            "exerciseSnapshot": compact(snapshot(definition, exercise_id, mode)), "sets": converted_sets,
        })

    def routine_targets(item: sqlite3.Row, identifier: str) -> list[dict[str, Any]]:
        values = [target(row, "Z", identifier) for row in routine_targets_by_set[item["Z_PK"]]]
        for kind, unit, minimum, maximum in (("reps", "count", item["ZMINREPETITIONS"], item["ZMAXREPETITIONS"]), ("duration", "sec", item["ZMINTARGETDURATION"], item["ZMAXTARGETDURATION"]), ("distance", "km", item["ZTARGETDISTANCE"], item["ZTARGETDISTANCE"])):
            candidate = scalar_target(identifier, kind, unit, minimum, maximum)
            if candidate: values.append(candidate)
        return dedupe_targets(values)

    def convert_routine_exercise(item: sqlite3.Row) -> dict[str, Any]:
        definition = definitions[item["ZEXERCISEDEFINITION"]]
        matched = catalog_match(definition)
        exercise_id = custom_by_title.get(str(definition["ZTITLE"])) if definition["ZSOURCE"] == "custom" else (matched or {}).get("id")
        mode = tracking_type(definition, bool(item["ZASSISTED"]))
        converted_sets = []
        for row in routine_sets_by_exercise[item["Z_PK"]]:
            identifier = text_id(row["ZUUID"])
            converted_sets.append(compact({
                "id": identifier, "weight": "", "reps": "", "tag": legacy_tag(row["ZTAG"]),
                "comment": optional_text(row["ZCOMMENT"]), "plannedTargets": routine_targets(row, identifier),
            }))
        return compact({
            "id": text_id(item["ZUUID"]), "exerciseId": exercise_id, "name": str(definition["ZTITLE"]),
            "note": optional_text(item["ZCOMMENT"]), "supersetId": text_id(item["ZSUPERSETUUID"]) or None,
            "metric": optional_text(item["ZMETRIC"]), "trackingType": mode,
            "exerciseSnapshot": compact(snapshot(definition, exercise_id, mode)), "sets": converted_sets,
        })

    converted_routines: dict[int, dict[str, Any]] = {}
    for primary_key, item in routines.items():
        plan = plans.get(item["ZWORKOUTPLAN"])
        converted_routines[primary_key] = compact({
            "id": text_id(item["ZUUID"]), "name": str(item["ZTITLE"]),
            "type": type_names.get(item["ZDEFAULTWORKOUTTYPE"], "Strength"), "note": optional_text(item["ZCOMMENT"]),
            "attributes": clean_attributes(item["ZCUSTOMATTRIBUTESJSON"]),
            "exercises": [convert_routine_exercise(exercise) for exercise in routine_exercises_by_routine[primary_key]],
            "planId": text_id(plan["ZUUID"]) if plan else None, "createdAt": 0, "updatedAt": 0,
        })

    converted_plans = []
    for primary_key, item in plans.items():
        identifier = text_id(item["ZUUID"])
        converted_plans.append({
            "id": identifier, "name": str(item["ZTITLE"]),
            "routines": [routine for routine in converted_routines.values() if routine.get("planId") == identifier],
            "createdAt": 0, "updatedAt": 0,
        })
    standalone_routines = [routine for routine in converted_routines.values() if not routine.get("planId")]

    completed_workouts = []
    skipped_active = 0
    for item in rows("ZWORKOUT"):
        if item["ZISCURRENTWORKOUT"]:
            skipped_active += 1
            continue
        routine = routines.get(item["ZWORKOUTROUTINE"])
        plan = plans.get(routine["ZWORKOUTPLAN"]) if routine else None
        start = apple_millis(item["ZSTART"])
        end = apple_millis(item["ZEND"])
        completed_workouts.append(compact({
            "id": text_id(item["ZUUID"]), "name": optional_text(item["ZTITLE"]) or (str(routine["ZTITLE"]) if routine else "Workout"),
            "type": type_names.get(item["ZWORKOUTTYPE"], "Strength"), "startedAt": start, "completedAt": end,
            "durationSeconds": max(0, round((end - start) / 1000)), "automaticTimeTracking": False,
            "note": optional_text(item["ZCOMMENT"]) or "", "attributes": clean_attributes(item["ZCUSTOMATTRIBUTESJSON"]),
            "routineId": text_id(routine["ZUUID"]) if routine else None, "planId": text_id(plan["ZUUID"]) if plan else None,
            "exercises": [convert_workout_exercise(exercise) for exercise in workout_exercises_by_workout[item["Z_PK"]]],
        }))

    transfer = {
        "format": "forge-data", "version": 1, "exportedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "settings": default_settings(extra_types), "plans": {"plans": converted_plans, "standaloneRoutines": standalone_routines},
        "workouts": {"activeWorkout": None, "completedWorkouts": completed_workouts}, "customExercises": custom_exercises,
        "selection": {"workouts": True, "plans": True, "exercises": True, "workoutTypes": True, "measurements": True},
    }
    stats = {"completed_workouts": len(completed_workouts), "skipped_active_workouts": skipped_active, "plans": len(converted_plans), "routines": len(converted_routines), "custom_exercises": len(custom_exercises)}
    connection.close()
    return transfer, stats


def validate(transfer: dict[str, Any]) -> None:
    if transfer.get("format") != "forge-data" or transfer.get("version") != 1:
        raise ValueError("Generated transfer has an invalid Forge JSON envelope.")
    workouts = transfer["workouts"]["completedWorkouts"]
    if transfer["workouts"]["activeWorkout"] is not None:
        raise ValueError("Legacy active workouts must not be present in this migration.")
    if len({workout["id"] for workout in workouts}) != len(workouts):
        raise ValueError("Generated transfer contains duplicate workout IDs.")
    routine_ids = {routine["id"] for plan in transfer["plans"]["plans"] for routine in plan["routines"]}
    routine_ids.update(routine["id"] for routine in transfer["plans"]["standaloneRoutines"])
    if any(workout.get("routineId") and workout["routineId"] not in routine_ids for workout in workouts):
        raise ValueError("A generated workout references a routine that was not migrated.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Legacy Forge Core Data .sqlite file")
    parser.add_argument("output", type=Path, help="Destination Forge JSON file")
    args = parser.parse_args()
    transfer, stats = convert(args.source)
    validate(transfer)
    args.output.write_text(json.dumps(transfer, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Migration created:", args.output, file=sys.stderr)
    for key, value in stats.items():
        print(f"{key.replace('_', ' ')}: {value}", file=sys.stderr)


if __name__ == "__main__":
    main()
