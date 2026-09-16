"""Feature-set preprocessing applied before graph construction."""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.services.feature_selection import normalize_feature_set

# Dataframe columns neutralized when a Model Studio toggle is off.
COLUMN_GROUPS: dict[str, tuple[str, ...]] = {
    "timestamp": ("timestamp",),
    "packet_size": (
        "src_bytes",
        "dst_bytes",
        "src_packets",
        "dst_packets",
        "sbytes",
        "dbytes",
        "Spkts",
        "Dpkts",
    ),
    "protocol": ("protocol", "proto", "protocol_type"),
    "ports": ("src_port", "dst_port", "sport", "dsport"),
    "flow_duration": ("duration", "dur", "Flow Duration"),
    "tcp_flags": ("tcp_flags", "flags", "FIN Flag Count", "SYN Flag Count", "RST Flag Count"),
}


def apply_feature_set(df: pd.DataFrame, feature_set: dict[str, Any] | None) -> pd.DataFrame:
    """Return a copy of ``df`` with disabled feature groups zeroed / neutralized."""
    work = df.copy()
    work.columns = [str(c).strip() for c in work.columns]
    fs = normalize_feature_set(feature_set)

    if not fs.get("timestamp", True) and "timestamp" in work.columns:
        # Keep a monotonic clock so temporal windows still form, without using
        # original capture times.
        work["timestamp"] = pd.date_range(start="2017-07-03", periods=len(work), freq="100ms")

    for group, columns in COLUMN_GROUPS.items():
        if group == "timestamp" or fs.get(group, True):
            continue
        for col in columns:
            if col in work.columns:
                if work[col].dtype == object:
                    work[col] = 0
                else:
                    work[col] = 0
    return work
