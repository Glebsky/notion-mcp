import React, { useState } from "react";
import { Check, Copy, Key, Link2, Sparkles, AlertCircle, Globe, Eye, EyeOff, Server } from "lucide-react";
import type { ServerStatus } from "../../types";

interface NotionCardProps {
  status: ServerStatus;
}

export const NotionCard: React.FC<NotionCardProps> = ({ status }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const localMcpUrl = `http://${status.host || "127.0.0.1"}:${status.port}/mcp`;
  const ngrokBaseUrl = status.ngrokUrl || "";
  const ngrokMcpUrl = ngrokBaseUrl ? `${ngrokBaseUrl}/mcp` : "";

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const isLive = status.state === "running";

  return (
    <div className="relative overflow-hidden rounded-2xl liquid-glass-card p-5 border border-white/10 space-y-4">
      {/* Background ambient gradient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-violet-600/20 to-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Notion & MCP Endpoints</h3>
            <p className="text-xs text-slate-400">Endpoints and authentication tokens for AI agents</p>
          </div>
        </div>

        {status.ngrokUrl ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ngrok Public Live
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            Localhost Only (Ngrok Off)
          </span>
        )}
      </div>

      {/* Grid of endpoint & auth copy blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. Notion MCP Public URL (Ngrok) */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Link2 className="w-3 h-3 text-cyan-400" />
              Notion Public URL (Ngrok /mcp)
            </span>
            <button
              onClick={() => copyToClipboard(ngrokMcpUrl || localMcpUrl, "publicMcpUrl")}
              disabled={!isLive}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-40"
            >
              {copiedField === "publicMcpUrl" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs text-slate-200 truncate bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/5 select-all">
            {isLive
              ? ngrokMcpUrl || `${localMcpUrl} (Local)`
              : "Server offline. Start server to get URL."}
          </div>
        </div>

        {/* 2. Local MCP URL */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Server className="w-3 h-3 text-sky-400" />
              Local MCP URL
            </span>
            <button
              onClick={() => copyToClipboard(localMcpUrl, "localMcpUrl")}
              disabled={!isLive}
              className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-40"
            >
              {copiedField === "localMcpUrl" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs text-slate-200 truncate bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/5 select-all">
            {isLive ? localMcpUrl : "http://127.0.0.1:3000/mcp"}
          </div>
        </div>

        {/* 3. Pure API Token (Raw Key without "Bearer ") */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Key className="w-3 h-3 text-emerald-400" />
                Raw Token (No "Bearer")
              </span>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            <button
              onClick={() => copyToClipboard(status.apiKey, "rawKey")}
              disabled={!status.apiKey}
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40"
            >
              {copiedField === "rawKey" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Token</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs text-slate-200 truncate bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/5 select-all">
            {status.apiKey
              ? showToken
                ? status.apiKey
                : "•".repeat(24) + status.apiKey.slice(-8)
              : "No token configured"}
          </div>
        </div>

        {/* 4. Full Authorization Header value ("Bearer <token>") */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Key className="w-3 h-3 text-violet-400" />
              Full Authorization Header
            </span>
            <button
              onClick={() => copyToClipboard(`Bearer ${status.apiKey}`, "header")}
              disabled={!status.apiKey}
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-40"
            >
              {copiedField === "header" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Header</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs text-slate-200 truncate bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/5 select-all">
            {status.apiKey
              ? showToken
                ? `Bearer ${status.apiKey}`
                : `Bearer ${"•".repeat(20)}${status.apiKey.slice(-8)}`
              : "No token configured"}
          </div>
        </div>
      </div>

      {/* Optional helper row if Ngrok base domain is active */}
      {status.ngrokUrl && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/40 border border-white/5 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-[11px]">Ngrok Base Domain:</span>
            <span className="font-mono text-slate-300 select-all">{ngrokBaseUrl}</span>
          </div>
          <button
            onClick={() => copyToClipboard(ngrokBaseUrl, "ngrokBase")}
            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {copiedField === "ngrokBase" ? (
              <span className="text-emerald-400">Copied</span>
            ) : (
              <span>Copy Domain</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
