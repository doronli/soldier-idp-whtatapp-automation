# WhatsApp Automation – INSTRUCTIONS (Non‑technical)

This guide explains how to install and run the project on your computer. You will start the backend (server) and the app (client) and then use the browser UI.

If anything is unclear, follow the steps exactly and don’t close the Terminal windows while the app is running.

---

## 1) What you need

- An internet connection
- About 1 GB of free disk space (for the browser download)
- Git (to download the project)
- Node.js LTS v18 or newer
  - Download: https://nodejs.org (choose LTS) and install

Optional but helpful:

- A GitHub account if the repository is private

---

## 2) Get the project from GitHub

1. Open Terminal
2. Run this command (replace YOUR-REPO-URL with the real link):

   git clone YOUR-REPO-URL

3. Go into the project folder that was created:

   cd automation

If your folder name is different, use that name instead of `automation`.

---

## 3) Start the Backend (Server)

Do these steps inside the project root folder (the one that contains `whatsapp_automation_server.js`).

1. Install the server dependencies:

   npm install

2. Download the Playwright browsers (one‑time):

   npm run install-browsers

   This will download a Chromium browser used by the automation.

3. Start the server:

   npm start

Keep this Terminal window open. The server will run on: http://localhost:3000

On first run, a Chromium window will open for WhatsApp Web. Log in once:

- On your phone: open WhatsApp → Settings → Linked devices → Link a device
- Scan the QR code shown in the Chromium window

After you scan successfully, the login is saved so you won’t need to scan again next time.

---

## 4) Start the App (Client)

Open a NEW Terminal window, then:

1. Go to the client folder:

   cd automation/client

2. Install client dependencies:

   npm install

3. Start the client (development server):

   npm run dev

The app will run at: http://localhost:5173

Open that link in your regular browser (Chrome/Edge/Safari). Leave this Terminal window open.

Important: The server expects the client at http://localhost:5173, so please use the default port.

---

## 5) Using the App

- Messages tab
  - Type your message in the big box
  - Click “שלח עכשיו” to send immediately
  - Or choose a date/time and click “תזמן” to schedule
  - You can refresh and see scheduled jobs in the table
- Groups tab
  - Add a group by entering its exact WhatsApp group name
  - Optional: add a “suffix” (extra text appended on a new line)
  - You can search, edit, and delete groups in the table

Notes:

- The first time, the server may show a status message asking you to scan a QR code. Complete the scan once.
- A suffix is added after the main message on its own line.

---

## 6) Where things are stored (for reference)

- `whatsapp_groups.json` – your saved groups and suffixes
- `scheduled_messages.json` – your scheduled messages
- `.chromium-profile/` – saved WhatsApp Web login session (so you don’t need to re‑scan)
- `session.json` – additional session state (used in non‑persistent mode)

You usually do not need to open or edit these files manually. Use the UI.

---

## 7) Stopping the app

- To stop the server: go to the server Terminal window and press Ctrl+C
- To stop the client: go to the client Terminal window and press Ctrl+C

To start again later, repeat the “Start the Backend” and “Start the App” steps.

---

## 8) Troubleshooting

- I don’t see the QR code
  - Look for the Chromium window that opened when you started the server
  - If you closed it, stop the server (Ctrl+C) and run `npm start` again
- The app says it can’t connect to the server
  - Make sure the server is running (the Terminal shows “Server running on http://localhost:3000”)
  - Keep both the server and the client running
- I changed ports
  - Please keep the defaults: server on 3000 and client on 5173
- I want to re‑login to WhatsApp Web
  - Stop the server
  - Delete the `.chromium-profile` folder (inside the project root)
  - Start the server again and scan the QR code when prompted

---

## 9) Advanced (optional)

- Environment variables (only if needed):
  - `WA_PERSISTENT=false` – disable persistent session (not recommended)
  - `WA_LOGIN_TIMEOUT_MS=900000` – change how long the server waits for QR scan (in ms)

If you’re not sure, you can ignore this section.

---

You’re all set! Keep both Terminal windows running while you use the app at http://localhost:5173.
