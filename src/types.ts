export enum TaskStatus {
  PENDING = "Ausstehend",
  IN_PROGRESS = "In Bearbeitung",
  DONE = "Erledigt"
}

export enum TaskPriority {
  HIGH = "Hoch",
  MEDIUM = "Mittel",
  LOW = "Niedrig"
}

export interface Task {
  id: string;
  room: string;
  title: string;
  assignee: string;
  priority: TaskPriority;
  deadline: string; // YYYY-MM-DD
  notes: string;
  status: TaskStatus;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: "create" | "update" | "toggle" | "delete" | "clean";
  taskId: string;
  taskTitle: string;
  room: string;
  details: string;
  byAdmin: boolean;
}

export interface SheetConfig {
  spreadsheetId: string;
  accessToken: string;
  clientId: string;
  isConnected: boolean;
}

export const ROOMS = [
  "Goethe-Saal",
  "Hahn-Hörsaal",
  "Meitner I",
  "Meitner II",
  "Warburg",
  "Lynen",
  "Köhler",
  "Humboldt",
  "Mozart",
  "Planck-Lobby",
  "Laue"
];
