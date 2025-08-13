# WhatsApp Automation

This project automates sending messages to multiple WhatsApp groups using Node.js, Express, Playwright, and includes a simple React client UI.

## Features

- Immediate broadcast of a message (with optional per‑group suffix) to all WhatsApp groups in `whatsapp_groups.json`.
- Persistent WhatsApp Web session (first QR scan only) using a reusable browser profile (`.chromium-profile`).
- Schedule a future one‑off broadcast (create, list, cancel) via API or UI.
- Session status endpoint & UI banner indicating when a QR scan is required.
- Manage WhatsApp groups (list/add/delete) via API & UI (dynamic without restart).
- Simple React client UI for sending, scheduling, and managing groups.

## Setup

See [Introduction](./introduction.md) for a detailed overview.

1. **Install Node.js** (https://nodejs.org/)
2. **Install dependencies:**
   ```sh
   npm install
   npm run install-browsers
   ```
3. **Edit `whatsapp_groups.json`** to add your WhatsApp group info (see example below). `scheduled_messages.json` will be created automatically when you first schedule something.

### 2. Frontend (React Client)

1. **Navigate to the client folder:**
   ```sh
   cd client
   ```
2. **Install client dependencies:**
   ```sh
   npm install
   ```
3. **Start the client UI:**
   ```sh
   npm run dev
   ```
   The client will be available at http://localhost:5173

## Usage

### Start the Automation Server

```sh
npm start
```

- The first time, a browser window will open for WhatsApp Web. Scan the QR code and press Enter in the terminal to continue.

### First Login (Persistent Session)

On first run (or if you manually remove `.chromium-profile`):

1. A Chromium window opens at WhatsApp Web with a QR code.
2. Open WhatsApp on your phone → Linked Devices → Link a device → scan the QR.
3. Once the chat list loads, the backend detects you are logged in; future sends & schedules proceed without further scans.
4. If you ever log out on your phone, the QR will reappear; the UI banner / `GET /session/status` will indicate login is needed again.

Environment flag: set `WA_PERSISTENT=false` to revert to the older ephemeral session mode (not recommended for scheduling).

### Session Status API

Check whether authentication is active:

```sh
curl http://localhost:3000/session/status
```

Returns e.g.:

```json
{ "loggedIn": true, "pendingQR": false }
```

or when waiting for scan:

```json
{ "loggedIn": false, "pendingQR": true }
```

### Use the Client UI

- Open http://localhost:5173 in your browser.
- Enter your message and click "Send Now" for immediate broadcast.
- To schedule: pick a future date/time (must be ≥30s in future, ≤30 days) and click "Schedule".
- View existing schedules in the "Scheduled Messages" table; cancel pending ones.
- Manage groups in the "Groups" section: add new groups, delete existing ones, and view all groups.

### API Usage

#### Immediate Send

```sh
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Your message here"}'
```

#### Schedule a Future Broadcast

```sh
curl -X POST http://localhost:3000/schedule \
  -H "Content-Type: application/json" \
  -d '{"message":"Promo starts soon","runAt":"2025-08-14T12:30:00.000Z"}'
```

Response example:

```json
{
  "id": "MB5V2J...",
  "message": "Promo starts soon",
  "createdAt": "2025-08-13T10:00:00.000Z",
  "runAt": "2025-08-14T12:30:00.000Z",
  "status": "pending",
  "error": null
}
```

#### List All Schedules

```sh
curl http://localhost:3000/schedules
```

(Optional) filter by status:

```sh
curl 'http://localhost:3000/schedules?status=pending'
```

#### Cancel a Pending Schedule

```sh
curl -X DELETE http://localhost:3000/schedule/<SCHEDULE_ID>
```

Returns the cancelled schedule (status becomes `cancelled`). Only `pending` schedules can be cancelled.

#### Group Management (NEW)

List groups:

```sh
curl http://localhost:3000/groups
```

Add group:

```sh
curl -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -d '{"name":"My Group","suffix":"Thanks!"}'
```

Delete group (URL-encode name if needed):

```sh
curl -X DELETE "http://localhost:3000/groups/My%20Group"
```

Response examples:

```json
[{ "name": "My Group", "suffix": "Thanks!" }]
```

```json
{ "name": "My Group", "suffix": "Thanks!" }
```

```json
{ "deleted": true }
```

Validation errors return 400 with `{ "error": "..." }`.

## Troubleshooting

| Issue                                       | Cause                                   | Action                                                  |
| ------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `/session/status` shows `pendingQR: true`   | Not logged in yet / logged out remotely | Open browser window and scan QR                         |
| Scheduled job failed with NOT_AUTHENTICATED | QR was not scanned before timeout       | Scan QR then reschedule                                 |
| Browser window closes unexpectedly          | Crash or manual close                   | Restart server; persistent profile will re-open         |
| Need to reset session                       | Corrupted profile / want fresh login    | Stop server, delete `.chromium-profile` folder, restart |

### Schedule File

`schedule_messages.json` (typo? correct is `scheduled_messages.json`) stores an array of schedule records with status transitions: `pending -> running -> sent|failed` (or `cancelled`). You can safely delete the file to clear history (pending jobs will also be lost).

## Notes

- Must run on a machine with GUI (uses a visible Chromium; headless not recommended for QR scan reliability).
- WhatsApp Web session is saved in `session.json` automatically after first login.
- Each group object supports: `name`, `link` (optional for automation, used for documentation), `suffix` (optional appended to message).
- Respect WhatsApp Terms of Service; avoid spamming.

## Example `whatsapp_groups.json`

```json
[
  {
    "link": "https://chat.whatsapp.com/your-group-link",
    "name": "Group Name",
    "suffix": "Your custom suffix here"
  }
]
```

---

For teaching/demo purposes only. Use responsibly.
