const express = require("express");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const CONFIG_FILE = path.join(__dirname, "whatsapp_groups.json");
const SESSION_FILE = path.join(__dirname, "session.json");
const SCHEDULE_FILE = path.join(__dirname, "scheduled_messages.json");

const MIN_DELAY_MS = 30 * 1000; // 30s
const MAX_FUTURE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// --- Persistent session constants (Step 1) ---
const USER_DATA_DIR = path.join(__dirname, ".chromium-profile");
const PERSISTENT = process.env.WA_PERSISTENT !== "false"; // default true
const LOGIN_TIMEOUT_MS =
  parseInt(process.env.WA_LOGIN_TIMEOUT_MS || "", 10) || 15 * 60 * 1000; // extended to 15m (override via WA_LOGIN_TIMEOUT_MS)
const AUTH_RETRY_INTERVAL_MS = 30 * 1000; // 30s between auth checks
const AUTH_MAX_WAIT_MS = 30 * 60 * 1000; // 30m max wait

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

// BrowserSessionManager skeleton (not yet wired into broadcastMessage)
class BrowserSessionManager {
  constructor() {
    this.initialized = false;
    this.context = null; // persistent context or transient fallback
    this.browser = null; // for non-persistent
    this.queueTail = Promise.resolve();
    this.inflightLoginCheck = null;
    this.loginPage = null; // reused page for QR scan to avoid flicker
  }
  async init() {
    if (this.initialized) return;
    if (PERSISTENT) {
      if (!fs.existsSync(USER_DATA_DIR)) {
        fs.mkdirSync(USER_DATA_DIR, { recursive: true });
      }
      this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        slowMo: 50,
      });
    } else {
      this.browser = await chromium.launch({ headless: false, slowMo: 50 });
      this.context = await this.browser.newContext({
        storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
      });
    }
    this.initialized = true;
    console.log(
      `[BrowserSessionManager] Initialized (persistent=${PERSISTENT})`
    );
  }
  enqueue(fn) {
    // Serialize tasks
    this.queueTail = this.queueTail
      .then(() => fn())
      .catch((e) => {
        console.error("[BrowserSessionManager] Task error:", e.message);
      });
    return this.queueTail;
  }
  async withPage(taskFn) {
    await this.init();
    return this.enqueue(async () => {
      // Create isolated page per task
      const page = await this.context.newPage();
      try {
        return await taskFn(page);
      } finally {
        try {
          await page.close();
        } catch (_) {}
      }
    });
  }
  async ensureLoggedIn() {
    await this.init();
    if (this.inflightLoginCheck) return this.inflightLoginCheck;
    this.inflightLoginCheck = this.enqueue(async () => {
      const searchBoxSelector = 'div[contenteditable="true"][data-tab="3"]';
      const qrSelector = 'canvas[aria-label*="Scan this QR code"]';
      const start = Date.now();
      const deadline = start + LOGIN_TIMEOUT_MS;
      let lastStatusLog = 0;

      // Create or reuse a single persistent login page (prevents flicker)
      if (!this.loginPage || this.loginPage.isClosed()) {
        this.loginPage = await this.context.newPage();
        await this.loginPage.goto("https://web.whatsapp.com/");
      }
      const page = this.loginPage;

      while (Date.now() < deadline) {
        // Check logged in
        const searchBox = await page.$(searchBoxSelector);
        if (searchBox) {
          if (!PERSISTENT) {
            try {
              await this.context.storageState({ path: SESSION_FILE });
            } catch (_) {}
          }
          if (Date.now() - lastStatusLog > 2000) {
            console.log(
              "[BrowserSessionManager] Logged in (search box detected)."
            );
            lastStatusLog = Date.now();
          }
          return true;
        }
        // Check QR presence
        const qrVisible = await page.$(qrSelector);
        if (qrVisible && Date.now() - lastStatusLog > 10000) {
          const minsLeft = Math.ceil((deadline - Date.now()) / 60000);
          console.log(
            `[BrowserSessionManager] Waiting for QR scan... (~${minsLeft}m left)`
          );
          lastStatusLog = Date.now();
        }
        // Small wait; keep page open so user can scan
        await page.waitForTimeout(3000);
      }
      const err = new Error(
        `NOT_AUTHENTICATED: Timed out (${Math.round(
          LOGIN_TIMEOUT_MS / 60000
        )}m) waiting for WhatsApp login (QR scan).`
      );
      err.code = "NOT_AUTHENTICATED";
      return Promise.reject(err);
    });
    try {
      return await this.inflightLoginCheck;
    } finally {
      this.inflightLoginCheck = null;
    }
  }
  async getStatus() {
    try {
      await this.init();
      const searchBoxSelector = 'div[contenteditable="true"][data-tab="3"]';
      const qrSelector = 'canvas[aria-label*="Scan this QR code"]';
      // Reuse persistent loginPage to avoid flicker caused by opening/closing pages
      if (!this.loginPage || this.loginPage.isClosed()) {
        this.loginPage = await this.context.newPage();
        await this.loginPage.goto("https://web.whatsapp.com/");
      } else if (!this.loginPage.url().startsWith("https://web.whatsapp.com")) {
        try {
          await this.loginPage.goto("https://web.whatsapp.com/");
        } catch (_) {}
      }
      const page = this.loginPage;
      const searchBox = await page.$(searchBoxSelector);
      if (searchBox) return { loggedIn: true, pendingQR: false };
      const qr = await page.$(qrSelector);
      if (qr) return { loggedIn: false, pendingQR: true };
      return { loggedIn: false, pendingQR: false };
    } catch (e) {
      return { loggedIn: false, pendingQR: false, error: e.message };
    }
  }
  async shutdown() {
    try {
      if (this.loginPage && !this.loginPage.isClosed()) {
        try {
          await this.loginPage.close();
        } catch (_) {}
      }
      if (this.context && PERSISTENT) {
        await this.context.close();
      } else if (this.browser) {
        await this.browser.close();
      }
    } catch (e) {
      console.error("[BrowserSessionManager] Shutdown error:", e.message);
    }
  }
}
const browserSessionManager = new BrowserSessionManager();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await browserSessionManager.shutdown();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.log("\nShutting down...");
  await browserSessionManager.shutdown();
  process.exit(0);
});

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
// Helper to fetch a single schedule
function getSchedule(id) {
  return loadSchedules().find((s) => s.id === id) || null;
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

// Added: loadConfig function required by broadcastMessage
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      console.warn(
        "[config] whatsapp_groups.json not found, returning empty list"
      );
      return [];
    }
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8").trim();
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error("Config root must be an array");
    }
    // Normalize entries
    return data
      .filter(Boolean)
      .map((g) => ({
        name: (g.name || "").trim(),
        suffix: g.suffix ? String(g.suffix) : "",
      }))
      .filter((g) => g.name);
  } catch (e) {
    console.error("[config] Failed to load groups:", e.message);
    return [];
  }
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
    if (e.code === "NOT_AUTHENTICATED") {
      const now = Date.now();
      updateSchedule(id, {
        status: "waitingAuth",
        waitingAuthSince: new Date(now).toISOString(),
        error: e.message,
      });
      console.warn(
        `Schedule ${id} waiting for authentication; will retry when logged in.`
      );
      scheduleAuthRetry(id, now);
    } else {
      updateSchedule(id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: e.message,
      });
      console.error(`Schedule ${id} error:`, e.message);
    }
  } finally {
    const ref = scheduleTimers.get(id);
    if (ref) {
      clearTimeout(ref);
      scheduleTimers.delete(id);
    }
  }
}

