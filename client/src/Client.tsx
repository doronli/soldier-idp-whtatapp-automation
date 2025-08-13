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
  failedGroups?: FailedGroupEntry[];
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
  const [scheduleTime, setScheduleTime] = useState("");
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
          msg += ` | קבוצות שנכשלו: ${names}`;
        }
        setStatus(msg);
      } else {
        setStatus("❌ " + (data.error || "שגיאה לא ידועה"));
      }
    } catch {
      setStatus("❌ שגיאת רשת");
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
      setScheduleStatus("❌ בחר זמן");
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
          `✅ תוזמן מזהה ${data.id} ל-${new Date(data.runAt).toLocaleString(
            "he-IL"
          )}`
        );
        setMessage("");
        setScheduleTime("");
        fetchSchedules();
      } else {
        setScheduleStatus("❌ " + (data.error || "נכשל בתזמון"));
      }
    } catch {
      setScheduleStatus("❌ שגיאת רשת");
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
      setGroupMsg("❌ נדרש שם");
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
        setGroupMsg(`✅ נוסף '${data.name}'`);
        setGroupName("");
        setGroupSuffix("");
        fetchGroups();
      } else {
        setGroupMsg("❌ " + (data.error || "נכשל"));
      }
    } catch {
      setGroupMsg("❌ שגיאת רשת");
    }
    setGroupLoading(false);
  };

  const handleDeleteGroup = async (name: string) => {
    if (!confirm(`למחוק את הקבוצה '${name}'?`)) return;
    setGroupMsg(null);
    try {
      const res = await fetch(`${apiBase}/groups/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setGroupMsg(`✅ נמחק '${name}'`);
        setGroups((g) => g.filter((gr) => gr.name !== name));
      } else {
        setGroupMsg("❌ " + (data?.error || "המחיקה נכשלה"));
      }
    } catch {
      setGroupMsg("❌ שגיאת רשת");
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
      dir="rtl"
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
            textAlign: "right",
          }}
        >
          {sessionStatus.pendingQR
            ? "אנא פתח את חלון הוואטסאפ וסרוק את קוד ה-QR פעם אחת כדי לאפשר שליחות מתוזמנות."
            : "לא מחובר עדיין. ממתין לסשן של וואטסאפ ווב..."}
        </div>
      )}
      <h2>שידור וואטסאפ</h2>
      <section
        style={{
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <h3>שליחה מיידית</h3>
        <textarea
          style={{ width: "100%", minHeight: 80, marginBottom: 12 }}
          placeholder="הזן את ההודעה שלך..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={handleSend} disabled={loading || !message.trim()}>
            {loading ? "שולח..." : "שלח עכשיו"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 14 }}>זמן תזמון:</label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
            <button onClick={handleSchedule} disabled={!canSchedule()}>
              תזמן
            </button>
          </div>
        </div>
        {status && (
          <div style={{ marginTop: 12, textAlign: "right" }}>{status}</div>
        )}
        {scheduleStatus && (
          <div style={{ marginTop: 8, textAlign: "right" }}>
            {scheduleStatus}
          </div>
        )}
      </section>

      <section
        style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8 }}
      >
        <h3>ניהול קבוצות</h3>
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
            placeholder="שם הקבוצה"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={{ padding: 6, textAlign: "right" }}
          />
          <textarea
            placeholder="סיומת (אופציונלי, מופיע בשורה חדשה)"
            value={groupSuffix}
            onChange={(e) => setGroupSuffix(e.target.value)}
            style={{ padding: 6, minHeight: 70, textAlign: "right" }}
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={handleAddGroup}
              disabled={groupLoading || !groupName.trim()}
            >
              הוסף קבוצה
            </button>
            <button type="button" onClick={fetchGroups} disabled={groupLoading}>
              רענן
            </button>
          </div>
          {groupMsg && <div style={{ textAlign: "right" }}>{groupMsg}</div>}
        </div>
        {groups.length === 0 && <div>לא הוגדרו קבוצות.</div>}
        {groups.length > 0 && (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr>
                <th
                  style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}
                >
                  שם
                </th>
                <th
                  style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}
                >
                  סיומת
                </th>
                <th
                  style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}
                >
                  פעולות
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
                      textAlign: "right",
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
                      מחק
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
        <h3>הודעות מתוזמנות</h3>
        <button
          onClick={fetchSchedules}
          disabled={loadingSchedules}
          style={{ marginBottom: 12 }}
        >
          {loadingSchedules ? "מרענן..." : "רענן"}
        </button>
        {schedules.length === 0 && <div>אין תזמונים.</div>}
        {schedules.length > 0 && (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr>
                <th
                  style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}
                >
                  מזהה
                </th>
                <th
                  style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}
                >
                  זמן הפעלה
                </th>
                <th
                  style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}
                >
                  סטטוס
                </th>
                <th
                  style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}
                >
                  פרטים
                </th>
                <th
                  style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}
                >
                  פעולות
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
                      {new Date(s.runAt).toLocaleString("he-IL")}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      {s.status === "pending"
                        ? "ממתין"
                        : s.status === "sent"
                        ? "נשלח"
                        : s.status === "failed"
                        ? "נכשל"
                        : s.status}
                    </td>
                    <td style={{ padding: "4px 6px", maxWidth: 220 }}>
                      {failedList.length > 0 && (
                        <span style={{ color: "#b00020" }}>
                          נכשל: {failedList.map((f) => f.group).join(", ")}
                        </span>
                      )}
                      {s.status === "sent" &&
                        failedList.length === 0 &&
                        s.sentGroups && (
                          <span style={{ color: "#2e7d32" }}>
                            נשלח ל-{s.sentGroups.length} קבוצות
                          </span>
                        )}
                      {s.status === "failed" &&
                        failedList.length === 0 &&
                        s.error && <span title={s.error}>שגיאה</span>}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      {s.status === "pending" && (
                        <button onClick={() => cancelSchedule(s.id)}>
                          בטל
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
