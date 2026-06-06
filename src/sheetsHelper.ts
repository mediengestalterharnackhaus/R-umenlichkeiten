import { Task, TaskPriority, TaskStatus, ROOMS } from "./types";

interface APILog {
  timestamp: string;
  method: string;
  url: string;
  payload?: any;
  status: "success" | "error" | "pending";
  response?: any;
}

// Global logger for simulation
let apiLogs: APILog[] = [];

export function getApiLogs(): APILog[] {
  return [...apiLogs];
}

export function addApiLog(method: string, url: string, payload?: any, status: "success" | "error" | "pending" = "pending", response?: any) {
  const log: APILog = {
    timestamp: new Date().toLocaleTimeString("de-DE"),
    method,
    url,
    payload,
    status,
    response
  };
  apiLogs = [log, ...apiLogs].slice(0, 50); // Keep last 50 logs
}

// Clear logs
export function clearApiLogs() {
  apiLogs = [];
}

/**
 * Creates a new Google Spreadsheet with structured sheets for:
 * 1. Aufgaben (Tasks)
 * 2. Team-Auslastung (Workloads)
 * 3. Daily Report Overview
 */
export async function createGoogleSheet(accessToken: string, title: string = "Harnack-Haus Raum- & Aufgaben-Manager"): Promise<string> {
  const url = "https://sheets.googleapis.com/v4/spreadsheets";
  const body = {
    properties: {
      title: title
    },
    sheets: [
      {
        properties: {
          title: "Aufgaben",
          gridProperties: {
            frozenRowCount: 1
          }
        }
      },
      {
        properties: {
          title: "Team-Auslastung",
          gridProperties: {
            frozenRowCount: 1
          }
        }
      },
      {
        properties: {
          title: "Tägliche Berichte",
          gridProperties: {
            frozenRowCount: 1
          }
        }
      }
    ]
  };

  addApiLog("POST", url, body, "pending");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const spreadsheetId = data.spreadsheetId;

    addApiLog("POST", url, body, "success", data);

    // Initialize the sheets headers
    await initializeSheetHeaders(accessToken, spreadsheetId);

    return spreadsheetId;
  } catch (error: any) {
    addApiLog("POST", url, body, "error", { message: error.message });
    throw error;
  }
}

/**
 * Write headers to the new Spreadsheet
 */
async function initializeSheetHeaders(accessToken: string, spreadsheetId: string) {
  const headers = {
    valueInputOption: "USER_ENTERED",
    data: [
      {
        range: "Aufgaben!A1:I1",
        values: [
          ["ID", "Raum", "Aufgabe", "Zuständige Person", "Priorität", "Frist (Soll-Datum)", "Notizen", "Status", "Erstellt Am"]
        ]
      },
      {
        range: "Team-Auslastung!A1:D1",
        values: [
          ["Team-Mitglied", "Offene Aufgaben", "Erledigte Aufgaben", "Auslastung"]
        ]
      },
      {
        range: "Tägliche Berichte!A1:F1",
        values: [
          ["Datum", "Gesamtanzahl Aufgaben", "Ausstehend", "In Bearbeitung", "Erledigt", "Fortschrittskennzahl"]
        ]
      }
    ]
  };

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

  addApiLog("POST", url, headers, "pending");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(headers)
    });

    if (!res.ok) {
      throw new Error(`Google Sheets batchUpdate Headers Error: ${res.statusText}`);
    }

    const result = await res.json();
    addApiLog("POST", url, headers, "success", result);
  } catch (error: any) {
    addApiLog("POST", url, headers, "error", { message: error.message });
  }
}

/**
 * Updates all worksheets in Google Spreadsheet with current tasks data
 */
export async function syncSpreadsheetData(accessToken: string, spreadsheetId: string, tasks: Task[]): Promise<boolean> {
  const urlSync = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

  // 1. Map Tasks to rows
  const taskRows = tasks.map(t => [
    t.id,
    t.room,
    t.title,
    t.assignee || "Nicht zugewiesen",
    t.priority,
    t.deadline,
    t.notes || "",
    t.status,
    new Date(t.createdAt).toLocaleString("de-DE")
  ]);

  // 2. Map Workloads to rows
  const members = Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean)));
  const workloadRows = members.map(member => {
    const userTasks = tasks.filter(t => t.assignee === member);
    const pending = userTasks.filter(t => t.status !== TaskStatus.DONE).length;
    const done = userTasks.filter(t => t.status === TaskStatus.DONE).length;
    const limitStatus = pending > 3 ? "Überlastet (>3 offen)" : pending > 1 ? "Normal" : "Verfügbar";
    return [member, pending, done, limitStatus];
  });

  // 3. Map Daily Report row
  const total = tasks.length;
  const pendingCount = tasks.filter(t => t.status === TaskStatus.PENDING).length;
  const inProgressCount = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
  const doneCount = tasks.filter(t => t.status === TaskStatus.DONE).length;
  const progressRatio = total > 0 ? `${Math.round((doneCount / total) * 100)}%` : "0%";
  const dailyReportRow = [
    new Date().toLocaleDateString("de-DE"),
    total,
    pendingCount,
    inProgressCount,
    doneCount,
    progressRatio
  ];

  // We write the headers again and overwrite from A2 down
  const updatePayload = {
    valueInputOption: "USER_ENTERED",
    data: [
      // Clear sheet then write tasks
      {
        range: "Aufgaben!A2:I200",
        values: taskRows.length > 0 ? taskRows : [["", "", "", "", "", "", "", "", ""]]
      },
      // Clear workloads and write
      {
        range: "Team-Auslastung!A2:D50",
        values: workloadRows.length > 0 ? workloadRows : [["", "", "", ""]]
      },
      // Append daily stats at the next available row (or update today's stats at row 2)
      {
        range: "Tägliche Berichte!A2:F20",
        values: [dailyReportRow]
      }
    ]
  };

  addApiLog("POST", urlSync, updatePayload, "pending");

  try {
    const res = await fetch(urlSync, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatePayload)
    });

    if (!res.ok) {
      throw new Error(`Google Sheets batchUpdate Sync Error: ${res.statusText}`);
    }

    const data = await res.json();
    addApiLog("POST", urlSync, updatePayload, "success", data);
    return true;
  } catch (error: any) {
    addApiLog("POST", urlSync, updatePayload, "error", { message: error.message });
    throw error;
  }
}

