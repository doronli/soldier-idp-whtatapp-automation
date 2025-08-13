import { useState, useEffect, useRef } from "react";
import type { FailedGroupEntry, ScheduleItem } from "../types";

interface Props {
  apiBase: string;
  schedules: ScheduleItem[];
  refreshSchedules: () => void;
  sessionReady: boolean;
  loadingSchedules: boolean;
}

export default function MessageTab({
  apiBase,
  schedules,
  refreshSchedules,
  sessionReady,
  loadingSchedules,
}: Props) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const max = 600;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  };
  useEffect(() => {
    if (messageRef.current) autoResize(messageRef.current);
  }, [message]);

  const canSchedule = () => {
    if (!message.trim() || !scheduleTime) return false;
    try {
      const dt = new Date(scheduleTime);
      if (isNaN(dt.getTime())) return false;
      if (dt.getTime() - Date.now() < 30000) return false;
      return true;
    } catch {
      return false;
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
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

  const handleSchedule = async () => {
    setScheduleStatus(null);
    if (!canSchedule()) return;
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
        refreshSchedules();
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
      if (res.ok) refreshSchedules();
    } catch {
      /* ignore */
    }
  };

  return (
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
        <div className="actions-row" style={{ marginTop: ".85rem" }}>
          <button
            className="button"
            onClick={handleSend}
            disabled={loading || !message.trim() || !sessionReady}
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
              disabled={!canSchedule() || !sessionReady}
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

      <div className="card full-span">
        <div className="glow-ring" />
        <h3>הודעות מתוזמנות</h3>
        <button
          className="button outline"
          onClick={refreshSchedules}
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
  );
}