function scheduleAuthRetry(id, startTs) {
  setTimeout(async () => {
    const s = getSchedule(id);
    if (!s || s.status !== "waitingAuth") return; // status changed externally
    if (Date.now() - startTs > AUTH_MAX_WAIT_MS) {
      updateSchedule(id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: "Auth wait timeout exceeded",
      });
      console.error(`Schedule ${id} auth wait timeout.`);
      return;
    }
    // Check login
    try {
      const ok = await browserSessionManager.ensureLoggedIn().catch((err) => {
        if (err.code === "NOT_AUTHENTICATED") return false;
        throw err;
      });
      if (ok) {
        // Re-queue schedule quickly
        updateSchedule(id, { status: "pending", resumedAfterAuth: true });
        console.log(`Schedule ${id} re-queued after authentication.`);
        scheduleTimeout({
          id,
          runAt: new Date(Date.now() + 5000).toISOString(),
          status: "pending",
        });
        return;
      }
    } catch (err) {
      console.error(`Auth retry check error for schedule ${id}:`, err.message);
    }
    scheduleAuthRetry(id, startTs); // try again
  }, AUTH_RETRY_INTERVAL_MS);
}

// Bootstrap pending & waitingAuth schedules on startup
function bootstrapSchedules() {
  const schedules = loadSchedules();
  const now = Date.now();
  schedules.forEach((s) => {
    if (s.status === "pending") {
      scheduleTimeout(s);
      console.log(
        `(bootstrap) queued pending schedule ${s.id} for ${s.runAt}${
          Date.parse(s.runAt) < now ? " (missed, will run soon)" : ""
        }`
      );
    } else if (s.status === "waitingAuth") {
      const since = Date.parse(s.waitingAuthSince || s.runAt) || now;
      console.log(
        `(bootstrap) schedule ${s.id} waitingAuth; resuming auth polling.`
      );
      scheduleAuthRetry(s.id, since);
    }
  });
}

