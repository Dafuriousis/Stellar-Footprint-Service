import { isIPv4, isIPv6 } from "net";

import { Request, Response, NextFunction } from "express";

function ipToInt(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

function ipv6ToBuffer(ip: string): Buffer {
  // Expand :: shorthand
  const halves = ip.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  const buf = Buffer.alloc(16);
  groups.forEach((g, i) => buf.writeUInt16BE(parseInt(g || "0", 16), i * 2));
  return buf;
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [range, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);

  if (isIPv4(ip) && isIPv4(range)) {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
  }

  if (isIPv6(ip) && isIPv6(range)) {
    const ipBuf = ipv6ToBuffer(ip);
    const rangeBuf = ipv6ToBuffer(range);
    const fullBytes = Math.floor(prefix / 8);
    const remainBits = prefix % 8;
    for (let i = 0; i < fullBytes; i++) {
      if (ipBuf[i] !== rangeBuf[i]) return false;
    }
    if (remainBits > 0) {
      const mask = 0xff & (0xff << (8 - remainBits));
      if ((ipBuf[fullBytes] & mask) !== (rangeBuf[fullBytes] & mask))
        return false;
    }
    return true;
  }

  return false;
}

function parseCidrs(env: string | undefined): string[] {
  if (!env) return [];
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowlist = parseCidrs(process.env.IP_ALLOWLIST);
const blocklist = parseCidrs(process.env.IP_BLOCKLIST);

function matchesAny(ip: string, cidrs: string[]): boolean {
  return cidrs.some((cidr) => matchesCidr(ip, cidr));
}

export function ipFilterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ip = req.ip || req.socket.remoteAddress || "";

  if (blocklist.length > 0 && matchesAny(ip, blocklist)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (allowlist.length > 0 && !matchesAny(ip, allowlist)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
