"""Load local benchmark CSVs (CICIDS2017 and related datasets)."""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd


def _dataset_root() -> Path:
    env = os.environ.get("DATASET_ROOT")
    if env:
        return Path(env).expanduser().resolve()
    return Path(__file__).resolve().parents[3] / "DataSet"


def _normalize_flow_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    rename = {
        "Source IP": "src_ip",
        "Destination IP": "dst_ip",
        "Source Port": "src_port",
        "Destination Port": "dst_port",
        "Protocol": "protocol",
        "Label": "attack_type",
        "srcip": "src_ip",
        "dstip": "dst_ip",
        "sport": "src_port",
        "dsport": "dst_port",
        "proto": "protocol",
        "attack_cat": "attack_type",
        "Tot Fwd Pkts": "src_packets",
        "Tot Bwd Pkts": "dst_packets",
        "TotLen Fwd Pkts": "src_bytes",
        "TotLen Bwd Pkts": "dst_bytes",
        "Flow Duration": "duration",
        "Timestamp": "timestamp",
    }
    present = {k: v for k, v in rename.items() if k in df.columns and v not in df.columns}
    if present:
        df = df.rename(columns=present)
    return df


def _read_csvs(folder: Path, max_rows: int) -> pd.DataFrame:
    files = sorted(folder.glob("*.csv"))
    if not files:
        raise FileNotFoundError(f"No CSV files in {folder}")
    frames: list[pd.DataFrame] = []
    remaining = max_rows
    for path in files:
        if remaining <= 0:
            break
        chunk = pd.read_csv(path, nrows=remaining, low_memory=False)
        frames.append(_normalize_flow_columns(chunk))
        remaining -= len(chunk)
    return pd.concat(frames, ignore_index=True)


def _load_named(name: str, max_rows: int) -> pd.DataFrame:
    root = _dataset_root()
    aliases = {
        "cicids2017": ["CICIDS2017", "cicids2017"],
        "cse_cic_ids2018": ["CSE-CIC-IDS2018", "cse_cic_ids2018", "CICIDS2018"],
        "unsw_nb15": ["UNSW-NB15", "unsw_nb15"],
        "nsl_kdd": ["NSL-KDD", "nsl_kdd"],
        "ton_iot": ["TON-IoT", "ton_iot"],
    }
    for folder_name in aliases.get(name, [name]):
        folder = root / folder_name
        if folder.is_dir():
            return _read_csvs(folder, max_rows)
    # Also accept a single CSV named after the dataset.
    for candidate in (root / f"{name}.csv", root / f"{name}.CSV"):
        if candidate.exists():
            return _normalize_flow_columns(pd.read_csv(candidate, nrows=max_rows, low_memory=False))
    raise FileNotFoundError(
        f"Dataset '{name}' not found under {_dataset_root()}. See DataSet/README.md."
    )


def load_dataset(source: str, max_rows: int = 100000) -> pd.DataFrame:
    """Load a named dataset slug or a local file path."""
    source_path = Path(source)
    if source_path.exists():
        suffix = source_path.suffix.lower()
        if suffix in {".csv", ".flow"}:
            return _normalize_flow_columns(pd.read_csv(source_path, nrows=max_rows, low_memory=False))
        raise RuntimeError(f"Unsupported local dataset format: {suffix}")

    slug = (source or "").strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "cicids": "cicids2017",
        "cic_ids_2017": "cicids2017",
        "unsw": "unsw_nb15",
        "unsw-nb15": "unsw_nb15",
        "cicids2018": "cse_cic_ids2018",
        "cse-cic-ids2018": "cse_cic_ids2018",
    }
    name = aliases.get(slug, slug)
    return _load_named(name, max_rows)
