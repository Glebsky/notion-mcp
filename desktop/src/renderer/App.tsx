import React, { useEffect, useState } from "react";
import { Activity, Pause, Play, Terminal } from "lucide-react";
import { TitleBar } from "./components/TitleBar";
import { NotionCard } from "./components/NotionCard";
import { Controls } from "./components/Controls";
import { LogViewer } from "./components/LogViewer";
import { SettingsModal } from "./components/SettingsModal";
import { Monitor } from "./components/Monitor";
import type { LogEntry, MonitorSnapshot, ServerStatus } from "../types";

export const App: React.FC = () => {
  const [status, setStatus] = useState<ServerStatus>({ state: "offline", port: 3100, host: "127.0.0.1", ngrokEnabled: false, apiKey: "", fullAccess: false, filesRoot: "./workspace" });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [animation, setAnimation] = useState(() => {
    const saved = localStorage.getItem("mcp-terminal-animation");
    return saved === null ? !window.matchMedia("(prefers-reduced-motion: reduce)").matches : saved === "true";
  });
  const [monitoring, setMonitoring] = useState(() => localStorage.getItem("mcp-terminal-monitoring") !== "false");
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [tab, setTab] = useState<"logs" | "monitor">("monitor");

  useEffect(() => {
    void window.electronAPI.getServerStatus().then(setStatus);
    const unsubStatus = window.electronAPI.onStatusChange(setStatus);
    const unsubLogs = window.electronAPI.onLog((log) => setLogs((prev) => [...prev.slice(-999), log]));
    const unsubMonitor = window.electronAPI.onMonitoring(setSnapshot);
    return () => { unsubStatus(); unsubLogs(); unsubMonitor(); };
  }, []);
  useEffect(() => { localStorage.setItem("mcp-terminal-animation", String(animation)); }, [animation]);
  useEffect(() => {
    localStorage.setItem("mcp-terminal-monitoring", String(monitoring));
    setSnapshot(null);
    void window.electronAPI.setMonitoring(monitoring);
  }, [monitoring]);
  useEffect(() => { if (status.state !== "running") setSnapshot(null); }, [status.state]);

  const toggleMonitor = () => { setMonitoring((value) => !value); if (monitoring) setTab("logs"); else setTab("monitor"); };
  return (
    <div className={`app-shell ${animation ? "" : "motion-off"}`}>
      <div className="aurora aurora-one"/><div className="aurora aurora-two"/><div className="aurora aurora-three"/>
      <TitleBar status={status} onOpenSettings={() => setIsSettingsOpen(true)} />
      <main className="dashboard">
        <Controls status={status} onStart={() => void window.electronAPI.startServer()} onStop={() => void window.electronAPI.stopServer()} onRestart={() => void window.electronAPI.restartServer()} onOpenSettings={() => setIsSettingsOpen(true)} />
        <NotionCard status={status}/>
        <div className="workspace-nav">
          <div className="workspace-tabs" role="tablist" aria-label="Workspace views">
            <button role="tab" aria-selected={tab === "monitor"} onClick={() => setTab("monitor")}><Activity size={15}/> Monitor</button>
            <button role="tab" aria-selected={tab === "logs"} onClick={() => setTab("logs")}><Terminal size={15}/> Logs <span>{logs.length}</span></button>
          </div>
          <button className="monitor-toggle" onClick={toggleMonitor} aria-pressed={monitoring}>{monitoring ? <Pause size={13}/> : <Play size={13}/>} {monitoring ? "Pause monitoring" : "Enable monitoring"}</button>
        </div>
        <div className="workspace-body">
          {tab === "monitor" ? monitoring ? <Monitor snapshot={snapshot} status={status} animation={animation}/> : <div className="monitor-paused liquid-glass-card"><Pause size={25}/><h2>Monitoring paused</h2><p>Traffic collection is disabled. Logs continue as usual.</p><button className="liquid-glass-btn" onClick={toggleMonitor}>Enable monitoring</button></div> : <LogViewer logs={logs} onClear={() => { setLogs([]); void window.electronAPI.clearLogs(); }}/>}
        </div>
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSaved={() => void window.electronAPI.getServerStatus().then(setStatus)} animation={animation} onAnimationChange={setAnimation}/>
    </div>
  );
};
export default App;
