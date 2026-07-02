"""Graph construction from network traffic data."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from typing import Any

import networkx as nx
import numpy as np
import pandas as pd


PROTOCOL_MAP = {
    "tcp": 0, "udp": 1, "http": 2, "https": 3, "ssh": 4,
    "dns": 5, "ftp": 6, "smtp": 7, "mqtt": 8, "icmp": 9, "other": 10,
}

NODE_TYPE_MAP = {
    "ip_address": 0, "host": 1, "server": 2, "router": 3,
    "switch": 4, "iot_device": 5, "user": 6,
}


def _node_id(ip: str) -> str:
    return hashlib.md5(ip.encode()).hexdigest()[:12]


def _infer_node_type(ip: str, ports: list[int]) -> str:
    if ip.endswith(".1") or ip.endswith(".254"):
        return "router"
    if any(p in ports for p in [80, 443, 8080, 5432, 3306]):
        return "server"
    if any(p in ports for p in [1883, 8883, 5683]):
        return "iot_device"
    if ip.startswith("10.") or ip.startswith("192.168."):
        return "host"
    return "ip_address"


class TemporalGraphBuilder:
    """Build temporal graph snapshots from flow records."""

    def __init__(self, window_seconds: int = 30):
        self.window_seconds = window_seconds

    def build_from_dataframe(self, df: pd.DataFrame) -> list[dict[str, Any]]:
        df = self._normalize_columns(df)
        if "timestamp" not in df.columns:
            df["timestamp"] = pd.date_range(start="2024-01-01", periods=len(df), freq="1s")

        df["timestamp"] = pd.to_datetime(df["timestamp"])
        snapshots = []
        start = df["timestamp"].min()
        end = df["timestamp"].max()

        current = start
        while current < end:
            window_end = current + timedelta(seconds=self.window_seconds)
            window_df = df[(df["timestamp"] >= current) & (df["timestamp"] < window_end)]
            if len(window_df) > 0:
                snapshots.append(self._build_snapshot(window_df, current))
            current = window_end

        return snapshots

    def build_single_snapshot(self, df: pd.DataFrame) -> dict[str, Any]:
        df = self._normalize_columns(df)
        return self._build_snapshot(df, datetime.utcnow())

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        col_map = {
            "srcip": "src_ip", "dstip": "dst_ip", "sport": "src_port", "dport": "dst_port",
            "proto": "protocol", "sttl": "src_ttl", "dttl": "dst_ttl",
            "sbytes": "src_bytes", "dbytes": "dst_bytes", "Spkts": "src_packets",
            "Dpkts": "dst_packets", "dur": "duration", "label": "label",
            "attack_cat": "attack_type", "category": "attack_type",
        }
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
        return df

    def _build_snapshot(self, df: pd.DataFrame, timestamp: datetime) -> dict[str, Any]:
        G = nx.DiGraph()
        nodes: dict[str, dict] = {}
        edges: list[dict] = []

        for _, row in df.iterrows():
            src_ip = str(row.get("src_ip", row.get("source_ip", "0.0.0.0")))
            dst_ip = str(row.get("dst_ip", row.get("dest_ip", "0.0.0.0")))
            protocol = str(row.get("protocol", row.get("proto", "tcp"))).lower()
            src_port = int(row.get("src_port", row.get("sport", 0)) or 0)
            dst_port = int(row.get("dst_port", row.get("dport", 0)) or 0)

            for ip, port in [(src_ip, src_port), (dst_ip, dst_port)]:
                nid = _node_id(ip)
                if nid not in nodes:
                    ports = [port] if port else []
                    nodes[nid] = {
                        "id": nid,
                        "ip": ip,
                        "type": _infer_node_type(ip, ports),
                        "packets": 0,
                        "bytes": 0,
                        "connections": 0,
                        "failed_logins": int(row.get("num_failed_logins", 0) or 0),
                        "ports": ports,
                    }

            src_id, dst_id = _node_id(src_ip), _node_id(dst_ip)
            nodes[src_id]["packets"] += int(row.get("src_packets", row.get("spkts", 1)) or 1)
            nodes[src_id]["bytes"] += int(row.get("src_bytes", row.get("sbytes", 0)) or 0)
            nodes[src_id]["connections"] += 1
            nodes[dst_id]["packets"] += int(row.get("dst_packets", row.get("dpkts", 1)) or 1)
            nodes[dst_id]["bytes"] += int(row.get("dst_bytes", row.get("dbytes", 0)) or 0)
            nodes[dst_id]["connections"] += 1

            edges.append({
                "source": src_id,
                "target": dst_id,
                "protocol": protocol,
                "src_port": src_port,
                "dst_port": dst_port,
                "bytes": int(row.get("src_bytes", 0) or 0) + int(row.get("dst_bytes", 0) or 0),
                "packets": int(row.get("src_packets", 1) or 1) + int(row.get("dst_packets", 1) or 1),
                "duration": float(row.get("duration", row.get("dur", 0)) or 0),
                "timestamp": timestamp.isoformat(),
            })

            G.add_edge(src_id, dst_id, protocol=protocol, weight=1)

        node_features = self._extract_node_features(nodes)
        edge_index = self._build_edge_index(edges, list(nodes.keys()))

        return {
            "timestamp": timestamp.isoformat(),
            "window_seconds": self.window_seconds,
            "nodes": list(nodes.values()),
            "edges": edges,
            "node_features": node_features,
            "edge_index": edge_index,
            "node_count": len(nodes),
            "edge_count": len(edges),
            "graph_metrics": {
                "density": nx.density(G) if G.number_of_nodes() > 1 else 0,
                "avg_degree": float(np.mean([d for _, d in G.degree()])) if G.number_of_nodes() else 0,
            },
        }

    def _extract_node_features(self, nodes: dict[str, dict]) -> list[list[float]]:
        features = []
        for node in nodes.values():
            features.append([
                float(node["packets"]),
                float(node["bytes"]),
                float(node["connections"]),
                float(node["failed_logins"]),
                float(len(node["ports"])),
                float(NODE_TYPE_MAP.get(node["type"], 1)),
                float(node["bytes"] / max(node["packets"], 1)),
                float(node["connections"] / max(len(nodes), 1)),
                0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            ])
        return features

    def _build_edge_index(self, edges: list[dict], node_ids: list[str]) -> list[list[int]]:
        id_to_idx = {nid: i for i, nid in enumerate(node_ids)}
        edge_index = [[], []]
        for edge in edges:
            if edge["source"] in id_to_idx and edge["target"] in id_to_idx:
                edge_index[0].append(id_to_idx[edge["source"]])
                edge_index[1].append(id_to_idx[edge["target"]])
        return edge_index
