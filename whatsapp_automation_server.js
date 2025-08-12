const express = require("express");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const CONFIG_FILE = path.join(__dirname, "whatsapp_groups.json");
const SESSION_FILE = path.join(__dirname, "session.json");
const SCHEDULE_FILE = path.join(__dirname, "scheduled_messages.json");

const MIN_DELAY_MS = 30 * 1000; // 30s
const MAX_FUTURE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const app = express();
const PORT = 3000;
// In-memory map of scheduleId -> timeout
const scheduleTimers = new Map();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (err) {
    console.error("Error loading config:", err.message);
    return [];
  }
}

function escapeDoubleQuotes(str = "") {
  return str.replace(/"/g, '\\"');
}

// ========== Schedule Persistence Helpers ==========
function generateId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ).toUpperCase();
}

function loadSchedules() {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return [];
    const raw = fs.readFileSync(SCHEDULE_FILE, "utf-8").trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading schedules:", e.message);
    return [];
  }
}

function saveSchedules(list) {
  try {
    const tmp = SCHEDULE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, SCHEDULE_FILE);
  } catch (e) {
    console.error("Error saving schedules:", e.message);
  }
}

function updateSchedule(id, patch) {
  const schedules = loadSchedules();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  schedules[idx] = { ...schedules[idx], ...patch };
  saveSchedules(schedules);
  return schedules[idx];
}

// ========== Scheduler Manager ==========
function scheduleTimeout(schedule) {
  const now = Date.now();
  const runAtMs = Date.parse(schedule.runAt);
  const delay = runAtMs - now;
  if (delay <= 0) {
    // run soon
    const t = setTimeout(() => executeSchedule(schedule.id), 5000);
    scheduleTimers.set(schedule.id, t);
    return;
  }
  // Clamp to max setTimeout (~24.8 days)
  const MAX_TIMEOUT = 0x7fffffff; // ~24.8 days
  const effectiveDelay = Math.min(delay, MAX_TIMEOUT);
  const t = setTimeout(() => executeSchedule(schedule.id), effectiveDelay);
  scheduleTimers.set(schedule.id, t);
}

async function executeSchedule(id) {
  const schedule = updateSchedule(id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: null,
  });
  if (!schedule) return;
  console.log(`Running schedule ${id}`);
  try {
    const { sentGroups, failedGroups } = await broadcastMessage(
      schedule.message
    );
    if (failedGroups.length) {
      updateSchedule(id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: JSON.stringify(failedGroups.slice(0, 5)),
        sentGroups,
        failedGroups,
      });
      console.log(
        `Schedule ${id} failed partial: ${failedGroups.length} failures`
      );
    } else {
      updateSchedule(id, {
        status: "sent",
        completedAt: new Date().toISOString(),
        sentGroups,
        failedGroups,
      });
      console.log(`Schedule ${id} sent successfully.`);
    }
  } catch (e) {
    updateSchedule(id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: e.message,
    });
    console.error(`Schedule ${id} error:`, e.message);
  } finally {
    const ref = scheduleTimers.get(id);
    if (ref) {
      clearTimeout(ref);
      scheduleTimers.delete(id);
    }
  }
}

function bootstrapSchedules() {
  const schedules = loadSchedules();
  const now = Date.now();
  schedules.forEach((s) => {
    if (s.status === "pending") {
      const runAtMs = Date.parse(s.runAt);
      if (isNaN(runAtMs)) return;
      scheduleTimeout(s);
      console.log(
        `Scheduled message ${s.id} for ${s.runAt}${
          runAtMs < now ? " (missed, will run soon)" : ""
        }`
      );
    }
  });
}

