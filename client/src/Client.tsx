import { useState, useEffect } from "react";
import type { ScheduleItem, SessionStatus, Group } from "./types";
import MessageTab from "./components/MessageTab";
import GroupsTab from "./components/GroupsTab";

function Client() {
  // schedules & groups state
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMsg, setGroupMsg] = useState<string | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<"messages" | "groups">("messages");

  const apiBase = "http://localhost:3000";

  const fetchSchedules = async () => {
    try {
      setLoadingSchedules(true);
      const res = await fetch(`${apiBase}/schedules`);
      const data = await res.json();
      if (Array.isArray(data)) setSchedules(data as ScheduleItem[]);
    } catch {
      /* ignore */
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
      /* ignore */
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

  const addGroup = async (name: string, suffix: string) => {
    setGroupMsg(null);
    setGroupLoading(true);
    try {
      const res = await fetch(`${apiBase}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, suffix }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroupMsg(`✅ נוסף '${data.name}'`);
        return { ok: true, msg: "added" };
      } else {
        const msg = "❌ " + (data.error || "נכשל");
        setGroupMsg(msg);
        return { ok: false, msg };
      }
    } catch {
      const msg = "❌ שגיאת רשת";
      setGroupMsg(msg);
      return { ok: false, msg };
    } finally {
      setGroupLoading(false);
    }
  };

  const deleteGroup = async (name: string) => {
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

      <div
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <button
          className={
            "button outline " + (activeTab === "messages" ? "active" : "")
          }
          style={
            activeTab === "messages"
              ? { boxShadow: "0 0 0 2px rgba(99,102,241,0.6)" }
              : {}
          }
          onClick={() => setActiveTab("messages")}
        >
          הודעות
        </button>
        <button
          className={
            "button outline " + (activeTab === "groups" ? "active" : "")
          }
          style={
            activeTab === "groups"
              ? { boxShadow: "0 0 0 2px rgba(99,102,241,0.6)" }
              : {}
          }
          onClick={() => setActiveTab("groups")}
        >
          קבוצות
        </button>
      </div>

      {activeTab === "messages" && (
        <MessageTab
          apiBase={apiBase}
          schedules={schedules}
          refreshSchedules={fetchSchedules}
          sessionReady={!!sessionStatus?.loggedIn}
          loadingSchedules={loadingSchedules}
        />
      )}

      {activeTab === "groups" && (
        <GroupsTab
          groups={groups}
          refreshGroups={fetchGroups}
          addGroup={addGroup}
          deleteGroup={deleteGroup}
          groupLoading={groupLoading}
          groupMsg={groupMsg}
        />
      )}
    </div>
  );
}

export default Client;
