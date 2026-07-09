"""Real cybersecurity dataset loaders."""

from __future__ import annotations

import os
import urllib.request
from pathlib import Path

import pandas as pd


DATA_DIR = Path(os.environ.get("DATA_DIR", "./data"))

DATASET_URLS = {
    "unsw_nb15": {
        "train": "https://raw.githubusercontent.com/DefectiveClone/NB15-CSV/master/UNSW-NB15_1.csv",
        "features": "https://raw.githubusercontent.com/DefectiveClone/NB15-CSV/master/NUSW-NB15_features.csv",
    },
    "nsl_kdd": {
        "train": "https://raw.githubusercontent.com/Defect17/NSL-KDD-KDDcup99/master/KDDTrain%2B.csv",
    },
}

UNSW_COLUMNS = [
    "srcip", "sport", "dstip", "dsport", "proto", "state", "dur", "sbytes", "dbytes",
    "sttl", "dttl", "sloss", "dloss", "service", "Sload", "Dload", "Spkts", "Dpkts",
    "swin", "dwin", "stcpb", "dtcpb", "smeansz", "dmeansz", "trans_depth", "res_bdy_len",
    "Sjit", "Djit", "Stime", "Ltime", "Sintpkt", "Dintpkt", "tcprtt", "synack", "ackdat",
    "is_sm_ips_ports", "ct_state_ttl", "ct_flw_http_mthd", "is_ftp_login", "ct_ftp_cmd",
    "ct_srv_src", "ct_srv_dst", "ct_dst_ltm", "ct_src_ltm", "ct_src_dport_ltm",
    "ct_dst_sport_ltm", "ct_dst_src_ltm", "attack_cat", "label",
]


def ensure_data_dir() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR


def download_file(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    print(f"[data] Downloading {url} -> {dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    return dest


def load_unsw_nb15(max_rows: int = 100000) -> pd.DataFrame:
    """Load UNSW-NB15 dataset (real public cybersecurity dataset)."""
    dest = ensure_data_dir() / "unsw_nb15" / "UNSW-NB15_1.csv"
    url = DATASET_URLS["unsw_nb15"]["train"]

    try:
        download_file(url, dest)
        df = pd.read_csv(dest, names=UNSW_COLUMNS, header=None, nrows=max_rows)
        df = df.rename(columns={
            "srcip": "src_ip", "dstip": "dst_ip", "sport": "src_port",
            "dsport": "dst_port", "proto": "protocol", "attack_cat": "attack_type",
        })
        df["label"] = df["label"].astype(int)
        print(f"[data] Loaded UNSW-NB15: {len(df)} records, attacks: {(df['label']==1).sum()}")
        return df
    except Exception as e:
        raise RuntimeError(f"UNSW-NB15 is unavailable and no synthetic fallback is allowed: {e}") from e


def load_nsl_kdd(max_rows: int = 50000) -> pd.DataFrame:
    """Load NSL-KDD dataset."""
    dest = ensure_data_dir() / "nsl_kdd" / "KDDTrain+.csv"
    columns = [
        "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
        "land", "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in",
        "num_compromised", "root_shell", "su_attempted", "num_root", "num_file_creations",
        "num_shells", "num_access_files", "is_guest_login", "count", "srv_count",
        "serror_rate", "srv_serror_rate", "rerror_rate", "srv_rerror_rate",
        "same_srv_rate", "diff_srv_rate", "srv_diff_host_rate", "dst_host_count",
        "dst_host_srv_count", "dst_host_same_srv_rate", "dst_host_diff_srv_rate",
        "dst_host_same_src_port_rate", "dst_host_serror_rate", "dst_host_srv_serror_rate",
        "dst_host_rerror_rate", "dst_host_srv_rerror_rate", "label",
    ]
    try:
        download_file(DATASET_URLS["nsl_kdd"]["train"], dest)
        df = pd.read_csv(dest, names=columns, header=None, nrows=max_rows)
        df["src_ip"] = df.index.map(lambda i: f"10.0.{i // 256}.{i % 256}")
        df["dst_ip"] = df.index.map(lambda i: f"10.1.{i // 256}.{i % 256}")
        df["protocol"] = df["protocol_type"]
        df["attack_type"] = df["label"].apply(lambda x: "Normal" if x == "normal" else str(x))
        print(f"[data] Loaded NSL-KDD: {len(df)} records")
        return df
    except Exception as e:
        raise RuntimeError(f"NSL-KDD is unavailable and no synthetic fallback is allowed: {e}") from e


def load_ton_iot(max_rows: int = 50000) -> pd.DataFrame:
    """
    Load TON-IoT dataset.
    TON-IoT is available from UNSW - we load network flow subset.
    Falls back to UNSW-NB15 with IoT-relevant filtering if direct download unavailable.
    """
    ton_path = ensure_data_dir() / "ton_iot" / "train_test_network.csv"
    ton_url = "https://raw.githubusercontent.com/UNSW-CERT/TON-IoT/master/Train_Test_datasets/Train_Test_Network_dataset/train_test_network.csv"

    try:
        download_file(ton_url, ton_path)
        df = pd.read_csv(ton_path, nrows=max_rows)
        if "src_ip" not in df.columns and "source_ip" in df.columns:
            df = df.rename(columns={"source_ip": "src_ip", "destination_ip": "dst_ip"})
        print(f"[data] Loaded TON-IoT: {len(df)} records")
        return df
    except Exception as e:
        raise RuntimeError(f"TON-IoT is unavailable and no proxy or synthetic fallback is allowed: {e}") from e


def load_cicids2017(max_rows: int = 50000) -> pd.DataFrame:
    """Load CICIDS2017 - uses Monday sample from public mirror."""
    dest = ensure_data_dir() / "cicids2017" / "Monday-WorkingHours.pcap_ISCX.csv"
    url = "https://raw.githubusercontent.com/merishield/IDS2017/master/Monday-WorkingHours.pcap_ISCX.csv"

    try:
        download_file(url, dest)
        df = pd.read_csv(dest, nrows=max_rows)
        df = df.rename(columns={
            " Source IP": "src_ip", " Destination IP": "dst_ip",
            " Protocol": "protocol", " Label": "attack_type",
        })
        df.columns = df.columns.str.strip()
        if "src_ip" not in df.columns:
            for col in df.columns:
                if "source" in col.lower() and "ip" in col.lower():
                    df = df.rename(columns={col: "src_ip"})
                if "destination" in col.lower() and "ip" in col.lower():
                    df = df.rename(columns={col: "dst_ip"})
        print(f"[data] Loaded CICIDS2017: {len(df)} records")
        return df
    except Exception as e:
        raise RuntimeError(f"CICIDS2017 is unavailable and no synthetic fallback is allowed: {e}") from e


def load_dataset(source: str, max_rows: int = 100000) -> pd.DataFrame:
    source_path = Path(source)
    if source_path.exists():
        suffix = source_path.suffix.lower()
        if suffix in {".csv", ".flow"}:
            df = pd.read_csv(source_path, nrows=max_rows)
            df.columns = df.columns.str.strip()
            return df
        if suffix in {".pcap", ".pcapng", ".json", ".jsonl", ".log"}:
            from app.services.packet_parser import packet_parser_service
            return packet_parser_service.load_flows(source_path).head(max_rows)
        raise RuntimeError(f"Unsupported local dataset format: {suffix}")

    loaders = {
        "unsw_nb15": load_unsw_nb15,
        "ton_iot": load_ton_iot,
        "cicids2017": load_cicids2017,
        "nsl_kdd": load_nsl_kdd,
    }
    loader = loaders.get(source, load_unsw_nb15)
    return loader(max_rows)