// Reusable broadcast function
async function broadcastMessage(message) {
  if (!message) throw new Error("Message is required");
  const groups = loadConfig();
  if (!groups.length) throw new Error("No groups found in config");

  let browser;
  const sentGroups = [];
  const failedGroups = [];
  try {
    browser = await chromium.launch({ headless: false, slowMo: 50 });
    const context = await browser.newContext({
      storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
    });
    const page = await context.newPage();
    await page.goto("https://web.whatsapp.com/");

    const qrCodeSelector = 'canvas[aria-label*="Scan this QR code"]';
    const searchBoxSelector = 'div[contenteditable="true"][data-tab="3"]';

    const isQRCodePresent = await page
      .waitForSelector(qrCodeSelector, { timeout: 5000 })
      .catch(() => null);

    if (isQRCodePresent) {
      console.log("QR code detected. Please scan with your WhatsApp app.");
      await page.waitForSelector(searchBoxSelector, { timeout: 60000 });
      await context.storageState({ path: SESSION_FILE });
      console.log("Session saved to", SESSION_FILE);
    } else {
      await page.waitForSelector(searchBoxSelector, { timeout: 50000 });
    }

    await page.waitForTimeout(1500);

    const searchShortcut =
      process.platform === "darwin" ? "Meta+K" : "Control+K";

    for (const group of groups) {
      try {
        const suffix = group.suffix ? ` ${group.suffix}` : "";
        const fullMessage = `${message}${suffix}`.trim();

        await page.keyboard.press(searchShortcut);
        await page.waitForSelector(searchBoxSelector, { timeout: 5000 });
        await page.click(searchBoxSelector);

        await page.keyboard.down(
          process.platform === "darwin" ? "Meta" : "Control"
        );
        await page.keyboard.press("A");
        await page.keyboard.up(
          process.platform === "darwin" ? "Meta" : "Control"
        );
        await page.keyboard.press("Backspace");

        await page.keyboard.type(group.name, { delay: 50 });
        await page.waitForTimeout(1000);

        const firstResultSelector = 'div[role="grid"] div[tabindex="0"]';
        await page.waitForSelector(firstResultSelector, { timeout: 10000 });
        await page.click(firstResultSelector);
        await page.waitForTimeout(800);

        const editables = page.locator('div[contenteditable="true"]');
        const editableCount = await editables.count();
        if (editableCount === 0) throw new Error("No message input found.");
        const msgBox = editables.nth(editableCount - 1);

        await msgBox.click();
        await page.keyboard.down(
          process.platform === "darwin" ? "Meta" : "Control"
        );
        await page.keyboard.press("A");
        await page.keyboard.up(
          process.platform === "darwin" ? "Meta" : "Control"
        );
        await page.keyboard.press("Backspace");

        await page.evaluate((text) => {
          const el = document.activeElement;
          el.innerHTML = "";
          el.focus();
          document.execCommand("insertText", false, text);
        }, fullMessage);

        await page.keyboard.press("Enter");
        await page.waitForTimeout(1000);
        console.log(`✅ Message sent to group: ${group.name}`);
        sentGroups.push(group.name);
      } catch (err) {
        console.error(`❌ Failed to send to ${group.name}:`, err.message);
        failedGroups.push({ group: group.name, error: err.message });
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  return { sentGroups, failedGroups };
}

// Existing endpoint now uses broadcastMessage
app.post("/send", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  try {
    const result = await broadcastMessage(message);
    res.json({ status: "Message sending completed", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== Scheduling Endpoints ==========
app.post("/schedule", (req, res) => {
  const { message, runAt } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (!runAt) {
    return res.status(400).json({ error: "runAt is required" });
  }
  const runAtMs = Date.parse(runAt);
  if (isNaN(runAtMs)) {
    return res.status(400).json({ error: "runAt is invalid ISO date" });
  }
  const now = Date.now();
  const diff = runAtMs - now;
  if (diff < MIN_DELAY_MS) {
    return res
      .status(400)
      .json({
        error: `runAt must be at least ${MIN_DELAY_MS / 1000}s in future`,
      });
  }
  if (diff > MAX_FUTURE_MS) {
    return res.status(400).json({ error: "runAt too far in future" });
  }
  const schedules = loadSchedules();
  const schedule = {
    id: generateId(),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    runAt: new Date(runAtMs).toISOString(),
    status: "pending",
    error: null,
  };
  schedules.push(schedule);
  saveSchedules(schedules);
  scheduleTimeout(schedule);
  console.log(`Scheduled message ${schedule.id} for ${schedule.runAt}`);
  res.status(201).json(schedule);
});

app.get("/schedules", (req, res) => {
  const { status } = req.query;
  let schedules = loadSchedules();
  if (status) {
    schedules = schedules.filter((s) => s.status === status);
  }
  schedules.sort((a, b) => Date.parse(a.runAt) - Date.parse(b.runAt));
  res.json(schedules);
});

app.delete("/schedule/:id", (req, res) => {
  const { id } = req.params;
  const schedules = loadSchedules();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const schedule = schedules[idx];
  if (schedule.status !== "pending") {
    return res
      .status(400)
      .json({ error: "Only pending schedules can be cancelled" });
  }
  const ref = scheduleTimers.get(id);
  if (ref) {
    clearTimeout(ref);
    scheduleTimers.delete(id);
  }
  schedules[idx] = {
    ...schedule,
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
  };
  saveSchedules(schedules);
  console.log(`Cancelled schedule ${id}`);
  res.json(schedules[idx]);
});

app.listen(PORT, () => {
  bootstrapSchedules();
  console.log(`Server running on http://localhost:${PORT}`);
});
