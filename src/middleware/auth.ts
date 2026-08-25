import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const apiKey = req.header("x-api-key") || "";

  if (!safeEqual(bearer, config.apiKey) && !safeEqual(apiKey, config.apiKey)) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="notion-terminal-mcp"');
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
