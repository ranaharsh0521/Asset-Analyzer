"""Packet and flow parsing for live TGNN ingestion."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pandas as pd

from app.graph.builder import TemporalGraphBuilder
from app.services.inference import inference_service

CAPTURE_DIR = Path(os.environ.get("DATA_DIR", "./data")) / "captures"
CAPTURE_DIR.mkdir(parents=True, exist_ok=True)


class PacketParserService:
    def parse_capture(self, file_path: Path, original_name: str, window_seconds: int = 30) -> dict[str, Any]:
        flows = self.load_flows(file_path, original_name)
        if flows.empty:
            raise ValueError("No packets or network flows were extracted")

        builder = TemporalGraphBuilder(window_seconds=window_seconds)
        snapshots = builder.build_from_dataframe(flows)
        if not snapshots:
            snapshots = [builder.build_single_snapshot(flows)]

        latest_snapshot = snapshots[-1]
        predictions = []
        for _, row in flows.tail(25).iterrows():
            predictions.append(inference_service.predict(row.to_dict(), latest_snapshot))

        return {
            "filename": original_name,
            "file_path": str(file_path),
            "flow_count": int(len(flows)),
            "snapshot_count": len(snapshots),
            "latest_snapshot": latest_snapshot,
            "predictions": predictions,
            "protocols": sorted(str(p).lower() for p in flows["protocol"].dropna().unique()),
        }

    def load_flows(self, file_path: Path, original_name: str | None = None) -> pd.DataFrame:
        ext = file_path.suffix.lower()
        if ext in {".csv", ".flow"}:
            return self._load_flow_csv(file_path)
        if ext in {".json", ".jsonl", ".log"}:
            return self._load_network_log(file_path)
        elif ext in {".pcap", ".pcapng"}:
            return self._load_pcap(file_path)
        raise ValueError(f"Unsupported packet capture format: {ext or original_name or file_path.name}")

    def _load_flow_csv(self, file_path: Path) -> pd.DataFrame:
        df = pd.read_csv(file_path)
        return self._normalize_flows(df)

    def _load_network_log(self, file_path: Path) -> pd.DataFrame:
        try:
            df = pd.read_json(file_path, lines=True)
        except ValueError:
            try:
                df = pd.read_json(file_path)
            except ValueError:
                df = pd.read_csv(file_path, sep=None, engine="python")
        if isinstance(df, pd.Series):
            df = df.to_frame().T
        return self._normalize_flows(df)

    def _load_pcap(self, file_path: Path) -> pd.DataFrame:
        try:
            return self._load_pcap_with_scapy(file_path)
        except Exception:
            return self._load_pcap_with_pyshark(file_path)

    def _load_pcap_with_scapy(self, file_path: Path) -> pd.DataFrame:
        from scapy.all import DNS, IP, TCP, UDP, rdpcap

        rows: list[dict[str, Any]] = []
        for packet in rdpcap(str(file_path)):
            if IP not in packet:
                continue

            src_port = dst_port = 0
            protocol = str(packet[IP].proto)
            if TCP in packet:
                protocol = self._port_protocol(int(packet[TCP].sport), int(packet[TCP].dport), "tcp")
                src_port = int(packet[TCP].sport)
                dst_port = int(packet[TCP].dport)
            elif UDP in packet:
                protocol = self._port_protocol(int(packet[UDP].sport), int(packet[UDP].dport), "udp")
                src_port = int(packet[UDP].sport)
                dst_port = int(packet[UDP].dport)
            if DNS in packet:
                protocol = "dns"

            rows.append({
                "timestamp": pd.to_datetime(float(packet.time), unit="s"),
                "src_ip": packet[IP].src,
                "dst_ip": packet[IP].dst,
                "src_port": src_port,
                "dst_port": dst_port,
                "protocol": protocol,
                "src_packets": 1,
                "dst_packets": 0,
                "src_bytes": int(len(packet)),
                "dst_bytes": 0,
                "duration": 0,
                "attack_type": "Unknown",
            })

        return pd.DataFrame(rows)

    def _load_pcap_with_pyshark(self, file_path: Path) -> pd.DataFrame:
        import pyshark

        rows: list[dict[str, Any]] = []
        capture = pyshark.FileCapture(str(file_path), keep_packets=False)
        try:
            for packet in capture:
                ip_layer = getattr(packet, "ip", None)
                if ip_layer is None:
                    continue

                transport = getattr(packet, "tcp", None) or getattr(packet, "udp", None)
                src_port = int(getattr(transport, "srcport", 0) or 0)
                dst_port = int(getattr(transport, "dstport", 0) or 0)
                base_protocol = "tcp" if hasattr(packet, "tcp") else "udp" if hasattr(packet, "udp") else "other"
                protocol = "dns" if hasattr(packet, "dns") else self._port_protocol(src_port, dst_port, base_protocol)

                rows.append({
                    "timestamp": pd.to_datetime(float(packet.sniff_timestamp), unit="s"),
                    "src_ip": ip_layer.src,
                    "dst_ip": ip_layer.dst,
                    "src_port": src_port,
                    "dst_port": dst_port,
                    "protocol": protocol,
                    "src_packets": 1,
                    "dst_packets": 0,
                    "src_bytes": int(getattr(packet, "length", 0) or 0),
                    "dst_bytes": 0,
                    "duration": 0,
                    "attack_type": "Unknown",
                })
        finally:
            capture.close()

        return pd.DataFrame(rows)

    def _normalize_flows(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df.columns = df.columns.str.strip()
        rename = {
            "Source IP": "src_ip",
            "Destination IP": "dst_ip",
            "Src IP": "src_ip",
            "Dst IP": "dst_ip",
            "Source Port": "src_port",
            "Destination Port": "dst_port",
            "Protocol": "protocol",
            "Timestamp": "timestamp",
            "Flow Duration": "duration",
            "Total Fwd Packets": "src_packets",
            "Total Backward Packets": "dst_packets",
            "Total Length of Fwd Packets": "src_bytes",
            "Total Length of Bwd Packets": "dst_bytes",
            "Label": "attack_type",
        }
        df = df.rename(columns={k: v for k, v in rename.items() if k in df.columns})
        required = {"src_ip", "dst_ip", "protocol"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required flow columns: {', '.join(sorted(missing))}")
        for column in ["src_port", "dst_port", "src_packets", "dst_packets", "src_bytes", "dst_bytes", "duration"]:
            if column not in df.columns:
                df[column] = 0
        if "timestamp" not in df.columns:
            df["timestamp"] = pd.date_range(start=pd.Timestamp.utcnow(), periods=len(df), freq="s")
        if "attack_type" not in df.columns:
            df["attack_type"] = "Unknown"
        return df

    def _port_protocol(self, src_port: int, dst_port: int, fallback: str) -> str:
        ports = {src_port, dst_port}
        if 443 in ports:
            return "https"
        if 80 in ports or 8080 in ports:
            return "http"
        if 53 in ports:
            return "dns"
        if 22 in ports:
            return "ssh"
        if 21 in ports or 20 in ports:
            return "ftp"
        if 25 in ports or 587 in ports:
            return "smtp"
        if 1883 in ports or 8883 in ports:
            return "mqtt"
        return fallback


packet_parser_service = PacketParserService()
