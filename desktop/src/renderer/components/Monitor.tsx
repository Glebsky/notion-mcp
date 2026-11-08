import React from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, Users, Radio, Info } from "lucide-react";
import type { MonitorSnapshot, ServerStatus } from "../../types";
import { operationColor } from "./operationColor";

interface Props { snapshot: MonitorSnapshot | null; status: ServerStatus; animation: boolean }
function bytes(value: number): string {
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

export const Monitor: React.FC<Props> = ({ snapshot, status, animation }) => {
  const rx = snapshot?.received || 0;
  const tx = snapshot?.sent || 0;
  const operations = [...(snapshot?.operations || [])].sort((a,b) => b.received + b.sent - a.received - a.sent);
  const total = rx + tx;
  // Adaptive quantization keeps the number of DOM nodes bounded while exposing the actual scale.
  const quantum = Math.max(1, Math.ceil(total / 36));
  const particles = operations.flatMap((op) => Array.from({ length: Math.floor((op.received + op.sent) / quantum) }, (_, i) => ({ operation: op.operation, i })) ).slice(0, 36);
  return (
    <section className="monitor-panel liquid-glass-card" aria-label="Connection and transfer monitoring">
      <div className="monitor-heading">
        <div><div className="section-eyebrow"><Activity size={14}/> LIVE TELEMETRY</div><h2>Connection monitor</h2></div>
        <span className="monitor-live"><span className="status-dot"/> {status.state === "running" ? "COLLECTING" : "SERVER OFFLINE"}</span>
      </div>
      <div className="monitor-stats">
        <div><span>ACTIVE REQUESTS</span><strong>{snapshot?.activeRequests ?? 0}</strong><small>{snapshot?.activeSse ?? 0} SSE open · {snapshot?.activeHttp ?? 0} HTTP active</small></div>
        <div><span>REQUESTS SEEN</span><strong>{snapshot?.totalRequests ?? 0}</strong><small>since monitoring started</small></div>
        <div><span>INBOUND / SEC</span><strong>{bytes(rx)}<small>/s</small></strong><small>total {bytes(snapshot?.totalReceived ?? 0)}</small></div>
        <div><span>OUTBOUND / SEC</span><strong>{bytes(tx)}<small>/s</small></strong><small>total {bytes(snapshot?.totalSent ?? 0)}</small></div>
      </div>
      <div className="pipe-section">
        <div className="pipe-caption"><span><Radio size={14}/> DATA FLOW <em>authenticated MCP payloads</em></span><span>≈ {bytes(quantum)} per particle · last second</span></div>
        <div className="flow-pipe" aria-label={`Inbound ${bytes(rx)} per second, outbound ${bytes(tx)} per second`}>
          <div className="pipe-start"><ArrowDownLeft size={17}/></div><div className="pipe-grid"/>
          {particles.map((particle, index) => <span key={`${particle.operation}-${particle.i}`} className={`flow-particle ${animation ? "flow-moving" : ""}`} style={{"--particle-color": operationColor(particle.operation), "--particle-y": `${20 + (index * 37 % 60)}%`, "--particle-x": `${7 + (index * 23 % 84)}%`, "--particle-delay": `${-((index * .31) % 3)}s`} as React.CSSProperties}/>)}
          {particles.length === 0 && <span className="pipe-idle">{status.state === "running" ? "Waiting for traffic" : "Start server to receive traffic"}</span>}
          <div className="pipe-end"><ArrowUpRight size={17}/></div>
        </div>
        <div className="flow-legend">{operations.length ? operations.slice(0, 8).map(op => <span key={op.operation}><i style={{background: operationColor(op.operation)}}/>{op.operation} <b>{bytes(op.received + op.sent)}</b></span>) : <span>No operations in the last second</span>}</div>
      </div>
      <div className="clients-heading"><span><Users size={14}/> RECENT CLIENTS</span><span>Direct peer · {snapshot?.recentClients.length || 0} shown</span></div>
      <div className="client-list">
        {!snapshot?.recentClients.length ? <div className="client-empty">No authenticated MCP requests observed yet.</div> : snapshot.recentClients.map(client => <div className="client-row" key={client.client}><span className="client-avatar">{client.client.charAt(0).toUpperCase()}</span><span className="client-name" title={client.client}>{client.client}</span><span className="client-operation" style={{color: operationColor(client.operation)}}>{client.operation}</span><span>{client.requests} requests</span><time>{new Date(client.lastSeen).toLocaleTimeString()}</time></div>)}
      </div>
      <p className="monitor-note"><Info size={13}/> Payload bytes only; headers excluded. HTTP is stateless; active HTTP requests are observed since monitoring was enabled. Client names and socket peers are indicative, not verified identities; tunnels may mask addresses. SSE responses are attributed to the SSE stream.</p>
    </section>
  );
};