// Reusable broadcast function
async function broadcastMessage(message) {
  if (!message) throw new Error("Message is required");
  const groups = loadConfig();
  if (!groups.length) throw new Error("No groups found in config");

  // Ensure session/context ready (placeholder ensureLoggedIn; full logic Step 3)
  await browserSessionManager.ensureLoggedIn();

  const sentGroups = [];
  const failedGroups = [];

  return browserSessionManager.withPage(async (page) => {
    // Navigate if fresh page
    if (!page.url() || page.url() === "about:blank") {
      await page.goto("https://web.whatsapp.com/");
    }
    const searchBoxSelector = 'div[contenteditable="true"][data-tab="3"]';
    await page.waitForSelector(searchBoxSelector, { timeout: 60000 });
    await page.waitForTimeout(800);

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
        await page.waitForTimeout(900);

        const firstResultSelector = 'div[role="grid"] div[tabindex="0"]';
        await page.waitForSelector(firstResultSelector, { timeout: 10000 });
        await page.click(firstResultSelector);
        await page.waitForTimeout(600);

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
          if (el) {
            el.innerHTML = "";
            el.focus();
            document.execCommand("insertText", false, text);
          }
        }, fullMessage);

        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
        console.log(`✅ Message sent to group: ${group.name}`);
        sentGroups.push(group.name);
      } catch (err) {
        console.error(`❌ Failed to send to ${group.name}:`, err.message);
        failedGroups.push({ group: group.name, error: err.message });
      }
    }

    // Persist storageState for non-persistent fallback mode
    if (!PERSISTENT) {
      try {
        await browserSessionManager.context.storageState({
          path: SESSION_FILE,
        });
      } catch (_) {}
    }

    return { sentGroups, failedGroups };
  });
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
    return res.status(400).json({
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

// New session status endpoint (Step 5)
app.get("/session/status", async (req, res) => {
  const status = await browserSessionManager.getStatus();
  res.json(status);
});

app.listen(PORT, () => {
  bootstrapSchedules();
  console.log(`Server running on http://localhost:${PORT}`);
  // Warm-up: launch Chromium & open WhatsApp Web immediately after server is up
  (async () => {
    try {
      await browserSessionManager.init();
      // Kick off ensureLoggedIn in background so QR (if needed) shows right away
      browserSessionManager.ensureLoggedIn().catch((e) => {
        if (e.code === "NOT_AUTHENTICATED") {
          console.log("[startup] Waiting for QR scan (initial).");
        } else {
          console.error("[startup] Initial login check error:", e.message);
        }
      });
    } catch (e) {
      console.error("[startup] Browser warm-up failed:", e.message);
    }
  })();
});
