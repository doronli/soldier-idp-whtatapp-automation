const express = require("express");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const CONFIG_FILE = path.join(__dirname, "whatsapp_groups.json");

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
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

function getGroupConfig(groups, groupName) {
  return groups.find((g) => g.name.trim() === groupName.trim());
}

app.post("/send", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }
  const groups = loadConfig();
  if (!groups.length) {
    return res.status(404).json({ error: "No groups found" });
  }
  try {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      storageState: path.join(__dirname, "whatsapp_groups.json"),
    });
    const page = await context.newPage();
    await page.goto("https://web.whatsapp.com/");
    await page.waitForSelector('div[title="Search input textbox"]', {
      timeout: 0,
    });
    // Wait for user to scan QR code if needed
    console.log(
      "Scan QR code if needed, then press Enter in the terminal to continue..."
    );
    await new Promise((resolve) => process.stdin.once("data", resolve));
    for (const group of groups) {
      const fullMessage = `${message}\n${group.suffix}`;
      await page.click('div[title="Search input textbox"]');
      await page.fill('div[title="Search input textbox"]', group.name);
      await page.waitForTimeout(2000);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      const msgBox = await page.waitForSelector('div[title="Type a message"]', {
        timeout: 10000,
      });
      await msgBox.click();
      await msgBox.type(fullMessage);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);
      console.log(`Message sent to group: ${group.name}`);
    }
    await browser.close();
    res.json({ status: `Message sent to all groups!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