/**
 * Hardcoded initial seed tasks themed beautifully for Harnack-Haus event preps.
 */
export const INITIAL_TASKS: Task[] = [
  {
    id: "task-1",
    room: "Goethe-Saal",
    title: "Bestuhlung für Jubiläumskolloquium anpassen (U-Form)",
    assignee: "",
    priority: TaskPriority.HIGH,
    deadline: "2026-06-06",
    notes: "Festakt mit 80 Personen. Bitte Tischdecken bügelnlassen und Bühnenaufgang absichern.",
    status: TaskStatus.IN_PROGRESS,
    createdAt: "2026-06-01T08:00:00Z"
  },
  {
    id: "task-2",
    room: "Hahn-Hörsaal",
    title: "HDMI-Verbindung und Funkmikrofone für Hauptvortrag prüfen",
    assignee: "",
    priority: TaskPriority.HIGH,
    deadline: "2026-06-05",
    notes: "Professor Meier hat ein eigenes Macbook. Adapter bereitlegen. Batteriestand checken.",
    status: TaskStatus.DONE,
    createdAt: "2026-06-02T10:15:00Z"
  },
  {
    id: "task-3",
    room: "Meitner I",
    title: "Flipcharts mit genügend Papier und funktionierenden Markern ausstatten",
    assignee: "",
    priority: TaskPriority.LOW,
    deadline: "2026-06-08",
    notes: "Workshop mit 15 Personen. Pinwand-Nadeln bereitlegen.",
    status: TaskStatus.PENDING,
    createdAt: "2026-06-03T14:30:00Z"
  },
  {
    id: "task-4",
    room: "Meitner II",
    title: "Klimatisierung und Kaffeestation aufbauen",
    assignee: "",
    priority: TaskPriority.MEDIUM,
    deadline: "2026-06-07",
    notes: "Keks-Teller auffüllen und vegane Alternativen (Hafermilch) bereithalten.",
    status: TaskStatus.IN_PROGRESS,
    createdAt: "2026-06-03T15:00:00Z"
  },
  {
    id: "task-5",
    room: "Warburg",
    title: "Antiken Kaminfeuer-Bildschirm & Raumtemperatur einstellen",
    assignee: "",
    priority: TaskPriority.LOW,
    deadline: "2026-06-10",
    notes: "Abendlicher Sektempfang für Kuratorium.",
    status: TaskStatus.PENDING,
    createdAt: "2026-06-04T09:00:00Z"
  },
  {
    id: "task-6",
    room: "Planck-Lobby",
    title: "Stehtische aufbauen und weiße Hussen anbringen",
    assignee: "",
    priority: TaskPriority.HIGH,
    deadline: "2026-06-06",
    notes: "Buffet startet direkt nach dem Festvortrag um 18:30 Uhr im Hörsaal.",
    status: TaskStatus.PENDING,
    createdAt: "2026-06-04T12:00:00Z"
  },
  {
    id: "task-7",
    room: "Köhler",
    title: "Desinfektion des Besprechungstisches & Besteck polieren",
    assignee: "",
    priority: TaskPriority.MEDIUM,
    deadline: "2026-06-05",
    notes: "VIP-Lunch für Stiftungsrat vorbereiten.",
    status: TaskStatus.DONE,
    createdAt: "2026-06-04T13:45:00Z"
  }
];

/**
 * Parses member strings formatted like "Name <email@domain.com>" or "email@domain.com"
 */
export function parseMember(memberStr: string): { name: string; email: string } {
  if (!memberStr) return { name: "", email: "" };
  const match = memberStr.match(/^(.*?)\s*<(.*?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(memberStr.trim())) {
    return { name: memberStr.trim(), email: memberStr.trim() };
  }
  return { name: memberStr.trim(), email: "" };
}

/**
 * Builds standard base64url encoded RFC 822 / 2822 raw email for Gmail API
 */
function buildRawEmail(to: string, subject: string, bodyText: string): string {
  // Safe base64 conversion for raw utf-8 text
  const subjectEncoded = btoa(encodeURIComponent(subject).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));

  const mailLines = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${subjectEncoded}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyText
  ];
  
  const emailStr = mailLines.join("\n");
  const base64 = btoa(encodeURIComponent(emailStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
  
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends a real E-Mail notification via the active Google account's Gmail API
 */
export async function sendGmailNotification(
  accessToken: string,
  toEmail: string,
  subject: string,
  bodyText: string
): Promise<boolean> {
  const url = "https://gmail.googleapis.com/v1/users/me/messages/send";
  const rawEmail = buildRawEmail(toEmail, subject, bodyText);
  
  addApiLog("POST", url, { to: toEmail, subject, messageSnippet: bodyText.substring(0, 80) + "..." }, "pending");
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw: rawEmail })
    });
    
    if (!response.ok) {
      throw new Error(`Gmail API HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    addApiLog("POST", url, { to: toEmail, subject, messageSnippet: bodyText.substring(0, 80) + "..." }, "success", data);
    return true;
  } catch (error: any) {
    addApiLog("POST", url, { to: toEmail, subject }, "error", { message: error.message });
    throw error;
  }
}

