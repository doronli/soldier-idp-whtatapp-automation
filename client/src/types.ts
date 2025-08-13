export interface FailedGroupEntry {
  group: string;
  error?: string;
}

export interface ScheduleItem {
  id: string;
  runAt: string;
  status: string;
  message?: string;
  error?: string | null;
  sentGroups?: string[];
  failedGroups?: FailedGroupEntry[];
}

export interface SessionStatus {
  loggedIn: boolean;
  pendingQR: boolean;
  error?: string;
}

export interface Group {
  name: string;
  suffix: string;
}
