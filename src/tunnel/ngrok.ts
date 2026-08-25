import ngrok from "@ngrok/ngrok";
import { config } from "../config.js";

let listener: Awaited<ReturnType<typeof ngrok.forward>> | null = null;

export async function startNgrokTunnel(): Promise<string | null> {
  if (!config.ngrok.enabled) {
    return null;
  }

  try {
    console.log("Starting ngrok tunnel...");
    const forwardOptions: Parameters<typeof ngrok.forward>[0] = {
      addr: config.port,
    };

    if (config.ngrok.authtoken) {
      forwardOptions.authtoken = config.ngrok.authtoken;
    } else {
      forwardOptions.authtoken_from_env = true;
    }

    if (config.ngrok.domain) {
      forwardOptions.domain = config.ngrok.domain;
    }

    listener = await ngrok.forward(forwardOptions);
    const tunnelUrl = listener.url();

    if (tunnelUrl) {
      try {
        const parsedHost = new URL(tunnelUrl).host.toLowerCase();
        config.allowedHosts.add(parsedHost);
      } catch {
        // Ignore URL parse errors
      }

      printNotionBanner(tunnelUrl);
    }

    return tunnelUrl;
  } catch (error) {
    console.error("Failed to start ngrok tunnel:", error);
    return null;
  }
}

export async function stopNgrokTunnel(): Promise<void> {
  if (listener) {
    try {
      await listener.close();
    } catch {
      // Ignore close errors on exit
    }
    listener = null;
  }

  try {
    await ngrok.disconnect();
    await ngrok.kill();
  } catch {
    // Ignore disconnect errors on exit
  }
}

function printNotionBanner(tunnelUrl: string): void {
  const notionUrl = `${tunnelUrl}/mcp`;
  console.log("");
  console.log("============================================================");
  console.log("             NOTION MCP AGENT CONNECTION READY             ");
  console.log("============================================================");
  console.log(`URL to paste into Notion:  ${notionUrl}`);
  console.log("");
  console.log("Authentication Header:");
  console.log("  Header Name:   Authorization");
  console.log(`  Header Value:  Bearer ${config.apiKey}`);
  console.log("============================================================");
  console.log("Keep this process running. Press Ctrl+C to stop.\n");
}
