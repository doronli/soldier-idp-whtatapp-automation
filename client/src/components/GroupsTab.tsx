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

  const handleAdd = async () => {
    if (!groupName.trim()) return;
    const res = await addGroup(groupName, groupSuffix);
    if (res.ok) {
      setGroupName("");
      setGroupSuffix("");
      refreshGroups();
    }
  };

  return (
    <div className="grid">
      <div className="card">
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

      <div className="card">
        <div className="glow-ring" />
        <h3>קבוצות קיימות</h3>
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
                        onClick={() => deleteGroup(g.name)}
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
    </div>
  );
}
