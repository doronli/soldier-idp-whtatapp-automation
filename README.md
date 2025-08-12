# WhatsApp Automation

This project automates sending messages to multiple WhatsApp groups using Node.js, Express, Playwright, and includes a simple React client UI.

## Features

- Immediate broadcast of a message (with optional per‑group suffix) to all WhatsApp groups in `whatsapp_groups.json`.
- Session reuse (stored in `session.json`) after first QR scan.
- NEW: Schedule a future one‑off broadcast (create, list, cancel) via API or UI.
- Simple React client UI for sending & scheduling.

## Setup

### 1. Backend (Automation Server)

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

### Use the Client UI

- Open http://localhost:5173 in your browser.
- Enter your message and click "Send Now" for immediate broadcast.
- To schedule: pick a future date/time (must be ≥30s in future, ≤30 days) and click "Schedule".
- View existing schedules in the "Scheduled Messages" table; cancel pending ones.

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
