import os
import json
import uuid
import shutil
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_RAW_DIR = os.path.join(BASE_DIR, "data_raw", "player_data")
DATA_PROCESSED_DIR = os.path.join(BASE_DIR, "data_processed")

MATCHES_DIR = os.path.join(DATA_PROCESSED_DIR, "matches")
MAPS_DIR = os.path.join(DATA_PROCESSED_DIR, "maps")
MANIFEST_PATH = os.path.join(DATA_PROCESSED_DIR, "manifest.json")

MAP_CONFIG: Dict[str, Dict[str, float]] = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift": {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown": {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

MINIMAP_SIZE_PX = 1024

# Path simplification for frontend rendering
SAMPLING_INTERVAL_SEC = 0.20
MIN_PATH_POINTS_PER_PLAYER = 2

# Snapshot retention thresholds
MIN_TOTAL_ROWS_TO_KEEP = 10

# Debug printing
ENABLE_TS_DEBUG = True


# ============================================================
# DATA MODELS
# ============================================================

@dataclass(frozen=True)
class QualityResult:
    tier: str
    score: int
    is_recommended: bool
    flags: List[str]


# ============================================================
# FILESYSTEM HELPERS
# ============================================================

def ensure_clean_output_dirs() -> None:
    """
    Recreate processed output directories from scratch.
    The user does NOT need to manually delete data_processed.
    """
    os.makedirs(DATA_PROCESSED_DIR, exist_ok=True)

    if os.path.exists(MATCHES_DIR):
        shutil.rmtree(MATCHES_DIR)
    if os.path.exists(MAPS_DIR):
        shutil.rmtree(MAPS_DIR)

    os.makedirs(MATCHES_DIR, exist_ok=True)
    os.makedirs(MAPS_DIR, exist_ok=True)


# ============================================================
# BASIC HELPERS
# ============================================================

def is_uuid(value: Any) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except Exception:
        return False


def classify_user(user_id: Any) -> str:
    return "human" if is_uuid(user_id) else "bot"


def decode_event(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    return str(value)


def normalize_event(event_name: str) -> Optional[str]:
    """
    Map raw event names from README to frontend-friendly normalized labels.
    Movement events return None because they are represented via player paths.
    """
    event_map = {
        "Position": None,
        "BotPosition": None,
        "Kill": "kill",
        "Killed": "death",
        "BotKill": "kill_bot",
        "BotKilled": "death_by_bot",
        "KilledByStorm": "storm_death",
        "Loot": "loot",
    }
    return event_map.get(event_name.strip(), None)


def sanitize_match_id(match_id: str) -> str:
    return str(match_id).replace(".nakama-0", "")


def extract_date_from_path(path: str) -> Optional[str]:
    parts = path.replace("\\", "/").split("/")
    for part in parts:
        if part.startswith("February_"):
            day = part.split("_")[-1]
            if day.isdigit():
                return f"2026-02-{int(day):02d}"
    return None


def round_pos(value: float) -> float:
    return round(float(value), 2)


def round_time(value: float) -> float:
    return round(float(value), 3)


# ============================================================
# MAP / COORDINATE HELPERS
# ============================================================

def map_coordinates(x: float, z: float, map_name: str) -> Tuple[float, float]:
    """
    Convert world coordinates to minimap pixel coordinates exactly as described
    in the README:
      u = (x - origin_x) / scale
      v = (z - origin_z) / scale
      px = u * 1024
      py = (1 - v) * 1024
    """
    config = MAP_CONFIG[map_name]

    u = (x - config["origin_x"]) / config["scale"]
    v = (z - config["origin_z"]) / config["scale"]

    px = u * MINIMAP_SIZE_PX
    py = (1.0 - v) * MINIMAP_SIZE_PX

    return float(px), float(py)


def build_map_registry() -> Dict[str, Dict[str, Any]]:
    registry: Dict[str, Dict[str, Any]] = {}
    for map_name, cfg in MAP_CONFIG.items():
        registry[map_name] = {
            "name": map_name,
            "image_size": {"width": MINIMAP_SIZE_PX, "height": MINIMAP_SIZE_PX},
            "world_mapping": {
                "scale": cfg["scale"],
                "origin_x": cfg["origin_x"],
                "origin_z": cfg["origin_z"],
                "uses_axes": ["x", "z"],
                "y_flip": True,
            },
        }
    return registry


# ============================================================
# LOAD DATA
# ============================================================

def load_all_files() -> pd.DataFrame:
    frames: List[pd.DataFrame] = []
    file_count = 0

    for root, _, filenames in os.walk(DATA_RAW_DIR):
        for filename in filenames:
            if filename.startswith(".") or filename == "README.md":
                continue

            path = os.path.join(root, filename)
            file_count += 1

            try:
                df_part = pd.read_parquet(path, engine="pyarrow")
                df_part = df_part.copy()
                df_part["source_file"] = filename
                df_part["source_path"] = path
                df_part["source_date"] = extract_date_from_path(path)
                frames.append(df_part)
            except Exception as exc:
                print(f"⚠️ Skipped unreadable parquet file: {path} | {exc}")

    print(f"📂 Files found: {file_count}")

    if not frames:
        raise RuntimeError(f"No valid parquet files found under: {DATA_RAW_DIR}")

    df = pd.concat(frames, ignore_index=True)
    print(f"✅ Rows loaded: {len(df)}")
    return df


# ============================================================
# CLEAN / PREP
# ============================================================

def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    required_columns = ["user_id", "match_id", "map_id", "x", "y", "z", "ts", "event"]
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise RuntimeError(f"Missing required columns: {missing}")

    prepared = df.copy()

    prepared["user_id"] = prepared["user_id"].astype(str)
    prepared["match_id"] = prepared["match_id"].astype(str)
    prepared["map_id"] = prepared["map_id"].astype(str)

    prepared["event_decoded"] = prepared["event"].apply(decode_event)
    prepared["event_type"] = prepared["event_decoded"].apply(normalize_event)
    prepared["user_type"] = prepared["user_id"].apply(classify_user)

    # Keep ts as datetime if already parsed by parquet, otherwise parse as ms.
    if not pd.api.types.is_datetime64_any_dtype(prepared["ts"]):
        prepared["ts"] = pd.to_datetime(prepared["ts"], unit="ms", errors="coerce")
    else:
        prepared["ts"] = pd.to_datetime(prepared["ts"], errors="coerce")

    prepared = prepared.dropna(subset=["ts", "x", "z", "match_id", "map_id", "user_id"])

    prepared = prepared.drop_duplicates(
        subset=["match_id", "user_id", "ts", "x", "z", "event_decoded"]
    )

    print("\n📊 DEBUG INSIGHTS:")
    print("Unique match_ids:", prepared["match_id"].nunique())
    print("Unique users:", prepared["user_id"].nunique())
    print("Maps:", sorted(prepared["map_id"].dropna().unique().tolist()))
    print("Event types:", sorted(prepared["event_decoded"].dropna().unique().tolist()))
    print("Date folders:", sorted(prepared["source_date"].dropna().unique().tolist()))

    if ENABLE_TS_DEBUG:
        print("\n⏱ TS DEBUG")
        print("ts dtype:", prepared["ts"].dtype)
        print("ts min:", prepared["ts"].min())
        print("ts max:", prepared["ts"].max())

        sample_match = prepared["match_id"].dropna().iloc[0]
        sample_df = prepared[prepared["match_id"] == sample_match].sort_values("ts").copy()

        print("\nSample match_id:", sample_match)
        print("Sample rows:", len(sample_df))
        print("Sample ts min:", sample_df["ts"].min())
        print("Sample ts max:", sample_df["ts"].max())

        if len(sample_df) > 1:
            print(
                "Sample duration seconds:",
                (sample_df["ts"].max() - sample_df["ts"].min()).total_seconds(),
            )

        print(sample_df[["user_id", "match_id", "ts", "event_decoded"]].head(10))

    return prepared


# ============================================================
# QUALITY LOGIC
# ============================================================

def assign_quality(
    *,
    players_count: int,
    human_players: int,
    bot_players: int,
    events_count: int,
    kills: int,
    deaths: int,
    loot: int,
    unique_event_types: int,
    duration_sec: float,
    total_rows: int,
    out_of_bounds_points: int,
) -> QualityResult:
    """
    Production-oriented quality scoring for this dataset.

    Important:
    We DO NOT treat short duration as invalid, because debug showed these
    records are very short observed windows, not full-length replays.
    """
    flags: List[str] = []
    score = 0

    # Actor richness
    if players_count <= 0:
        flags.append("no_valid_players")
    elif players_count == 1:
        flags.append("single_actor")
        score += 1
    elif players_count < 4:
        flags.append("small_snapshot")
        score += 2
    else:
        score += 3

    # Human presence
    if human_players == 0:
        flags.append("bots_only")
    elif human_players == 1:
        score += 1
    else:
        score += 2

    # Key event richness
    if events_count == 0:
        flags.append("no_key_events")
    elif events_count < 5:
        flags.append("very_low_key_event_count")
        score += 1
    elif events_count < 20:
        score += 2
    else:
        score += 3

    # Event diversity
    if unique_event_types >= 3:
        score += 2
    elif unique_event_types == 2:
        score += 1
    else:
        flags.append("low_event_diversity")

    # Combat presence
    if kills > 0:
        score += 1
    else:
        flags.append("no_combat_events")

    # Loot-heavy warning
    if loot > 0 and kills == 0 and unique_event_types <= 2:
        flags.append("loot_heavy_snapshot")

    # Window size warning, not rejection
    if duration_sec < 1:
        flags.append("subsecond_window")
    elif duration_sec < 3:
        flags.append("micro_window")
    elif duration_sec < 10:
        flags.append("short_window")

    # Density / geometry warnings
    if total_rows > 0 and out_of_bounds_points > 0:
        flags.append("has_out_of_bounds_points")

    if total_rows >= 300 and duration_sec < 1:
        flags.append("dense_micro_window")

    is_recommended = (
        players_count >= 4
        and human_players >= 1
        and events_count >= 10
        and unique_event_types >= 2
        and (kills > 0 or deaths > 0)
    )

    if is_recommended:
        return QualityResult(
            tier="recommended",
            score=max(score, 7),
            is_recommended=True,
            flags=flags,
        )

    if score >= 4:
        return QualityResult(
            tier="playable",
            score=score,
            is_recommended=False,
            flags=flags,
        )

    return QualityResult(
        tier="debug_only",
        score=score,
        is_recommended=False,
        flags=flags,
    )


# ============================================================
# MATCH SNAPSHOT PROCESSING
# ============================================================

def process_matches(df: pd.DataFrame) -> None:
    ensure_clean_output_dirs()

    map_registry = build_map_registry()
    manifest_matches: List[Dict[str, Any]] = []

    saved_count = 0
    recommended_count = 0
    playable_count = 0
    debug_only_count = 0
    rejected_too_small = 0

    grouped = df.groupby("match_id", sort=True)

    print(f"\n🚀 Processing match snapshots by match_id...")
    print(f"Total grouped matches: {df['match_id'].nunique()}")

    for match_id, match_df in grouped:
        match_df = match_df.sort_values(["ts", "user_id"]).copy()

        map_values = match_df["map_id"].dropna().unique().tolist()
        if not map_values:
            continue

        map_name = str(map_values[0])
        if map_name not in MAP_CONFIG:
            continue

        total_rows = int(len(match_df))
        total_source_users = int(match_df["user_id"].nunique())

        if total_rows < MIN_TOTAL_ROWS_TO_KEEP:
            rejected_too_small += 1
            continue

        source_dates = sorted(match_df["source_date"].dropna().unique().tolist())
        source_files = sorted(match_df["source_file"].dropna().unique().tolist())

        # Relative snapshot time
        start_ts = match_df["ts"].min()
        match_df["t"] = (match_df["ts"] - start_ts).dt.total_seconds()
        duration_sec = float(match_df["t"].max()) if len(match_df) else 0.0

        # World -> minimap
        match_df[["px", "py"]] = match_df.apply(
            lambda row: pd.Series(
                map_coordinates(float(row["x"]), float(row["z"]), map_name)
            ),
            axis=1,
        )

        out_of_bounds_mask = (
            (match_df["px"] < 0)
            | (match_df["px"] > MINIMAP_SIZE_PX)
            | (match_df["py"] < 0)
            | (match_df["py"] > MINIMAP_SIZE_PX)
        )
        out_of_bounds_points = int(out_of_bounds_mask.sum())

        match_df["px_clamped"] = match_df["px"].clip(0, MINIMAP_SIZE_PX)
        match_df["py_clamped"] = match_df["py"].clip(0, MINIMAP_SIZE_PX)

        # -------------------------
        # PLAYERS / PATHS
        # -------------------------
        players: List[Dict[str, Any]] = []
        human_players = 0
        bot_players = 0

        for user_id, player_df in match_df.groupby("user_id", sort=False):
            player_df = player_df.sort_values("t").copy()

            sampled_path: List[Dict[str, Any]] = []
            last_time = -999999.0

            for _, row in player_df.iterrows():
                current_time = float(row["t"])

                if current_time - last_time < SAMPLING_INTERVAL_SEC:
                    continue

                sampled_path.append({
                    "time_sec": round_time(current_time),
                    "position": {
                        "x": round_pos(row["px_clamped"]),
                        "y": round_pos(row["py_clamped"]),
                    },
                })
                last_time = current_time

            if len(sampled_path) < MIN_PATH_POINTS_PER_PLAYER:
                continue

            player_type = str(player_df["user_type"].iloc[0])
            if player_type == "human":
                human_players += 1
            else:
                bot_players += 1

            players.append({
                "id": str(user_id),
                "type": player_type,
                "path": sampled_path,
            })

        # -------------------------
        # EVENTS
        # -------------------------
        events: List[Dict[str, Any]] = []
        seen_event_keys = set()

        for _, row in match_df.iterrows():
            event_type = row["event_type"]
            if event_type is None:
                continue

            event_key = (
                str(row["user_id"]),
                str(event_type),
                round_time(row["t"]),
                round_pos(row["px_clamped"]),
                round_pos(row["py_clamped"]),
            )

            if event_key in seen_event_keys:
                continue
            seen_event_keys.add(event_key)

            events.append({
                "type": str(event_type),
                "time_sec": round_time(row["t"]),
                "position": {
                    "x": round_pos(row["px_clamped"]),
                    "y": round_pos(row["py_clamped"]),
                },
                "player_id": str(row["user_id"]),
            })

        # Metrics
        kills = sum(1 for e in events if e["type"] in {"kill", "kill_bot"})
        deaths = sum(1 for e in events if e["type"] in {"death", "death_by_bot", "storm_death"})
        loot = sum(1 for e in events if e["type"] == "loot")
        unique_event_types = len(set(e["type"] for e in events))

        safe_duration = max(duration_sec, 0.001)
        engagement = len(events) / safe_duration
        combat_intensity = kills / safe_duration
        loot_ratio = loot / max(len(events), 1)

        quality = assign_quality(
            players_count=len(players),
            human_players=human_players,
            bot_players=bot_players,
            events_count=len(events),
            kills=kills,
            deaths=deaths,
            loot=loot,
            unique_event_types=unique_event_types,
            duration_sec=duration_sec,
            total_rows=total_rows,
            out_of_bounds_points=out_of_bounds_points,
        )

        if quality.tier == "recommended":
            recommended_count += 1
        elif quality.tier == "playable":
            playable_count += 1
        else:
            debug_only_count += 1

        clean_match_id = sanitize_match_id(match_id)
        file_name = f"match_{clean_match_id}.json"
        file_path = os.path.join(MATCHES_DIR, file_name)

        match_json = {
            "meta": {
                "match_id": clean_match_id,
                "raw_match_id": str(match_id),
                "map": map_name,
                "dates": source_dates,
                "duration_sec": round(duration_sec, 3),
                "players": len(players),
                "human_players": human_players,
                "bot_players": bot_players,
                "events": len(events),
                "engagement": round(engagement, 4),
                "combat_intensity": round(combat_intensity, 4),
                "loot_ratio": round(loot_ratio, 4),
                "quality_score": quality.score,
                "quality_tier": quality.tier,
                "is_recommended": quality.is_recommended,
                "quality_flags": quality.flags,
            },
            "players": players,
            "events": events,
            "debug": {
                "source_rows": total_rows,
                "source_unique_users": total_source_users,
                "source_files": source_files,
                "kills": kills,
                "deaths": deaths,
                "loot": loot,
                "unique_event_types": unique_event_types,
                "out_of_bounds_points_before_clamp": out_of_bounds_points,
            },
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(match_json, f, indent=2)

        manifest_matches.append({
            "match_id": clean_match_id,
            "raw_match_id": str(match_id),
            "map": map_name,
            "dates": source_dates,
            "file": f"matches/{file_name}",
            "duration_sec": round(duration_sec, 3),
            "players": len(players),
            "human_players": human_players,
            "bot_players": bot_players,
            "events": len(events),
            "engagement": round(engagement, 4),
            "quality_score": quality.score,
            "quality_tier": quality.tier,
            "is_recommended": quality.is_recommended,
            "quality_flags": quality.flags,
        })

        saved_count += 1

    # -------------------------
    # SAVE MAP CONFIGS
    # -------------------------
    for map_name, map_data in map_registry.items():
        with open(
            os.path.join(MAPS_DIR, f"{map_name.lower()}.json"),
            "w",
            encoding="utf-8",
        ) as f:
            json.dump(map_data, f, indent=2)

    # -------------------------
    # SAVE MANIFEST
    # -------------------------
    manifest = {
        "version": "11.0",
        "total_matches": len(manifest_matches),
        "recommended_matches": recommended_count,
        "playable_matches": playable_count,
        "debug_only_matches": debug_only_count,
        "maps": [
            {
                "name": map_name,
                "file": f"maps/{map_name.lower()}.json",
            }
            for map_name in sorted(map_registry.keys())
        ],
        "matches": manifest_matches,
    }

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\n📦 PIPELINE SUMMARY")
    print("Saved snapshots:", saved_count)
    print("Recommended:", recommended_count)
    print("Playable:", playable_count)
    print("Debug-only:", debug_only_count)
    print("Rejected (too small):", rejected_too_small)
    print(f"\n✅ DONE: {saved_count} processed match snapshots saved")


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    raw_df = load_all_files()
    prepared_df = prepare_dataframe(raw_df)
    process_matches(prepared_df)


if __name__ == "__main__":
    main()