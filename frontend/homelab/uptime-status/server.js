const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const PREFERRED_PORT = Number(process.env.PORT || 3001);
const HOMELAB_DIR = path.resolve(__dirname, "..");
const STATUS_PUBLIC_DIR = path.join(__dirname, "public");
const BACKGROUND_VIDEO = path.resolve(__dirname, "../../portfolio/background.mp4");
const CHECK_EVERY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;
const HISTORY_LIMIT = 120;

const SERVICES = [
  { id: "uptime", name: "Service Uptime", url: "http://uptime.cu-o.com" },
  { id: "jellyfin", name: "Jellyfin", url: "http://jellyfin.cu-o.com" },
  { id: "jellyseerr", name: "Jellyseerr", url: "http://jellyseerr.cu-o.com" },
  { id: "adguard", name: "AdGuard Home", url: "http://adguard.cu-o.com" },
  { id: "radarr", name: "Radarr", url: "http://radarr.cu-o.com" },
  { id: "sonarr", name: "Sonarr", url: "http://sonarr.cu-o.com" },
  { id: "prowlarr", name: "Prowlarr", url: "http://prowlarr.cu-o.com" },
  { id: "qbittorrent", name: "qBittorrent", url: "http://qbittorrent.cu-o.com" },
];

const status = new Map(
  SERVICES.map((service) => [service.id, { isUp: null, latencyMs: null, httpStatus: null, checkedAt: null, history: [] }]),
);

async function checkService(service) {
  const startedAt = performance.now();
  let isUp = false;
  let latencyMs = null;
  let httpStatus = null;

  try {
    const response = await fetch(service.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    latencyMs = Math.round(performance.now() - startedAt);
    httpStatus = response.status;
    isUp = response.status < 500;
    if (response.body) response.body.cancel().catch(() => {});
  } catch {
    latencyMs = Math.round(performance.now() - startedAt);
  }

  const checkedAt = new Date().toISOString();
  const entry = status.get(service.id);
  entry.isUp = isUp;
  entry.latencyMs = latencyMs;
  entry.httpStatus = httpStatus;
  entry.checkedAt = checkedAt;
  entry.history.push({ isUp, checkedAt });
  if (entry.history.length > HISTORY_LIMIT) entry.history.shift();
}

let checkInProgress = false;
async function runCheckCycle() {
  if (checkInProgress) return;
  checkInProgress = true;
  try {
    await Promise.all(SERVICES.map(checkService));
  } finally {
    checkInProgress = false;
  }
}

function sendJson(response, value, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function sendFile(response, filePath) {
  fs.stat(filePath, (statError, fileStat) => {
    if (statError || !fileStat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentTypes = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mp4": "video/mp4",
    };
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Content-Length": fileStat.size,
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  if (requestUrl.pathname === "/api/status") {
    const services = SERVICES.map((service) => {
      const current = status.get(service.id);
      const history = current.history;
      const uptimePercent = history.length
        ? Math.round((history.filter((item) => item.isUp).length / history.length) * 1000) / 10
        : null;
      return { ...service, ...current, uptimePercent };
    });
    sendJson(response, {
      services,
      checkedAt: services.reduce((latest, service) =>
        service.checkedAt && service.checkedAt > latest ? service.checkedAt : latest, ""),
      intervalSeconds: CHECK_EVERY_MS / 1000,
      historySamples: HISTORY_LIMIT,
    });
    return;
  }

  if (requestUrl.pathname === "/background.mp4" || requestUrl.pathname === "/portfolio/background.mp4") {
    sendFile(response, BACKGROUND_VIDEO);
    return;
  }

  if (requestUrl.pathname === "/status") {
    response.writeHead(302, { Location: "/status/" });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }
  const isStatusPage = pathname === "/status/" || pathname.startsWith("/status/");
  const baseDirectory = isStatusPage ? STATUS_PUBLIC_DIR : HOMELAB_DIR;
  if (isStatusPage) pathname = pathname.slice("/status".length) || "/";
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(baseDirectory, `.${pathname}`);
  if (filePath !== baseDirectory && !filePath.startsWith(baseDirectory + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  sendFile(response, filePath);
});

function startServer(port) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && !process.env.PORT && port < PREFERRED_PORT + 10) {
      console.log(`Port ${port} is busy; trying port ${port + 1}...`);
      startServer(port + 1);
      return;
    }
    console.error(`Could not start the Homelab server on port ${port}.`, error.message);
    process.exitCode = 1;
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Homelab dashboard: http://localhost:${port}/`);
    console.log(`Uptime monitor:    http://localhost:${port}/status/`);
    runCheckCycle();
    setInterval(runCheckCycle, CHECK_EVERY_MS);
  });
}

startServer(PREFERRED_PORT);
