import { useState, useEffect } from "react";

interface FailedGroupEntry {
  group: string;
  error?: string;
}

interface ScheduleItem {
  id: string;
  runAt: string;
  status: string;
  message?: string;
  error?: string | null;
  sentGroups?: string[];
  failedGroups?: FailedGroupEntry[]; // added failed group details
}

interface SessionStatus {
  loggedIn: boolean;
  pendingQR: boolean;
  error?: string;
}

interface Group {
  name: string;
  suffix: string;
}

function Client() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Scheduling state
  const [scheduleTime, setScheduleTime] = useState(""); // local datetime-local value
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Groups management state
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupSuffix, setGroupSuffix] = useState("");
  const [groupMsg, setGroupMsg] = useState<string | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(
    null
  );

  const apiBase = "http://localhost:3000";

  const handleSend = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (res.ok) {
        let msg = "✅ " + data.status;
        const failedGroups: FailedGroupEntry[] = Array.isArray(
          data.failedGroups
        )
          ? data.failedGroups
          : [];
        if (failedGroups.length) {
          const names = failedGroups.map((g) => g.group).join(", ");
          msg += ` | Failed groups: ${names}`;
        }
        setStatus(msg);
      } else {
        setStatus("❌ " + (data.error || "Unknown error"));
      }
    } catch {
      setStatus("❌ Network error");
    }
    setLoading(false);
  };

  const fetchSchedules = async () => {
    try {
      setLoadingSchedules(true);
      const res = await fetch(`${apiBase}/schedules`);
      const data = await res.json();
      if (Array.isArray(data)) setSchedules(data as ScheduleItem[]);
    } catch {
      // ignore
    } finally {
      setLoadingSchedules(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${apiBase}/groups`);
      const data = await res.json();
      if (Array.isArray(data)) setGroups(data);
    } catch {
      // ignore
    }
  };

  const fetchSessionStatus = async () => {
    try {
      const res = await fetch(`${apiBase}/session/status`);
      const data = await res.json();
      setSessionStatus(data);
    } catch {
      setSessionStatus(null);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchSessionStatus();
    fetchGroups();
    const int = setInterval(() => {
      fetchSchedules();
      fetchSessionStatus();
      fetchGroups();
    }, 60000);
    return () => clearInterval(int);
  }, []);

  const handleSchedule = async () => {
    setScheduleStatus(null);
    if (!scheduleTime) {
      setScheduleStatus("❌ Choose a time");
      return;
    }
    try {
      const local = new Date(scheduleTime);
      const iso = local.toISOString();
      const res = await fetch(`${apiBase}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, runAt: iso }),
      });
      const data = await res.json();
      if (res.ok) {
        setScheduleStatus(
          `✅ Scheduled id ${data.id} for ${new Date(
            data.runAt
          ).toLocaleString()}`
        );
        setMessage("");
        setScheduleTime("");
        fetchSchedules();
      } else {
        setScheduleStatus("❌ " + (data.error || "Failed to schedule"));
      }
    } catch {
      setScheduleStatus("❌ Network error");
    }
  };

  const cancelSchedule = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/schedule/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchSchedules();
      }
    } catch {
      // ignore
    }
  };

  const handleAddGroup = async () => {
    setGroupMsg(null);
    if (!groupName.trim()) {
      setGroupMsg("❌ Name required");
      return;
    }
    setGroupLoading(true);
    try {
      const res = await fetch(`${apiBase}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, suffix: groupSuffix }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroupMsg(`✅ Added '${data.name}'`);
        setGroupName("");
        setGroupSuffix("");
        fetchGroups();
      } else {
        setGroupMsg("❌ " + (data.error || "Failed"));
      }
    } catch {
      setGroupMsg("❌ Network error");
    }
    setGroupLoading(false);
  };

  const handleDeleteGroup = async (name: string) => {
    if (!confirm(`Delete group '${name}'?`)) return;
    setGroupMsg(null);
    try {
      const res = await fetch(`${apiBase}/groups/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setGroupMsg(`✅ Deleted '${name}'`);
        setGroups((g) => g.filter((gr) => gr.name !== name));
      } else {
        setGroupMsg("❌ " + (data?.error || "Delete failed"));
      }
    } catch {
      setGroupMsg("❌ Network error");
    }
  };

  const canSchedule = () => {
    if (!message.trim() || !scheduleTime) return false;
    try {
      const dt = new Date(scheduleTime);
      if (isNaN(dt.getTime())) return false;
      if (dt.getTime() - Date.now() < 30000) return false; // <30s
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div
      style={{ maxWidth: 800, margin: "2rem auto", fontFamily: "sans-serif" }}
    >
      {sessionStatus && !sessionStatus.loggedIn && (
        <div
          style={{
            background: sessionStatus.pendingQR ? "#fff3cd" : "#f8d7da",
            color: "#333",
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 16,
            border: "1px solid #eed",
          }}
        >
          {sessionStatus.pendingQR
            ? "Please open the WhatsApp window and scan the QR code once to enable scheduled sends."
            : "Not logged in yet. Waiting for WhatsApp Web session..."}
        </div>
      )}
      <h2>WhatsApp Broadcast</h2>
      <section
        style={{
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <h3>Immediate Send</h3>
        <textarea
          style={{ width: "100%", minHeight: 80, marginBottom: 12 }}
          placeholder="Enter your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={handleSend} disabled={loading || !message.trim()}>
            {loading ? "Sending..." : "Send Now"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 14 }}>Schedule time:</label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
            <button onClick={handleSchedule} disabled={!canSchedule()}>
              Schedule
            </button>
          </div>
        </div>
        {status && <div style={{ marginTop: 12 }}>{status}</div>}
        {scheduleStatus && <div style={{ marginTop: 8 }}>{scheduleStatus}</div>}
      </section>

      <section
        style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8 }}
      >
        <h3>Manage Groups</h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={{ padding: 6 }}
          />
          <textarea
            placeholder="Suffix (optional, appears on new line)"
            value={groupSuffix}
            onChange={(e) => setGroupSuffix(e.target.value)}
            style={{ padding: 6, minHeight: 70 }}
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={handleAddGroup}
              disabled={groupLoading || !groupName.trim()}
            >
              Add Group
            </button>
            <button type="button" onClick={fetchGroups} disabled={groupLoading}>
              Refresh
            </button>
          </div>
          {groupMsg && <div>{groupMsg}</div>}
        </div>
        {groups.length === 0 && <div>No groups defined.</div>}
        {groups.length > 0 && (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                >
                  Name
                </th>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                >
                  Suffix
                </th>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.name} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "4px 6px", fontWeight: 500 }}>
                    {g.name}
                  </td>
                  <td
                    style={{
                      padding: "4px 6px",
                      whiteSpace: "pre-wrap",
                      maxWidth: 260,
                    }}
                  >
                    {g.suffix
                      ? g.suffix.length > 120
                        ? g.suffix.slice(0, 120) + "…"
                        : g.suffix
                      : null}
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <button onClick={() => handleDeleteGroup(g.name)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section
        style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8 }}
      >
        <h3>Scheduled Messages</h3>
        <button
          onClick={fetchSchedules}
          disabled={loadingSchedules}
          style={{ marginBottom: 12 }}
        >
          {loadingSchedules ? "Refreshing..." : "Refresh"}
        </button>
        {schedules.length === 0 && <div>No schedules.</div>}
        {schedules.length > 0 && (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                >
                  ID
                </th>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                >
                  Run At
                </th>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                >
                  Status
                </th>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                >
                  Details
                </th>
                <th
                  style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => {
                const failedList = Array.isArray(s.failedGroups)
                  ? s.failedGroups
                  : [];
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "4px 6px" }}>{s.id}</td>
                    <td style={{ padding: "4px 6px" }}>
                      {new Date(s.runAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "4px 6px" }}>{s.status}</td>
                    <td style={{ padding: "4px 6px", maxWidth: 220 }}>
                      {failedList.length > 0 && (
                        <span style={{ color: "#b00020" }}>
                          Failed: {failedList.map((f) => f.group).join(", ")}
                        </span>
                      )}
                      {s.status === "sent" &&
                        failedList.length === 0 &&
                        s.sentGroups && (
                          <span style={{ color: "#2e7d32" }}>
                            Sent to {s.sentGroups.length} group(s)
                          </span>
                        )}
                      {s.status === "failed" &&
                        failedList.length === 0 &&
                        s.error && <span title={s.error}>Error</span>}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      {s.status === "pending" && (
                        <button onClick={() => cancelSchedule(s.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default Client;
