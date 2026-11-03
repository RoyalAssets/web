const serviceList = document.querySelector("#service-list");
const overallStatus = document.querySelector("#overall-status");
const overallTitle = document.querySelector("#overall-title");
const overallDetail = document.querySelector("#overall-detail");
const lastChecked = document.querySelector("#last-checked");

function formatTime(value) {
  if (!value) return "Waiting for first check";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function createHistoryBars(service) {
  const bars = document.createElement("div");
  bars.className = "history-bars";
  bars.setAttribute("role", "img");
  bars.setAttribute("aria-label", "Recent check history");

  const samples = service.history || [];
  const emptySlots = Math.max(0, 30 - samples.length);
  for (let index = 0; index < emptySlots; index += 1) {
    const bar = document.createElement("span");
    bar.className = "history-bar is-unknown";
    bar.title = "No check recorded yet";
    bars.append(bar);
  }

  for (const sample of samples.slice(-30)) {
    const bar = document.createElement("span");
    bar.className = `history-bar${sample.isUp ? "" : " is-down"}`;
    bar.title = `${sample.isUp ? "Online" : "Offline"} · ${formatTime(sample.checkedAt)}`;
    bars.append(bar);
  }
  return bars;
}

function createServiceCard(service) {
  const card = document.createElement("article");
  card.className = "service-card";

  const top = document.createElement("div");
  top.className = "service-topline";

  const nameWrap = document.createElement("div");
  nameWrap.className = "service-name-wrap";
  const dot = document.createElement("span");
  dot.className = `status-dot${service.isUp === false ? " is-down" : service.isUp === null ? " is-unknown" : ""}`;
  dot.setAttribute("aria-hidden", "true");
  const name = document.createElement("h3");
  name.textContent = service.name;
  nameWrap.append(dot, name);

  const label = document.createElement("span");
  label.className = `status-label${service.isUp === false ? " is-down" : service.isUp === null ? " is-unknown" : ""}`;
  label.textContent = service.isUp === null ? "Checking" : service.isUp ? "Operational" : "Offline";
  top.append(nameWrap, label);

  const bottom = document.createElement("div");
  bottom.className = "service-bottomline";
  const metrics = document.createElement("div");
  metrics.className = "service-metrics";
  const response = document.createElement("span");
  response.textContent = service.latencyMs === null ? "No response" : `${service.latencyMs} ms response`;
  const uptime = document.createElement("span");
  uptime.className = "uptime-value";
  uptime.textContent = service.uptimePercent === null ? "—% uptime" : `${service.uptimePercent}% uptime`;
  metrics.append(response, uptime);

  const link = document.createElement("a");
  link.className = "service-open";
  link.href = service.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = `${service.url} ↗`;
  bottom.append(metrics, link);

  card.append(top, bottom, createHistoryBars(service));
  return card;
}

function render(data) {
  const services = data.services || [];
  const upCount = services.filter((service) => service.isUp === true).length;
  const downCount = services.filter((service) => service.isUp === false).length;
  const allChecked = services.length > 0 && upCount + downCount === services.length;

  overallStatus.classList.toggle("is-down", downCount > 0);
  overallStatus.classList.toggle("is-loading", !allChecked);
  const overallIcon = overallStatus.querySelector(".overall-icon");

  if (!allChecked) {
    overallTitle.textContent = "Checking services";
    overallDetail.textContent = "The monitor is collecting its first results.";
    overallIcon.textContent = "…";
  } else if (downCount === 0) {
    overallTitle.textContent = "All systems operational";
    overallDetail.textContent = `${upCount} of ${services.length} services are responding.`;
    overallIcon.textContent = "✓";
  } else {
    overallTitle.textContent = "Some services need attention";
    overallDetail.textContent = `${downCount} of ${services.length} services are not responding.`;
    overallIcon.textContent = "!";
  }

  lastChecked.textContent = `Last checked ${formatTime(data.checkedAt)}`;
  serviceList.replaceChildren(...services.map(createServiceCard));
}

async function updateStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Status server returned an error");
    render(await response.json());
  } catch {
    overallStatus.classList.add("is-down");
    overallStatus.classList.remove("is-loading");
    overallTitle.textContent = "Status monitor unavailable";
    overallDetail.textContent = "Start the Node server to check your services.";
    overallStatus.querySelector(".overall-icon").textContent = "!";
    serviceList.replaceChildren();
    const message = document.createElement("p");
    message.className = "error-message";
    message.textContent = "Could not connect to the status server.";
    serviceList.append(message);
  }
}

updateStatus();
setInterval(updateStatus, 10_000);
