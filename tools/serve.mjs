#!/usr/bin/env node
/**
 * serve.mjs - a minimal static file server for the AILGEN site.
 *
 * Replaces `npx serve`, which launched a four-process chain
 * (npx -> npm node -> cmd -> node) that was awkward to track, could orphan
 * listeners, and forced the supervisor to resolve a .cmd shim. This is one
 * process, one PID, no shell.
 *
 * Bound to 127.0.0.1 only. This is a development preview server, not a
 * production server, and it must never be exposed on a network interface.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const getFlag = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const PORT = parseInt(getFlag("--port", "8000"), 10);
const HOST = getFlag("--host", "127.0.0.1");
const ROOT = path.resolve(getFlag("--root", process.cwd()));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".jsonc": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("bad request");
    return;
  }
  if (pathname.endsWith("/")) pathname += "index.html";

  // Contain the served path inside ROOT. A static preview server that will
  // happily serve C:\Users\... because of a ../ in the URL is a real problem.
  const target = path.resolve(path.join(ROOT, pathname));
  const rel = path.relative(ROOT, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    res.writeHead(403).end("forbidden");
    return;
  }

  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(`<h1>404</h1><p>${pathname}</p>`);
      return;
    }
    const type = MIME[path.extname(target).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": type,
      "content-length": st.size,
      // The visual audit reloads the same URLs constantly and must never be
      // served a stale copy; a 304 here silently invalidates every screenshot.
      "cache-control": "no-store, must-revalidate",
      "last-modified": st.mtime.toUTCString(),
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`serve: port ${PORT} already in use`);
  } else {
    console.error("serve: " + e.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`serve: ${ROOT}`);
  console.log(`serve: http://${HOST}:${PORT}/`);
  console.log(`serve: pid ${process.pid} on ${os.hostname()}`);
});
