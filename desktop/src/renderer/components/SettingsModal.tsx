import React, { useEffect, useState } from "react";
import { X, Save, RefreshCw, Folder, Key, Globe, Shield, Terminal, Check } from "lucide-react";
import type { EnvConfig } from "../../types";



interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [config, setConfig] = useState<EnvConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    const env = await window.electronAPI.getConfig();
    setConfig(env);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    const res = await window.electronAPI.saveConfig(config);
    setSaving(false);
    if (res.success) {
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onSaved();
        onClose();
      }, 1000);
    }
  };

  const handleSelectFolder = async () => {
    const selected = await window.electronAPI.selectFolder();
    if (selected && config) {
      setConfig({ ...config, FILES_ROOT: selected });
    }
  };

  const handleGenerateToken = async () => {
    const token = await window.electronAPI.generateToken();
    if (config) {
      setConfig({ ...config, MCP_API_KEY: token });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl liquid-glass border border-white/10 shadow-2xl p-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Terminal className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Server Settings</h2>
              <p className="text-xs text-slate-400">Modify configuration parameters stored in .env</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {loading || !config ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Loading configuration...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="overflow-y-auto py-4 space-y-4 pr-1">
            {/* API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-violet-400" />
                  Notion Secret API Key (MCP_API_KEY)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateToken}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Generate 64-char key
                </button>
              </div>
              <input
                type="text"
                required
                minLength={32}
                value={config.MCP_API_KEY}
                onChange={(e) => setConfig({ ...config, MCP_API_KEY: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Network Ports & Hosts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Port (PORT)</label>
                <input
                  type="number"
                  value={config.PORT}
                  onChange={(e) => setConfig({ ...config, PORT: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Host (HOST)</label>
                <input
                  type="text"
                  value={config.HOST}
                  onChange={(e) => setConfig({ ...config, HOST: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            {/* Ngrok Tunnel Section */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">Ngrok Public Tunnel</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.NGROK_ENABLED === "true"}
                    onChange={(e) =>
                      setConfig({ ...config, NGROK_ENABLED: e.target.checked ? "true" : "false" })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Static Domain (e.g. xyz.ngrok-free.app)</label>
                  <input
                    type="text"
                    value={config.NGROK_DOMAIN}
                    placeholder="your-name.ngrok-free.app"
                    onChange={(e) => setConfig({ ...config, NGROK_DOMAIN: e.target.value })}
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Auth Token (Optional)</label>
                  <input
                    type="password"
                    value={config.NGROK_AUTHTOKEN}
                    placeholder="ngrok token (if not global)"
                    onChange={(e) => setConfig({ ...config, NGROK_AUTHTOKEN: e.target.value })}
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Security & Sandbox */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Filesystem Sandbox</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Unrestricted Full Access:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.FULL_ACCESS === "true"}
                      onChange={(e) =>
                        setConfig({ ...config, FULL_ACCESS: e.target.checked ? "true" : "false" })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Sandbox Root Directory (FILES_ROOT)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.FILES_ROOT}
                    onChange={(e) => setConfig({ ...config, FILES_ROOT: e.target.value })}
                    className="flex-1 h-8 px-2.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="px-3 h-8 rounded-lg liquid-glass-btn text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 shrink-0"
                  >
                    <Folder className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Browse...</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Allowed Hosts */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Allowed Host Headers (ALLOWED_HOSTS)</label>
              <input
                type="text"
                value={config.ALLOWED_HOSTS}
                onChange={(e) => setConfig({ ...config, ALLOWED_HOSTS: e.target.value })}
                className="w-full h-8 px-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Save Actions */}
            <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 border border-white/10 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{saving ? "Saving..." : "Save Changes"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
