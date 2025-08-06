import React, { useState } from "react";

function Client() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("http://localhost:3000/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("✅ " + data.status);
      } else {
        setStatus("❌ " + (data.error || "Unknown error"));
      }
    } catch (err) {
      setStatus("❌ Network error");
    }
    setLoading(false);
  };

  return (
    <div
      style={{ maxWidth: 500, margin: "5rem auto", fontFamily: "sans-serif" }}
    >
      <h2>Send WhatsApp Message to All Groups</h2>
      <textarea
        style={{ width: "100%", minHeight: 80, marginBottom: 12 }}
        placeholder="Enter your message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={handleSend} disabled={loading || !message.trim()}>
        {loading ? "Sending..." : "Send to All Groups"}
      </button>
      {status && <div style={{ marginTop: 16 }}>{status}</div>}
    </div>
  );
}

export default Client;
