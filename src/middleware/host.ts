import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

export function validateHost(req: Request, res: Response, next: NextFunction): void {
  const host = (req.header("host") || "").toLowerCase();

  const allowed =
    config.allowedHosts.size === 0 ||
    [...config.allowedHosts].some((pattern) => {
      if (pattern.startsWith("*.")) {
        const hostname = host.replace(/:\d+$/, "");
        return hostname.endsWith(pattern.slice(1)) && hostname.length > pattern.length - 1;
      }
      return pattern === host;
    });

  if (!allowed) {
    res.status(421).json({ error: "Host header is not allowed" });
    return;
  }

  next();
}
