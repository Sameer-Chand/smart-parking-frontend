
const API_BASE = "https://your-backend-name.onrender.com";

const VEHICLE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
const MOBILE_REGEX = /^[0-9]{10}$/;

const state = {
  sessionId: "",
  slot: null,
  entryTime: null,
  carNumber: "",
  nav: null,
};

const views = {
  entry: document.getElementById("entryView"),
  slot: document.getElementById("slotView"),
  nav: document.getElementById("navView"),
  ticket: document.getElementById("ticketView"),
};

const carInput = document.getElementById("carNumber");
const driverInput = document.getElementById("driverName");
const mobileInput = document.getElementById("mobileNumber");
const carError = document.getElementById("carError");
const mobileError = document.getElementById("mobileError");

function showError(msg = "") {
  const box = document.getElementById("errorBox");
  box.textContent = msg;
  box.classList.toggle("hidden", !msg);
}

function toggleFieldError(el, show) {
  el.classList.toggle("hidden", !show);
}

function setView(key) {
  Object.entries(views).forEach(([name, el]) => {
    el.classList.toggle("hidden", name !== key);
  });
}

function sanitizeVehicle(value) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
}

function sanitizeMobile(value) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function validateVehicle(value) {
  return VEHICLE_REGEX.test(value);
}

function validateMobile(value) {
  return MOBILE_REGEX.test(value);
}

function formatEntryTime(isoText) {
  if (!isoText) return "-";
  const dt = new Date(isoText);
  const datePart = dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = dt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${timePart} | ${datePart}`;
}

function parseSlot(slotNumber) {
  const cleaned = slotNumber || "A1-01";
  const [left, right] = cleaned.split("-");
  const section = left.slice(0, 1) || "A";
  const floor = left.slice(1) || "1";
  return {
    section,
    floor,
    pretty: `${section}-${Number(right || "1")}`,
  };
}

function ticketIdFromSession(sessionId) {
  if (!sessionId) return "#SP-000000";
  const chunk = sessionId.replace(/-/g, "").slice(0, 7).toUpperCase();
  return `#SP-${chunk}`;
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Something went wrong");
  }

  return res.json();
}

async function submitEntry(event) {
  event.preventDefault();
  showError();

  const car_number = sanitizeVehicle(carInput.value);
  const driver_name = driverInput.value.trim();
  const mobile_number = sanitizeMobile(mobileInput.value);

  carInput.value = car_number;
  mobileInput.value = mobile_number;

  const isVehicleValid = validateVehicle(car_number);
  const isMobileValid = validateMobile(mobile_number);

  toggleFieldError(carError, !isVehicleValid);
  toggleFieldError(mobileError, !isMobileValid);

  if (!isVehicleValid || !isMobileValid) {
    return;
  }

  try {
    const data = await fetchJSON(`${API_BASE}/api/entry`, {
      method: "POST",
      body: JSON.stringify({ car_number, driver_name, mobile_number }),
    });

    state.sessionId = data.session_id;
    state.slot = data.slot;
    state.entryTime = data.entry_time;
    state.carNumber = car_number;

    const parsed = parseSlot(data.slot.slot_number);
    document.getElementById("slotCode").textContent = parsed.pretty;
    document.getElementById("slotLocation").textContent = `Level ${parsed.floor}, Row ${parsed.section}`;

    document.getElementById("mapSlot").textContent = parsed.pretty;
    document.getElementById("navTitle").textContent = `Heading towards Level ${parsed.floor}`;
    document.getElementById("navStep").textContent = `Turn right after the first row to find Slot ${parsed.pretty}.`;

    setView("slot");
  } catch (err) {
    showError(err.message);
  }
}

async function goNavigation() {
  showError();

  try {
    state.nav = await fetchJSON(`${API_BASE}/api/navigation/${state.sessionId}`);
    setView("nav");
  } catch (err) {
    showError(err.message);
  }
}

async function confirmReached() {
  showError();

  try {
   await fetchJSON(`${API_BASE}/api/park/${state.sessionId}/confirm`, { method: "POST" });

    const parsed = parseSlot(state.slot.slot_number);
    document.getElementById("ticketId").textContent = ticketIdFromSession(state.sessionId);
    document.getElementById("ticketVehicle").textContent = state.carNumber;
    document.getElementById("ticketSlot").textContent = parsed.pretty;
    document.getElementById("ticketTime").textContent = formatEntryTime(state.entryTime);

    setView("ticket");
  } catch (err) {
    showError(err.message);
  }
}

function downloadTicket() {
  const ticketText = [
    "SMART PARKING TICKET",
    document.getElementById("ticketId").textContent,
    `Vehicle: ${document.getElementById("ticketVehicle").textContent}`,
    `Slot: ${document.getElementById("ticketSlot").textContent}`,
    `Entry Time: ${document.getElementById("ticketTime").textContent}`,
  ].join("\n");

  const blob = new Blob([ticketText], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "parking-ticket.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

carInput.addEventListener("input", () => {
  carInput.value = sanitizeVehicle(carInput.value);
  toggleFieldError(carError, carInput.value.length > 0 && !validateVehicle(carInput.value));
});

mobileInput.addEventListener("input", () => {
  mobileInput.value = sanitizeMobile(mobileInput.value);
  toggleFieldError(mobileError, mobileInput.value.length > 0 && !validateMobile(mobileInput.value));
});

document.getElementById("entryForm").addEventListener("submit", submitEntry);
document.getElementById("toNavBtn").addEventListener("click", goNavigation);
document.getElementById("confirmBtn").addEventListener("click", confirmReached);
document.getElementById("downloadBtn").addEventListener("click", downloadTicket);

setView("entry");
