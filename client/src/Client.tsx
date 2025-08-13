import { useState, useEffect, useRef } from "react";

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
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const max = 600; // px cap
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  };

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

  useEffect(() => {
    if (messageRef.current) autoResize(messageRef.current);
  }, [message]);

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
    <div dir="rtl" className="app-shell">
      <div className="top-bar">
        <div>
          <h1 className="hero-title">מערכת שידור וואטסאפ</h1>
          <p className="hero-sub">
            ניהול הודעות, תזמונים וקבוצות בצורה מהירה ומתקדמת
          </p>
        </div>
        {sessionStatus && (
          <div
            className={
              "badge " +
              (sessionStatus.loggedIn
                ? "online"
                : sessionStatus.pendingQR
                ? "pending"
                : "offline")
            }
          >
            {sessionStatus.loggedIn
              ? "מחובר"
              : sessionStatus.pendingQR
              ? "דרוש סריקת QR"
              : "לא מחובר"}
          </div>
        )}
      </div>

      {sessionStatus && !sessionStatus.loggedIn && (
        <div
          className="card"
          style={{
            borderColor: sessionStatus.pendingQR
              ? "rgba(245,158,11,0.55)"
              : "rgba(239,68,68,0.55)",
          }}
        >
          <div className="glow-ring" />
          {sessionStatus.pendingQR
            ? "אנא פתח את חלון הוואטסאפ וסרוק את קוד ה-QR פעם אחת כדי לאפשר שליחות מתוזמנות."
            : "לא מחובר עדיין. ממתין לסשן של וואטסאפ ווב..."}
        </div>
      )}

      <div className="grid">
        <div className="card full-span">
          <div className="glow-ring" />
          <h3>שליחה מיידית ותזמון</h3>
          <textarea
            ref={messageRef}
            placeholder="הזן את ההודעה שלך..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (messageRef.current) autoResize(messageRef.current);
            }}
            style={{ minHeight: 168, overflow: "hidden" }}
          />
          <div className="actions-row" style={{ marginTop: "0.85rem" }}>
            <button
              className="button"
              onClick={handleSend}
              disabled={loading || !message.trim()}
            >
              {loading ? <span className="loader" /> : "שלח עכשיו"}
            </button>
            <div className="inline" style={{ flexGrow: 1 }}>
              <label className="label" style={{ minWidth: 80 }}>
                זמן תזמון
              </label>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
              <button
                className="button outline"
                onClick={handleSchedule}
                disabled={!canSchedule()}
              >
                תזמן
              </button>
            </div>
          </div>
          {status && (
            <div className="status-line" style={{ marginTop: 12 }}>
              {status}
            </div>
          )}
          {scheduleStatus && (
            <div className="status-line" style={{ marginTop: 12 }}>
              {scheduleStatus}
            </div>
          )}
          <p className="small-note">מרווח מינימלי של 30 שניות לזמן תזמון</p>
        </div>

        <div className="card">
          <div className="glow-ring" />
          <h3>ניהול קבוצות</h3>
          <input
            type="text"
            placeholder="שם הקבוצה"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={{ textAlign: "right" }}
          />
          <textarea
            placeholder="סיומת (אופציונלי, מופיע בשורה חדשה)"
            value={groupSuffix}
            onChange={(e) => setGroupSuffix(e.target.value)}
            style={{ textAlign: "right", minHeight: 90 }}
          />
          <div className="actions-row" style={{ marginTop: 10 }}>
            <button
              className="button success"
              onClick={handleAddGroup}
              disabled={groupLoading || !groupName.trim()}
            >
              {groupLoading ? <span className="loader" /> : "הוסף קבוצה"}
            </button>
            <button
              type="button"
              className="button outline"
              onClick={fetchGroups}
              disabled={groupLoading}
            >
              רענן
            </button>
          </div>
          {groupMsg && (
            <div className="status-line" style={{ marginTop: 12 }}>
              {groupMsg}
            </div>
          )}
          <hr className="separator" />
          {groups.length === 0 && (
            <div className="empty-state">לא הוגדרו קבוצות.</div>
          )}
          {groups.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table rtl">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>סיומת</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.name}>
                      <td style={{ fontWeight: 600 }}>{g.name}</td>
                      <td style={{ whiteSpace: "pre-wrap", maxWidth: 220 }}>
                        {g.suffix
                          ? g.suffix.length > 120
                            ? g.suffix.slice(0, 120) + "…"
                            : g.suffix
                          : null}
                      </td>
                      <td>
                        <button
                          className="button danger"
                          style={{ padding: ".45rem .8rem", fontSize: ".7rem" }}
                          onClick={() => handleDeleteGroup(g.name)}
                        >
                          מחק
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="glow-ring" />
          <h3>הודעות מתוזמנות</h3>
          <button
            className="button outline"
            onClick={fetchSchedules}
            disabled={loadingSchedules}
            style={{ marginBottom: 12 }}
          >
            {loadingSchedules ? "מרענן..." : "רענן"}
          </button>
          {schedules.length === 0 && (
            <div className="empty-state">אין תזמונים.</div>
          )}
          {schedules.length > 0 && (
            <div className="table-wrap">
              <table className="table rtl">
                <thead>
                  <tr>
                    <th>מזהה</th>
                    <th>זמן הפעלה</th>
                    <th>סטטוס</th>
                    <th>פרטים</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => {
                    const failedList = Array.isArray(s.failedGroups)
                      ? s.failedGroups
                      : [];
                    return (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>{new Date(s.runAt).toLocaleString("he-IL")}</td>
                        <td>
                          {s.status === "pending" ? (
                            <span className="tag">ממתין</span>
                          ) : s.status === "sent" ? (
                            <span className="tag ok">נשלח</span>
                          ) : s.status === "failed" ? (
                            <span className="tag fail">נכשל</span>
                          ) : (
                            s.status
                          )}
                        </td>
                        <td style={{ maxWidth: 240 }}>
                          {failedList.length > 0 && (
                            <span className="tag fail">
                              נכשל: {failedList.map((f) => f.group).join(", ")}
                            </span>
                          )}
                          {s.status === "sent" &&
                            failedList.length === 0 &&
                            s.sentGroups && (
                              <span className="tag ok">
                                נשלח ל-{s.sentGroups.length} קבוצות
                              </span>
                            )}
                          {s.status === "failed" &&
                            failedList.length === 0 &&
                            s.error && <span title={s.error}>שגיאה</span>}
                        </td>
                        <td>
                          {s.status === "pending" && (
                            <button
                              className="button danger"
                              style={{
                                padding: ".45rem .8rem",
                                fontSize: ".65rem",
                              }}
                              onClick={() => cancelSchedule(s.id)}
                            >
                              בטל
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Client;
