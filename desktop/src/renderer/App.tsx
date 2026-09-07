import React, { useEffect, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { NotionCard } from "./components/NotionCard";
import { Controls } from "./components/Controls";
import { LogViewer } from "./components/LogViewer";
import { SettingsModal } from "./components/SettingsModal";
import type { LogEntry, ServerStatus } from "../types";


export const App: React.FC = () => {
  const [status, setStatus] = useState<ServerStatus>({
    state: "offline",
    port: 3000,
    host: "127.0.0.1",
    ngrokEnabled: false,
    apiKey: "",
    fullAccess: false,
    filesRoot: "./workspace",
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Initial status fetch
    void window.electronAPI.getServerStatus().then(setStatus);

    // Subscribe to status updates
    const unsubscribeStatus = window.electronAPI.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Subscribe to log streams
    const unsubscribeLogs = window.electronAPI.onLog((newLog) => {
      setLogs((prev) => [...prev.slice(-1000), newLog]);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeLogs();
    };
  }, []);

  const handleStart = async () => {
    await window.electronAPI.startServer();
  };

  const handleStop = async () => {
    await window.electronAPI.stopServer();
  };

  const handleRestart = async () => {
    await window.electronAPI.restartServer();
  };

  const handleClearLogs = async () => {
    setLogs([]);
    await window.electronAPI.clearLogs();
  };

  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#08090d] text-slate-100 overflow-hidden select-none border border-white/10 rounded-xl shadow-2xl">
      {/* Background Animated Aurora Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Title Bar */}
      <TitleBar status={status} onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 gap-3.5 min-h-0 relative z-10">
        {/* Controls Bar */}
        <Controls
          status={status}
          onStart={handleStart}
          onStop={handleStop}
          onRestart={handleRestart}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Notion Connection & Credentials Card */}
        <NotionCard status={status} />

        {/* Real-time Log Stream & Audit Terminal */}
        <LogViewer logs={logs} onClear={handleClearLogs} />
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => {
          void window.electronAPI.getServerStatus().then(setStatus);
        }}
      />
    </div>
  );
};

export default App;
