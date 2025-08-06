# WhatsApp Automation

This project automates sending messages to multiple WhatsApp groups using Node.js, Express, Playwright, and includes a simple React client UI.

## Features

- Send a message (with a custom suffix) to all WhatsApp groups listed in `whatsapp_groups.json`.
- Uses WhatsApp Web and browser automation (Playwright).
- Includes a React client UI for sending messages easily from your browser.

## Setup

### 1. Backend (Automation Server)

1. **Install Node.js** (https://nodejs.org/)
2. **Install dependencies:**
   ```sh
   npm install
   npm run install-browsers
   ```
3. **Edit `whatsapp_groups.json`** to add your WhatsApp group info.

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
- Enter your message and click "Send to All Groups".
- The message will be sent to all groups listed in `whatsapp_groups.json` (with their suffixes appended).

### API Usage (Optional)

You can also send messages via API:

```sh
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Your message here"}'
```

## Notes

- The script must run on a computer with a desktop environment (not headless).
- The WhatsApp Web session is saved in `whatsapp-session.json` for convenience.
- Each group in `whatsapp_groups.json` should have a `name`, `link`, and `suffix` field.

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

**For teaching/demo purposes only. Use responsibly and respect WhatsApp's terms of service.**
