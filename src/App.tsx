import { useState, useEffect } from "react";
import "./App.css";

type Group = {
  link: string;
  name: string;
  suffix: string;
};

function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [message, setMessage] = useState("");
  const [finalMessage, setFinalMessage] = useState("");

  useEffect(() => {
    fetch("/whatsapp_groups.json")
      .then((res) => res.json())
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (selectedGroup && message) {
      setFinalMessage(`${message}\n${selectedGroup.suffix}`);
    } else {
      setFinalMessage("");
    }
  }, [selectedGroup, message]);

  return (
    <div
      className="container"
      style={{ maxWidth: 500, margin: "2rem auto", fontFamily: "sans-serif" }}
    >
      <h2>WhatsApp Group Message Builder</h2>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="group-select">Select Group:</label>
        <select
          id="group-select"
          style={{ marginLeft: 8, minWidth: 200 }}
          value={selectedGroup?.name || ""}
          onChange={(e) => {
            const group = groups.find((g) => g.name === e.target.value) || null;
            setSelectedGroup(group);
          }}
        >
          <option value="">-- Choose --</option>
          {groups.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="msg-input">Message:</label>
        <textarea
          id="msg-input"
          style={{
            display: "block",
            width: "100%",
            minHeight: 60,
            marginTop: 4,
          }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message here..."
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Final Message:</label>
        <textarea
          style={{
            display: "block",
            width: "100%",
            minHeight: 100,
            marginTop: 4,
            background: "#f5f5f5",
          }}
          value={finalMessage}
          readOnly
        />
        {selectedGroup && (
          <div style={{ marginTop: 8 }}>
            <a
              href={selectedGroup.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              Go to WhatsApp Group
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
