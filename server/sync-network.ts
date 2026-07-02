/**
 * Sync network topology from real dataset graph into PostgreSQL.
 * Run on startup to populate network_nodes and network_edges from TGNN graph builder.
 */

import { eq } from "drizzle-orm";
import { db } from "./db";
import { networkNodes, networkEdges } from "@shared/schema";
import { aiService } from "./ai-client";

export async function syncNetworkFromDataset(datasetId = "unsw_nb15", windowSeconds = 30) {
  console.log("[sync] Building graph from real dataset...");

  try {
    const graph = await aiService.buildGraph(datasetId, windowSeconds);
    const snapshot = graph.snapshot as {
      nodes: Array<{
        id: string; ip: string; type: string; packets: number; bytes: number;
        connections: number; failed_logins: number; ports: number[];
      }>;
      edges: Array<{
        source: string; target: string; protocol: string;
        bytes: number; packets: number; timestamp: string;
      }>;
    };

    const nodeIdMap = new Map<string, string>();

    for (const node of snapshot.nodes) {
      const riskScore = Math.min(
        (node.failed_logins * 0.15) + (node.connections / 100) + (node.packets / 10000),
        1.0,
      );
      const status = node.failed_logins > 3 ? "compromised"
        : node.failed_logins > 0 ? "suspicious" : "online";

      const existing = await db
        .select()
        .from(networkNodes)
        .where(eq(networkNodes.externalId, node.id))
        .limit(1);

      if (existing.length) {
        await db.update(networkNodes).set({
          ipAddress: node.ip,
          nodeType: mapNodeType(node.type),
          status: status as typeof networkNodes.status.enumValues[number],
          riskScore,
          packets: node.packets,
          bytes: node.bytes,
          failedLogins: node.failed_logins,
          connectionCount: node.connections,
          openPorts: node.ports,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(networkNodes.id, existing[0].id));
        nodeIdMap.set(node.id, existing[0].id);
      } else {
        const [inserted] = await db.insert(networkNodes).values({
          externalId: node.id,
          ipAddress: node.ip,
          hostname: `HOST-${node.ip.split(".").pop()}`,
          nodeType: mapNodeType(node.type),
          status: status as typeof networkNodes.status.enumValues[number],
          riskScore,
          packets: node.packets,
          bytes: node.bytes,
          failedLogins: node.failed_logins,
          connectionCount: node.connections,
          openPorts: node.ports,
          subnet: node.ip.split(".").slice(0, 3).join(".") + ".0/24",
        }).returning();
        nodeIdMap.set(node.id, inserted.id);
      }
    }

    for (const edge of snapshot.edges.slice(0, 500)) {
      const sourceId = nodeIdMap.get(edge.source);
      const targetId = nodeIdMap.get(edge.target);
      if (!sourceId || !targetId) continue;

      await db.insert(networkEdges).values({
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        protocol: mapProtocol(edge.protocol),
        packetCount: edge.packets,
        weight: Math.min(edge.bytes / 1000, 10),
        timestamp: new Date(edge.timestamp),
      });
    }

    console.log(`[sync] Synced ${snapshot.nodes.length} nodes, ${Math.min(snapshot.edges.length, 500)} edges`);
    return { nodes: snapshot.nodes.length, edges: snapshot.edges.length };
  } catch (error) {
    console.warn("[sync] Network sync failed (AI service may be unavailable):", error);
    return null;
  }
}

function mapNodeType(type: string): typeof networkNodes.nodeType.enumValues[number] {
  const map: Record<string, typeof networkNodes.nodeType.enumValues[number]> = {
    router: "router", server: "server", host: "host", iot_device: "iot_device",
    ip_address: "ip_address", switch: "switch", user: "user",
  };
  return map[type] ?? "host";
}

function mapProtocol(proto: string): typeof networkEdges.protocol.enumValues[number] {
  const map: Record<string, typeof networkEdges.protocol.enumValues[number]> = {
    tcp: "tcp", udp: "udp", http: "http", https: "https", ssh: "ssh",
    dns: "dns", ftp: "ftp", smtp: "smtp", mqtt: "mqtt",
  };
  return map[proto.toLowerCase()] ?? "other";
}

if (process.argv[1]?.endsWith("sync-network.ts")) {
  syncNetworkFromDataset()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
