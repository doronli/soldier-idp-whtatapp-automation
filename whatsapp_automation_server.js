const express = require("express");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const CONFIG_FILE = path.join(__dirname, "whatsapp_groups.json");
const SESSION_FILE = path.join(__dirname, "session.json");

const app = express();
const PORT = 3000;

// Allow CORS for local development (React client)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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

app.post("/send", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const groups = loadConfig();
  if (!groups.length) {
    return res.status(404).json({ error: "No groups found in config" });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: false, slowMo: 50 });
    const context = await browser.newContext({
      storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
    });
    const page = await context.newPage();
    await page.goto("https://web.whatsapp.com/");

    const qrCodeSelector = 'canvas[aria-label*="Scan this QR code"]';
    const searchBoxSelector = 'div[contenteditable="true"][data-tab="3"]'; // UPDATED
    const msgBoxSelector = 'div[contenteditable="true"][data-tab="10"]'; // UPDATED

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

    await page.waitForTimeout(2000);

    const sentGroups = [];
    const failedGroups = [];

    for (const group of groups) {
      try {
        const fullMessage = `${message}\n${group.suffix || ""}`;

        // Search group
        await page.click(searchBoxSelector);
        await page.keyboard.down("Control");
        await page.keyboard.press("A");
        await page.keyboard.up("Control");
        await page.keyboard.press("Backspace");

        await page.type(searchBoxSelector, group.name);
        await page.waitForTimeout(1500);

        const groupSelector = `span[title="${group.name}"]`;
        await page.waitForSelector(groupSelector, { timeout: 10000 });
        await page.click(groupSelector);

        // Type & send message
        const msgBox = await page.waitForSelector(msgBoxSelector, {
          timeout: 10000,
        });
        await msgBox.click();
        await page.type(msgBoxSelector, fullMessage);
        await page.keyboard.press("Enter");

        await page.waitForTimeout(1000);
        console.log(`✅ Message sent to group: ${group.name}`);
        sentGroups.push(group.name);
      } catch (err) {
        console.error(`❌ Failed to send to ${group.name}:`, err.message);
        failedGroups.push({ group: group.name, error: err.message });
      }
    }

    // await browser.close();
    res.json({ status: "Message sending completed", sentGroups, failedGroups });
  } catch (err) {
    console.error("Error in /send endpoint:", err.message);
    if (browser) await browser.close();
    res
      .status(500)
      .json({ error: "Failed to process request: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
