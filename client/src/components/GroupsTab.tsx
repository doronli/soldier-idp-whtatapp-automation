import { useState } from "react";
import type { Group } from "../types";

interface Props {
  groups: Group[];
  refreshGroups: () => void;
  addGroup: (
    name: string,
    suffix: string
  ) => Promise<{ ok: boolean; msg: string }>; // returns status
  deleteGroup: (name: string) => Promise<void>;
  groupLoading: boolean;
  groupMsg: string | null;
}

export default function GroupsTab({
  groups,
  refreshGroups,
  addGroup,
  deleteGroup,
  groupLoading,
  groupMsg,
}: Props) {
  const [groupName, setGroupName] = useState("");
  const [groupSuffix, setGroupSuffix] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // original name key
  const [editName, setEditName] = useState("");
  const [editSuffix, setEditSuffix] = useState("");
  const [saving, setSaving] = useState(false);
  const apiBase = "http://localhost:3000";
  const [query, setQuery] = useState("");

  const handleAdd = async () => {
    if (!groupName.trim()) return;
    const res = await addGroup(groupName, groupSuffix);
    if (res.ok) {
      setGroupName("");
      setGroupSuffix("");
      refreshGroups();
    }
  };

  const beginEdit = (g: Group) => {
    setEditing(g.name);
    setEditName(g.name);
    setEditSuffix(g.suffix || "");
  };
  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditSuffix("");
  };
  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${apiBase}/groups/${encodeURIComponent(editing)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, suffix: editSuffix }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "עדכון נכשל");
      cancelEdit();
      refreshGroups();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const normalized = query.trim().toLowerCase();
  const filteredGroups = normalized
    ? groups.filter(
        (g) =>
          g.name.toLowerCase().includes(normalized) ||
          (g.suffix ? g.suffix.toLowerCase().includes(normalized) : false)
      )
    : groups;

  return (
    <div className="grid">
      <div className="card full-span">
        <div className="glow-ring" />
        <h3>יצירת קבוצה</h3>
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
            onClick={handleAdd}
            disabled={groupLoading || !groupName.trim()}
          >
            {groupLoading ? <span className="loader" /> : "הוסף קבוצה"}
          </button>
          <button
            type="button"
            className="button outline"
            onClick={refreshGroups}
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
      </div>

      <div className="card full-span">
        <div className="glow-ring" />
        <h3>קבוצות קיימות</h3>
        {groups.length === 0 && (
          <div className="empty-state">לא הוגדרו קבוצות.</div>
        )}
        {groups.length > 0 && (
          <>
            <div
              className="inline"
              style={{
                marginBottom: 10,
                gap: ".6rem",
                justifyContent: "space-between",
              }}
            >
              <input
                type="text"
                placeholder="חיפוש קבוצה או סיומת..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ textAlign: "right", maxWidth: 360 }}
              />
              <span className="small-note">{filteredGroups.length} תוצאות</span>
            </div>
            {filteredGroups.length === 0 ? (
              <div className="empty-state">אין תוצאות לחיפוש.</div>
            ) : (
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
                    {filteredGroups.map((g) => (
                      <tr key={g.name}>
                        <td style={{ fontWeight: 600 }}>
                          {editing === g.name ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              style={{ textAlign: "right" }}
                            />
                          ) : (
                            g.name
                          )}
                        </td>
                        <td style={{ whiteSpace: "pre-wrap", maxWidth: 420 }}>
                          {editing === g.name ? (
                            <textarea
                              value={editSuffix}
                              onChange={(e) => setEditSuffix(e.target.value)}
                              style={{ textAlign: "right", minHeight: 90 }}
                            />
                          ) : g.suffix ? (
                            g.suffix.length > 200 ? (
                              g.suffix.slice(0, 200) + "…"
                            ) : (
                              g.suffix
                            )
                          ) : null}
                        </td>
                        <td>
                          {editing === g.name ? (
                            <div className="inline">
                              <button
                                className="button success"
                                onClick={saveEdit}
                                disabled={saving}
                              >
                                {saving ? <span className="loader" /> : "שמור"}
                              </button>
                              <button
                                className="button outline"
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                בטל
                              </button>
                            </div>
                          ) : (
                            <div className="inline">
                              <button
                                className="button outline"
                                onClick={() => beginEdit(g)}
                              >
                                ערוך
                              </button>
                              <button
                                className="button danger"
                                style={{
                                  padding: ".45rem .8rem",
                                  fontSize: ".7rem",
                                }}
                                onClick={() => deleteGroup(g.name)}
                              >
                                מחק
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
