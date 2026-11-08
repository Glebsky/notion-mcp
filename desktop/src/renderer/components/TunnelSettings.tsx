import { AlertTriangle, ExternalLink, Globe, Info } from "lucide-react";
import type { EnvConfig, TunnelProvider } from "../../types";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../lib/shadcn/ui";
import { SettingsField } from "./SettingsField";
const providers: { id: TunnelProvider; title: string; description: string; docs: string }[] = [
  { id: "none", title: "No tunnel · Local only", description: "No external tunnel process. Use the local MCP address on this computer or your own explicitly configured network route.", docs: "" },
  { id: "ngrok", title: "ngrok · Built-in SDK", description: "No separate CLI needed. An ngrok account/auth token is required. Domain availability, traffic and fixed addresses depend on your ngrok plan.", docs: "https://ngrok.com/docs/" },
  { id: "tuna", title: "Tuna · Installed CLI", description: "Install Tuna separately and sign in with tuna login, or provide a Tuna API key with tunnels:connect permission. Dynamic and assigned free subdomains are available; custom names/domains may require a subscription.", docs: "https://tuna.am/docs/tunnels/http/" },
  { id: "cloudflare", title: "Cloudflare Tunnel · Installed CLI", description: "Install cloudflared separately. A named tunnel with a routed public hostname is recommended for MCP. Quick Tunnels are temporary and do not support SSE.", docs: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/" },
  { id: "localtunnel", title: "LocalTunnel · Experimental CLI", description: "Install explicitly with npm install -g localtunnel. The public service can require a password/interstitial page; automatic MCP clients may not connect. Addresses and requested subdomains are not guaranteed.", docs: "https://github.com/localtunnel/localtunnel" },
];
export function TunnelSettings({ config, onChange }: { config: EnvConfig; onChange: (config: EnvConfig) => void }) {
  const provider = providers.find(item => item.id === config.TUNNEL_PROVIDER) || providers[0]!;
  const field = { config, onChange };
  return <section className="settings-section" aria-labelledby="tunnel-section">
    <h3 className="settings-section-heading" id="tunnel-section"><Globe/> Public connection</h3>
    <label className="settings-field" htmlFor="tunnel-provider">Tunnel provider</label>
    <Select value={config.TUNNEL_PROVIDER} onValueChange={value => onChange({ ...config, TUNNEL_PROVIDER: value as TunnelProvider })}>
      <SelectTrigger id="tunnel-provider" className="mt-2" aria-describedby="provider-summary"><SelectValue/></SelectTrigger>
      <SelectContent>{providers.map(item => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
    </Select>
    <div className="settings-provider" key={config.TUNNEL_PROVIDER}>
      <div className="settings-provider-summary" id="provider-summary"><Info/><p>{provider.description}</p></div>
      {config.TUNNEL_PROVIDER === "ngrok" && <div className="settings-grid">
        <SettingsField {...field} name="NGROK_DOMAIN" label="Static domain · optional" placeholder="your-name.ngrok-free.app" note="Must belong to your ngrok account."/>
        <SettingsField {...field} name="NGROK_AUTHTOKEN" label="ngrok auth token" type="password" autoComplete="new-password" placeholder="Or use the ngrok environment"/>
      </div>}
      {config.TUNNEL_PROVIDER === "tuna" && <div className="settings-grid">
        <SettingsField {...field} name="TUNA_SUBDOMAIN" label="Assigned subdomain · optional" placeholder="brave-otter-4821" note="Use the subdomain assigned to your Tuna account, not a guessed domain."/>
        <SettingsField {...field} name="TUNA_API_KEY" label="Tuna API key · optional" type="password" autoComplete="new-password" placeholder="Or use tuna login"/>
        <SettingsField {...field} wide name="TUNA_EXECUTABLE" label="Tuna executable · optional" placeholder="tuna" note="Absolute executable path, or leave empty to use PATH. No command arguments."/>
      </div>}
      {config.TUNNEL_PROVIDER === "cloudflare" && <div className="settings-grid">
        <div className="settings-field settings-wide"><label htmlFor="cloudflare-mode">Cloudflare mode</label>
          <Select value={config.CLOUDFLARE_MODE} onValueChange={value => onChange({ ...config, CLOUDFLARE_MODE: value === "named" ? "named" : "quick" })}>
            <SelectTrigger id="cloudflare-mode"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="named">Named tunnel · Recommended for MCP/SSE</SelectItem><SelectItem value="quick">Quick Tunnel · Temporary, no SSE</SelectItem></SelectContent>
          </Select>
        </div>
        {config.CLOUDFLARE_MODE === "named" && <>
          <SettingsField {...field} name="CLOUDFLARE_PUBLIC_URL" label="Routed HTTPS origin" required type="url" placeholder="https://mcp.example.com" note="In Cloudflare, route this hostname to http://127.0.0.1:PORT. No path or trailing /mcp."/>
          <SettingsField {...field} name="CLOUDFLARE_TUNNEL_TOKEN" label="Connector token" required type="password" autoComplete="new-password" note="From your tunnel's connector setup. Passed through the environment, not command arguments."/>
        </>}
        <SettingsField {...field} wide name="CLOUDFLARED_EXECUTABLE" label="cloudflared executable · optional" placeholder="cloudflared"/>
      </div>}
      {config.TUNNEL_PROVIDER === "localtunnel" && <div className="settings-grid">
        <SettingsField {...field} name="LOCALTUNNEL_SUBDOMAIN" label="Requested subdomain · optional" placeholder="my-mcp-server" note="3–63 lowercase letters, digits or hyphens; availability is not guaranteed."/>
        <SettingsField {...field} name="LOCALTUNNEL_EXECUTABLE" label="LocalTunnel executable · optional" placeholder="lt" note="Uses the installed global CLI; no automatic npx download."/>
      </div>}
      {config.TUNNEL_PROVIDER === "cloudflare" && config.CLOUDFLARE_MODE === "quick" && <div className="settings-alert mt-3"><AlertTriangle/><p>No SSE support: /sse and streaming MCP responses may fail. This mode is marked unverified, not a verified MCP endpoint.</p></div>}
      {config.TUNNEL_PROVIDER === "localtunnel" && <div className="settings-alert mt-3"><AlertTriangle/><p>Experimental, unverified MCP endpoint. Password/browser warning pages cannot be solved by the MCP Bearer token. Check with your actual MCP client; do not rely on this provider for permanent access.</p></div>}
      {provider.docs && <Button variant="ghost" size="sm" className="mt-2" onClick={() => window.electronAPI.openExternal(provider.docs)}><ExternalLink/> Official setup & limitations</Button>}
      <p className="settings-note">Saving does not switch a running tunnel. Restart the server explicitly to apply changes. Provider credentials do not replace MCP Bearer authentication.</p>
    </div>
  </section>;
}
