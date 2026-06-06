import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, 
  Home, 
  ListTodo, 
  Users, 
  FileText, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  X,
  Search,
  SlidersHorizontal,
  RefreshCw,
  LogOut,
  Sparkles,
  History,
  Lock,
  Unlock,
  ShieldCheck
} from "lucide-react";

import { Task, TaskStatus, TaskPriority, ROOMS, AuditLog } from "./types";
import { INITIAL_TASKS, createGoogleSheet, syncSpreadsheetData, addApiLog, parseMember, sendGmailNotification } from "./sheetsHelper";
import RoomsGrid from "./components/RoomsGrid";
import TaskModal from "./components/TaskModal";
import TeamWorkload from "./components/TeamWorkload";
import ManagerReport from "./components/ManagerReport";
import SheetsPanel from "./components/SheetsPanel";
import { initAuth, googleSignIn, logout as firebaseLogout, getCachedEmail } from "./firebaseAuth";

export default function App() {
  // --- Core State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"rooms" | "list" | "workload" | "report" | "sheets" | "audit">("rooms");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  
  // --- Admin & Audit Logs State ---
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAdminPassModal, setShowAdminPassModal] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [pendingActionAfterAdminAuth, setPendingActionAfterAdminAuth] = useState<(() => void) | null>(null);

  // --- Reusable Custom Alert & Confirm Dialog State ---
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: "confirm" | "alert";
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null>(null);

  const showCustomConfirm = (options: {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }) => {
    setDialogConfig({
      isOpen: true,
      type: "confirm",
      ...options
    });
  };

  const showCustomAlert = (title: string, message: string) => {
    setDialogConfig({
      isOpen: true,
      type: "alert",
      title,
      message,
      confirmText: "Verstanden"
    });
  };

  // --- Live Clock State ---
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- UI Filter & Search ---
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  // --- Modal & Selection States ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [selectedRoomOnGrid, setSelectedRoomOnGrid] = useState<string>("");
  const [roomDetailOpen, setRoomDetailOpen] = useState(false);

  // --- Google Sheets Auth and Sync State ---
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: "success" | "error" | null }>({ text: "", type: null });

  // --- Email Notifications State ---
  const [recentEmail, setRecentEmail] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [showEmailToast, setShowEmailToast] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"simulated" | "sending" | "success" | "error">("simulated");
  const [emailError, setEmailError] = useState("");

  // --- Initialize & Load from LocalStorage ---
  useEffect(() => {
    const templateMembers = ["Laura Schmidt", "Maximilian Müller", "Sabine Weber", "Tobias Becker"];

    // 1. Fetch staff members (start completely empty and filter out pre-defined template names)
    const storedMembers = localStorage.getItem("harnack_members");
    let currentMembers: string[] = [];
    if (storedMembers) {
      try {
        const parsed = JSON.parse(storedMembers);
        currentMembers = parsed.filter((m: string) => m && !templateMembers.includes(m));
      } catch (e) {
        currentMembers = [];
      }
    }
    setMembers(currentMembers);
    localStorage.setItem("harnack_members", JSON.stringify(currentMembers));

    // 2. Fetch task list
    const storedTasks = localStorage.getItem("harnack_tasks");
    if (storedTasks) {
      try {
        const parsed = JSON.parse(storedTasks) as Task[];
        // Filter out any template assignees from the stored tasks
        const cleanedTasks = parsed.map(t => {
          if (templateMembers.includes(t.assignee)) {
            return { ...t, assignee: "" };
          }
          return t;
        });
        setTasks(cleanedTasks);
        localStorage.setItem("harnack_tasks", JSON.stringify(cleanedTasks));
      } catch (e) {
        setTasks(INITIAL_TASKS);
        localStorage.setItem("harnack_tasks", JSON.stringify(INITIAL_TASKS));
      }
    } else {
      setTasks(INITIAL_TASKS);
      localStorage.setItem("harnack_tasks", JSON.stringify(INITIAL_TASKS));
    }

    // 3. Fetch spreadsheet ID from session
    const storedSheetId = localStorage.getItem("harnack_spreadsheet_id") || "";
    if (storedSheetId) setSpreadsheetId(storedSheetId);

    // 4. Extract access_token from hash (standard Implicit OAuth Redirect)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const token = hashParams.get("access_token");
      if (token) {
        setAccessToken(token);
        setIsConnected(true);
        const savedId = localStorage.getItem("harnack_client_id") || "";
        setClientId(savedId);
        setAuthEmail("Manuelle Verknüpfung");
        
        // Remove hash parameter elegantly to keep URL visually clean
        window.history.replaceState(null, "", window.location.pathname);
        
        setSyncMessage({
          text: "Erfolgreich mit Google Account verknüpft! Google Sheets Synchronisation ist jetzt bereit.",
          type: "success"
        });
        setTimeout(() => setSyncMessage({ text: "", type: null }), 6000);
      }
    }

    // 5. Initialize Firebase Auth
    const unsub = initAuth(
      (user, token) => {
        setAccessToken(token);
        setIsConnected(true);
        setClientId("Firebase Auto-Verbindung");
        setAuthEmail(user.email);
      },
      () => {
        // Not authenticated or logged out
      }
    );

    // 6. Fetch audit logs
    const storedLogs = localStorage.getItem("harnack_audit_logs");
    if (storedLogs) {
      try {
        setAuditLogs(JSON.parse(storedLogs));
      } catch (e) {
        setAuditLogs([]);
      }
    }

    // 7. Check if previously admin
    const storedAdmin = localStorage.getItem("harnack_is_admin");
    if (storedAdmin === "true") {
      setIsAdmin(true);
    }

    return () => {
      unsub();
    };
  }, []);

  // --- Save states to localStorage ---
  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem("harnack_tasks", JSON.stringify(newTasks));
  };

  const saveMembers = (newMembers: string[]) => {
    setMembers(newMembers);
    localStorage.setItem("harnack_members", JSON.stringify(newMembers));
  };

  // --- Audit Logging & Admin Helpers ---
  const addAuditLogEntry = (
    action: "create" | "update" | "toggle" | "delete" | "clean",
    taskId: string,
    taskTitle: string,
    room: string,
    details: string
  ) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      taskId,
      taskTitle,
      room,
      details,
      byAdmin: isAdmin
    };
    
    // Crucial: Load fresh from localStorage / state to prevent race conditions or stale updates
    const storedLogs = localStorage.getItem("harnack_audit_logs");
    let currentLogs: AuditLog[] = [];
    if (storedLogs) {
      try {
        currentLogs = JSON.parse(storedLogs);
      } catch (e) {
        currentLogs = [];
      }
    }
    const updated = [newLog, ...currentLogs];
    setAuditLogs(updated);
    localStorage.setItem("harnack_audit_logs", JSON.stringify(updated));
  };

  const handleClearAuditLogs = () => {
    if (!isAdmin) {
      showCustomAlert(
        "Zutritt verweigert",
        "Nur der Administrator kann das Änderungsprotokoll bereinigen!"
      );
      return;
    }
    showCustomConfirm({
      title: "Protokoll unwiderruflich leeren?",
      message: "Möchten Sie das gesamte Änderungsprotokoll wirklich unwiderruflich löschen? Alle Aufzeichnungen über Erstellungen, Löschungen und Bearbeitungen gehen verloren.",
      confirmText: "Ja, jetzt leeren",
      cancelText: "Abbrechen",
      isDanger: true,
      onConfirm: () => {
        setAuditLogs([]);
        localStorage.removeItem("harnack_audit_logs");
      }
    });
  };

  const handleAdminAuthToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
      localStorage.removeItem("harnack_is_admin");
      setSyncMessage({
        text: "Arbeitssitzung als Administrator beendet. Sie befinden sich nun im normalen Modus.",
        type: "success"
      });
      setTimeout(() => setSyncMessage({ text: "", type: null }), 4000);
    } else {
      setAdminPassInput("");
      setAdminError("");
      setPendingActionAfterAdminAuth(null);
      setShowAdminPassModal(true);
    }
  };

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const verified = adminPassInput.toLowerCase() === "admin" || adminPassInput.toLowerCase() === "harnack";
    if (verified) {
      setIsAdmin(true);
      localStorage.setItem("harnack_is_admin", "true");
      setShowAdminPassModal(false);
      setAdminPassInput("");
      setSyncMessage({
        text: "Authentifizierung erfolgreich! Administrator-Sonderfunktionen sind nun freigeschaltet.",
        type: "success"
      });
      setTimeout(() => setSyncMessage({ text: "", type: null }), 6000);
      
      if (pendingActionAfterAdminAuth) {
        pendingActionAfterAdminAuth();
        setPendingActionAfterAdminAuth(null);
      }
    } else {
      setAdminError("Ungültiges Passwort! Tipp: Verwenden Sie als Passwort 'admin' oder 'harnack'.");
    }
  };

  // --- Action Handlers ---
  const handleAddTask = (roomName?: string) => {
    setModalTask(null);
    setSelectedRoomOnGrid(roomName || "Goethe-Saal");
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setModalTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    const matched = tasks.find((t) => t.id === taskId);
    if (!matched) return;
    
    // STRICT RULE: Only the Admin may delete completed tasks
    if (matched.status === TaskStatus.DONE && !isAdmin) {
      setAdminPassInput("");
      setAdminError("");
      setPendingActionAfterAdminAuth(() => () => {
        // Callback after login: run again
        const freshTasksStr = localStorage.getItem("harnack_tasks");
        const freshTasks: Task[] = freshTasksStr ? JSON.parse(freshTasksStr) : tasks;
        const filtered = freshTasks.filter((t) => t.id !== taskId);
        setTasks(filtered);
        localStorage.setItem("harnack_tasks", JSON.stringify(filtered));

        // Create log
        const logMsg = `Erledigte Aufgabe „${matched.title}“ dauerhaft aus der Liste gelöscht.`;
        addAuditLogEntry("delete", matched.id, matched.title, matched.room, logMsg);
        
        setSyncMessage({
          text: `Erfolgreich: Erledigte Aufgabe „${matched.title}“ wurde gelöscht.`,
          type: "success"
        });
        setTimeout(() => setSyncMessage({ text: "", type: null }), 4500);
      });
      setShowAdminPassModal(true);
      return;
    }

    showCustomConfirm({
      title: "Aufgabe löschen?",
      message: `Möchten Sie die Aufgabe „${matched.title}“ wirklich unwiderruflich löschen?`,
      confirmText: "Löschen",
      cancelText: "Abbrechen",
      isDanger: true,
      onConfirm: () => {
        const filtered = tasks.filter((t) => t.id !== taskId);
        saveTasks(filtered);

        const logDetails = matched.status === TaskStatus.DONE
          ? "Erledigte Aufgabe gelöscht."
          : `Unvollständige Aufgabe gelöscht. Status war: ${matched.status}.`;
        
        addAuditLogEntry("delete", matched.id, matched.title, matched.room, logDetails);
      }
    });
  };

  const handleToggleStatus = (taskId: string) => {
    let oldStatus = "";
    let nextStatus = TaskStatus.PENDING;
    let tTitle = "";
    let tRoom = "";

    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        oldStatus = t.status;
        tTitle = t.title;
        tRoom = t.room;
        if (t.status === TaskStatus.PENDING) nextStatus = TaskStatus.IN_PROGRESS;
        else if (t.status === TaskStatus.IN_PROGRESS) nextStatus = TaskStatus.DONE;
        return { ...t, status: nextStatus };
      }
      return t;
    });
    saveTasks(updated);

    if (tTitle) {
      addAuditLogEntry(
        "toggle",
        taskId,
        tTitle,
        tRoom,
        `Status schnellgeändert von „${oldStatus}“ auf „${nextStatus}“.`
      );
    }
  };

  const handleSaveTask = (formData: Omit<Task, "id" | "createdAt" > & { id?: string }) => {
    // Automatically register assignee in members list if they are not already there
    if (formData.assignee && formData.assignee.trim() && !members.includes(formData.assignee.trim())) {
      const cleanName = formData.assignee.trim();
      saveMembers([...members, cleanName]);
    }

    // Determine if E-Mail notification should be fired
    let shouldNotify = false;
    let targetAssignee = formData.assignee || "";

    if (formData.id) {
      // Edit mode: only notify if assignee changed and is not empty
      const existing = tasks.find(t => t.id === formData.id);
      if (existing && existing.assignee !== formData.assignee && formData.assignee) {
        shouldNotify = true;
      }
    } else {
      // Add mode: notify if assignee is assigned
      if (formData.assignee) {
        shouldNotify = true;
      }
    }

    if (shouldNotify && targetAssignee) {
      const parsed = parseMember(targetAssignee);
      if (parsed.email) {
        const emailSubject = `[Harnack-Haus-Manager] Neue Aufgabe zugewiesen: ${formData.title}`;
        const emailBody = `Hallo ${parsed.name || "Teammitglied"},\n\nIhnen wurde im Harnack-Haus Raum- & Aufgaben-Manager eine neue Aufgabe zugewiesen oder übertragen:\n\n• Aufgabe: ${formData.title}\n• Harnack-Haus Raum: ${formData.room}\n• Priorität: ${formData.priority === TaskPriority.HIGH ? "🔥 Hoch" : formData.priority === TaskPriority.MEDIUM ? "🟡 Mittel" : "🟢 Niedrig"}\n• Soll-Datum (Frist): ${formData.deadline}\n• Zusatznotizen: ${formData.notes || "Keine Notizen hinterlegt."}\n• Aktueller Status: ${formData.status}\n\nDiese Benachrichtigung wurde automatisch erzeugt.\n\nMit freundlichen Grüßen,\nIhr Harnack-Haus Raumkoordinator`;

        setRecentEmail({ to: parsed.email, subject: emailSubject, body: emailBody });
        setShowEmailToast(true);
        setEmailError("");

        if (isConnected && accessToken) {
          setEmailStatus("sending");
          sendGmailNotification(accessToken, parsed.email, emailSubject, emailBody)
            .then(() => {
              setEmailStatus("success");
            })
            .catch((err) => {
              console.error("Fehler beim Gmail-Senden:", err);
              setEmailStatus("error");
              setEmailError(err.message || "E-Mail-Berechtigung (gmail.send Scope) fehlt oder Token abgelaufen bzw. ungültig.");
            });
        } else {
          setEmailStatus("simulated");
          // Log simulated API access
          addApiLog(
            "POST",
            "https://gmail.googleapis.com/v1/users/me/messages/send (SIMULATION)",
            { to: parsed.email, subject: emailSubject, messageSnippet: emailBody.substring(0, 100) + "..." },
            "success",
            { status: "Simulierte E-Mail-Übertragung erfolgreich", recipient: parsed.email }
          );
        }
      }
    }

    if (formData.id) {
      // Edit mode
      const existing = tasks.find((t) => t.id === formData.id);
      const updated = tasks.map((t) => {
        if (t.id === formData.id) {
          return {
            ...t,
            title: formData.title,
            room: formData.room,
            assignee: formData.assignee,
            priority: formData.priority,
            deadline: formData.deadline,
            notes: formData.notes,
            status: formData.status
          };
        }
        return t;
      });
      saveTasks(updated);

      // Audit logs details
      if (existing) {
        const changes: string[] = [];
        if (existing.title !== formData.title) changes.push(`Titel geändert`);
        if (existing.room !== formData.room) changes.push(`Raum gewechselt (${existing.room} ➔ ${formData.room})`);
        if (existing.assignee !== formData.assignee) changes.push(`Zuweisung geändert (${existing.assignee || "keine"} ➔ ${formData.assignee || "keine"})`);
        if (existing.priority !== formData.priority) changes.push(`Priorität geändert (${existing.priority} ➔ ${formData.priority})`);
        if (existing.deadline !== formData.deadline) changes.push(`Frist geändert (${existing.deadline} ➔ ${formData.deadline})`);
        if (existing.status !== formData.status) changes.push(`Status geändert (${existing.status} ➔ ${formData.status})`);
        
        const changeStr = changes.length > 0 ? changes.join(", ") : "Keine wesentlichen Änderungen";
        addAuditLogEntry("update", formData.id, formData.title, formData.room, `Aufgabe editiert: ${changeStr}.`);
      }
    } else {
      // Add mode
      const newId = `task-${Date.now()}`;
      const newTask: Task = {
        id: newId,
        title: formData.title,
        room: formData.room,
        assignee: formData.assignee,
        priority: formData.priority,
        deadline: formData.deadline,
        notes: formData.notes,
        status: formData.status,
        createdAt: new Date().toISOString()
      };
      saveTasks([newTask, ...tasks]);

      addAuditLogEntry(
        "create",
        newId,
        formData.title,
        formData.room,
        `Neue Aufgabe erstellt. Status: „${formData.status}“, Zuständig: „${formData.assignee || "Offen"}“.`
      );
    }
    setIsModalOpen(false);
  };

  const handleAddMember = (name: string) => {
    const updated = [...members, name];
    saveMembers(updated);
  };

  const handleRemoveMember = (name: string) => {
    const updated = members.filter((m) => m !== name);
    saveMembers(updated);
    
    // Clear out assignments for deleted person
    const clearedTasks = tasks.map((t) => {
      if (t.assignee === name) {
        return { ...t, assignee: "" };
      }
      return t;
    });
    saveTasks(clearedTasks);
  };

  // --- Clean up old / completed tasks ---
  const cleanOldTasks = () => {
    // STRICT RULE: Only the Admin may clean old, completed tasks
    if (!isAdmin) {
      setAdminPassInput("");
      setAdminError("");
      setPendingActionAfterAdminAuth(() => () => {
        // Run cleanOldTasks again after successful auth
        cleanOldTasks();
      });
      setShowAdminPassModal(true);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0]; // e.g. "2026-06-05"
    // Find tasks that are DONE and whose deadline is today or in the past
    const oldDoneTasks = tasks.filter(
      (t) => t.status === TaskStatus.DONE && t.deadline <= todayStr
    );

    if (oldDoneTasks.length === 0) {
      showCustomAlert(
        "Bereinigung nicht notwendig",
        "Es wurden keine alten (bereits erledigten und abgelaufenen) Aufgaben zum Bereinigen gefunden."
      );
      return;
    }

    showCustomConfirm({
      title: "Alte Aufgaben bereinigen?",
      message: `Es wurden ${oldDoneTasks.length} abgelaufene und als „Erledigt“ markierte Aufgaben gefunden. Möchten Sie diese Aufgaben jetzt dauerhaft aus der Liste entfernen?`,
      confirmText: "Bereinigen",
      cancelText: "Abbrechen",
      isDanger: true,
      onConfirm: () => {
        const remaining = tasks.filter(
          (t) => !(t.status === TaskStatus.DONE && t.deadline <= todayStr)
        );
        saveTasks(remaining);

        // Write audit log entry
        oldDoneTasks.forEach((t) => {
          addAuditLogEntry(
            "clean",
            t.id,
            t.title,
            t.room,
            `Altaufgabe automatisch im Rahmen der Bereinigung dauerhaft gelöscht (Frist war ${t.deadline}).`
          );
        });

        const syncAdvice = isConnected 
          ? " Bitte führen Sie anschließend eine Google Sheets Sync durch, um die Änderungen zu übertragen." 
          : "";

        setSyncMessage({
          text: `${oldDoneTasks.length} alte erledigte Aufgaben erfolgreich gelöscht.${syncAdvice}`,
          type: "success"
        });
        setTimeout(() => setSyncMessage({ text: "", type: null }), 6000);
      }
    });
  };

  // --- Export Tasks to Excel-compatible CSV ---
  const exportToExcel = () => {
    if (filteredTasks.length === 0) {
      showCustomAlert(
        "Export fehlgeschlagen",
        "Es gibt keine Aufgaben in der aktuellen gefilterten Ansicht zum Exportieren."
      );
      return;
    }

    const headers = [
      "ID",
      "Harnack-Raum",
      "Aufgabe / Projekt",
      "Zuständige Person (E-Mail)",
      "Priorität",
      "Frist (Soll-Datum)",
      "Zusatznotizen",
      "Status",
      "Erstellt am"
    ];

    const rows = filteredTasks.map((t) => {
      const cleanNotes = (t.notes || "")
        .replace(/[\r\n]+/g, " ")
        .replace(/;/g, ",");
      const cleanTitle = t.title
        .replace(/[\r\n]+/g, " ")
        .replace(/;/g, ",");
      const assigneeStr = t.assignee || "Nicht zugewiesen";

      return [
        t.id,
        t.room,
        cleanTitle,
        assigneeStr,
        t.priority,
        t.deadline,
        cleanNotes,
        t.status,
        t.createdAt ? new Date(t.createdAt).toLocaleDateString("de-DE") : ""
      ];
    });

    // Excel-comform semicolon (;) delimiters and quotes around fields
    const csvContent = [
      headers.join(";"),
      ...rows.map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(";")
      )
    ].join("\r\n");

    // Add Unicode BOM (\uFEFF) to make sure German umlauts display perfectly in Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const friendlyDate = new Date().toISOString().split("T")[0];
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `harnack_haus_aufgabenliste_${friendlyDate}.csv`);
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSyncMessage({
      text: `Web-basiertes Excel-Dokument (${filteredTasks.length} Aufgaben) erfolgreich geladen! (Berücksichtigt aktive Filter)`,
      type: "success"
    });
    setTimeout(() => setSyncMessage({ text: "", type: null }), 6000);
  };

  // --- Real Google Sheets OAuth Trigger ---
  const handleConnectReal = (inputID: string) => {
    localStorage.setItem("harnack_client_id", inputID);
    const redirectUrl = window.location.origin;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: inputID,
      redirect_uri: redirectUrl,
      response_type: "token",
      scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send",
      state: "harnack_sheets_sync"
    }).toString();
    
    window.location.href = authUrl;
  };

  const handleConnectFirebase = async () => {
    try {
      setSyncMessage({ text: "", type: null });
      const result = await googleSignIn();
      if (result) {
        setAccessToken(result.accessToken);
        setIsConnected(true);
        setClientId("Firebase Auto-Verbindung");
        setAuthEmail(result.user.email);
        setSyncMessage({
          text: "Erfolgreich per 1-Klick mit Ihrem Google-Konto verknüpft! Google Sheets Synchronisation und Gmail-Benachrichtigungen sind nun aktiv.",
          type: "success"
        });
        setTimeout(() => setSyncMessage({ text: "", type: null }), 6000);
      }
    } catch (err: any) {
      console.error(err);
      setSyncMessage({
        text: `Verbindungsfehler: ${err.message || "Authentifizierung abgelehnt oder fehlgeschlagen."}`,
        type: "error"
      });
      setTimeout(() => setSyncMessage({ text: "", type: null }), 6000);
    }
  };

  const handleDisconnect = async () => {
    try {
      await firebaseLogout();
    } catch (e) {
      console.warn("Firebase logout failed:", e);
    }
    setAccessToken("");
    setIsConnected(false);
    setClientId("");
    setAuthEmail(null);
    setSpreadsheetId("");
    localStorage.removeItem("harnack_spreadsheet_id");
    setSyncMessage({
      text: "Verbindung zum echten Google Drive/Sheets getrennt. Simulator geladen.",
      type: "success"
    });
    setTimeout(() => setSyncMessage({ text: "", type: null }), 4000);
  };

  // --- Active Sheets Synchronization Handler ---
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncMessage({ text: "", type: null });

    if (isConnected && accessToken) {
      // WRITE TO THE REAL GOOGLE SHEETS via client REST Calls!
      try {
        let targetId = spreadsheetId;
        if (!targetId) {
          // 1. Create spreadsheet file
          targetId = await createGoogleSheet(accessToken);
          setSpreadsheetId(targetId);
          localStorage.setItem("harnack_spreadsheet_id", targetId);
        }

        // 2. Transmit rows
        await syncSpreadsheetData(accessToken, targetId, tasks);
        setSyncMessage({
          text: `Echtzeit-Synchronisierung erfolgreich! Daten in Google Sheet geschrieben.`,
          type: "success"
        });
      } catch (err: any) {
        console.error(err);
        setSyncMessage({
          text: `Fehler bei Google Sheets Übertragung: ${err.message}. Bitte Log prüfen.`,
          type: "error"
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      // SIMULATE Google Sheets updates locally!
      setTimeout(() => {
        addApiLog(
          "POST",
          "https://sheets.googleapis.com/v4/spreadsheets (SIMULATION)",
          { title: "Harnack-Haus Raumplaner (Simuliert)" },
          "success",
          { spreadsheetId: "sim-spreadsheet-id-harnack-123456789" }
        );
        addApiLog(
          "POST",
          "https://sheets.googleapis.com/v4/spreadsheets/sim-spreadsheet-id-harnack-123456789/values:batchUpdate (SIMULATION)",
          { syncedTasksCount: tasks.length, memberWorkloadsCount: members.length },
          "success",
          { status: "Synced simulated sheets tabs", updatedRange: "Aufgaben!A2:I200, Team-Auslastung!A2:D50" }
        );

        setIsSyncing(false);
        setSyncMessage({
          text: "Simulierte Google Tabellen Aktualisierung erfolgreich! Die ausgehenden JSON-Payloads sind in den Logs sichtbar.",
          type: "success"
        });
        setTimeout(() => setSyncMessage({ text: "", type: null }), 6000);
      }, 1000);
    }
  };

  // --- Filter Tasks Lists ---
  const filteredTasks = tasks.filter((t) => {
    const matchQuery = 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (t.notes || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assignee || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchRoom = roomFilter ? t.room === roomFilter : true;
    const matchStatus = statusFilter ? t.status === statusFilter : true;
    const matchPriority = priorityFilter ? t.priority === priorityFilter : true;
    const matchAssignee = assigneeFilter ? t.assignee === assigneeFilter : true;

    return matchQuery && matchRoom && matchStatus && matchPriority && matchAssignee;
  });

  const activeRoomTasks = selectedRoomOnGrid ? tasks.filter((t) => t.room === selectedRoomOnGrid) : [];

  const systemDate = currentDateTime.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const systemTime = currentDateTime.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  return (
    <div className="min-h-screen bg-black font-sans text-white leading-normal">
      {/* HEADER BANNER */}
      <header className="bg-black border-b-2 border-brand-teal sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-brand-teal rounded-xl p-2.5 text-white shadow-lg shadow-brand-teal/30 shrink-0">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-1.5 truncate">
                  Harnack-Haus
                  <span className="text-xs py-0.5 px-2 rounded-md bg-brand-teal/20 text-white border border-brand-teal font-extrabold font-mono hidden sm:inline">
                    Raumkoordinator
                  </span>
                </h1>
                <p className="text-xs text-brand-gray font-bold font-mono truncate">
                  Max-Planck-Gesellschaft Veranstaltungsportal
                </p>
              </div>
            </div>

            {/* Localized Date or Auth indicator */}
            <div className="flex items-center space-x-3 text-xs text-white font-medium">
              {/* ADMIN MODE TOGGLE BADGE */}
              <button
                id="admin-mode-toggle-btn"
                onClick={handleAdminAuthToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-extrabold border select-none text-[10px] sm:text-xs ${
                  isAdmin 
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/80 hover:bg-amber-500/20 shadow-lg shadow-amber-500/10" 
                    : "bg-neutral-900 text-slate-450 border-neutral-800 hover:text-white hover:border-slate-500"
                }`}
                title="Administrative Sonderfunktionen freischalten (Passwort: admin)"
              >
                {isAdmin ? (
                  <>
                    <Unlock className="h-3.5 w-3.5 text-amber-450 animate-pulse" />
                    <span>Admin: Aktiv</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                    <span>🔑 Admin-Login</span>
                  </>
                )}
              </button>

              <span className="hidden lg:flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-xl border border-brand-gray/45 font-mono text-white font-extrabold text-xs">
                <Calendar className="h-4 w-4 text-brand-teal shrink-0" />
                <span className="truncate">{systemDate}</span>
                <span className="text-brand-teal border-l border-white/10 pl-2 font-mono tabular-nums shrink-0">
                  ⏱️ {systemTime} Uhr
                </span>
              </span>
              <span className="flex lg:hidden items-center gap-1.5 bg-neutral-900 px-3 py-1.5 rounded-xl border border-brand-gray/45 font-mono text-white font-extrabold text-xs">
                <Calendar className="h-4 w-4 text-brand-teal shrink-0" />
                <span className="font-mono tabular-nums text-brand-teal">⏱️ {systemTime}</span>
              </span>

              {isConnected && (
                <button
                  id="disconnect-quick-btn"
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 bg-rose-950/80 text-rose-300 hover:bg-rose-900 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer font-extrabold border border-rose-500/40"
                  title="Verbindung trennen"
                >
                  <LogOut className="h-3.5 w-3.5 mr-0.5" />
                  <span className="hidden sm:inline">Trennen</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* SUB-HEADER METRIC OVERVIEW DECK */}
      <section className="bg-black text-white py-6 border-b border-brand-gray/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-950 border-2 border-brand-gray/40 hover:border-brand-teal transition-colors">
              <span className="block text-brand-gray text-[10px] font-black uppercase tracking-wider font-mono">
                Aufgaben Gesamt
              </span>
              <span className="text-2xl font-black text-white mt-1 block">
                {tasks.length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-950 border-2 border-brand-gray/40 hover:border-emerald-500 transition-colors">
              <span className="block text-brand-gray text-[10px] font-black uppercase tracking-wider font-mono">
                Erfüllungsquote
              </span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">
                {tasks.length > 0
                  ? `${Math.round(
                      (tasks.filter((t) => t.status === TaskStatus.DONE).length /
                        tasks.length) *
                        100
                    )}%`
                  : "0%"}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-950 border-2 border-brand-gray/40 hover:border-cyan-400 transition-colors">
              <span className="block text-brand-gray text-[10px] font-black uppercase tracking-wider font-mono">
                In Arbeit
              </span>
              <span className="text-2xl font-black text-cyan-400 mt-1 block font-mono">
                {tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-950 border-2 border-brand-gray/40 hover:border-rose-500 transition-colors">
              <span className="block text-brand-gray text-[10px] font-black uppercase tracking-wider font-mono">
                Prioritär Offen
              </span>
              <span className="text-2xl font-black text-rose-500 mt-1 block font-mono animate-pulse">
                {tasks.filter((t) => t.status !== TaskStatus.DONE && t.priority === TaskPriority.HIGH).length}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CORE WRAPPER CONTROLLER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
        
        {/* Dynamic Warning Notification bar */}
        {syncMessage.text && (
          <div
            id="sync-notification-bar"
            className={`p-4 rounded-xl border flex items-start gap-2.5 transition-all animate-bounce backdrop-blur-xl shadow-lg ${
              syncMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-300 border-rose-500/20"
            }`}
          >
            {syncMessage.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs font-bold leading-relaxed">
              {syncMessage.text}
            </div>
            <button
              onClick={() => setSyncMessage({ text: "", type: null })}
              className="ml-auto hover:bg-white/10 text-slate-300 hover:text-white rounded p-1 transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* NAVIGATION TAB CONTROLLER */}
        <div className="flex border-b-2 border-brand-teal/30 overflow-x-auto gap-2 py-2 scrollbar-none sticky top-16 bg-black/95 backdrop-blur-xl z-30">
          {[
            { id: "rooms", label: "🏢 Raum-Overview", icon: Home },
            { id: "list", label: "📋 Alle Aufgaben", icon: ListTodo },
            { id: "workload", label: "👥 Team-Auslastung", icon: Users },
            { id: "report", label: "📊 Tagesberichte", icon: FileText },
            { id: "sheets", label: "🟢 Google Sheets Sync", icon: FileSpreadsheet },
            { id: "audit", label: "📜 Änderungsprotokoll", icon: History }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                id={`nav-tab-btn-${tab.id}`}
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setRoomDetailOpen(false);
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer transition-all border-2 ${
                  isActive
                    ? "bg-brand-teal border-brand-teal text-white shadow-[0_0_15px_rgba(0,108,102,0.6)] font-extrabold"
                    : "bg-transparent border-transparent text-brand-gray hover:text-white hover:bg-brand-teal/20"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? "text-white animate-pulse-subtle" : "text-brand-gray/80"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CORE SCREEN CONTENTS */}
        <div className="space-y-6">
          
          {/* TAB 1: ROOMS GRID PREVIEW */}
          {activeTab === "rooms" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-brand-gray/20">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-black tracking-tight text-white font-display">
                    Säle- & Hörsaal-Belegung
                  </h2>
                  <p className="text-xs text-brand-gray font-bold">
                    Übersicht der 11 Tagungsräumlichkeiten des Standorts mit Belegungszustand.
                  </p>
                </div>
                <button
                  id="header-create-task-btn"
                  onClick={() => handleAddTask()}
                  className="rounded-xl bg-brand-teal hover:bg-white text-white hover:text-brand-teal border-2 border-brand-teal hover:border-white font-black text-xs px-5 py-2.5 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-brand-teal/30 select-none animate-pulse-subtle"
                >
                  <Plus className="h-4.5 w-4.5" /> Neue Aufgabe
                </button>
              </div>

              <RoomsGrid
                rooms={ROOMS}
                tasks={tasks}
                onSelectRoom={(r) => {
                  setSelectedRoomOnGrid(r);
                  setRoomDetailOpen(true);
                }}
                onAddTaskForRoom={(r) => {
                  handleAddTask(r);
                }}
              />
            </div>
          )}

          {/* TAB 2: DETAILED DATA TABLE OF ALL TASKS */}
          {activeTab === "list" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-black tracking-tight text-white font-display">
                    Gesamte Aufgabenübersicht
                  </h2>
                  <p className="text-xs text-brand-gray font-bold">
                    Suchen, filtern und bearbeiten Sie alle anstehenden Vorgänge im Harnack-Haus.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                  <button
                    id="tasks-clean-old-btn"
                    onClick={cleanOldTasks}
                    className={`rounded-xl border-2 font-bold text-xs px-4 py-2.5 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg select-none ${
                      isAdmin 
                        ? "bg-rose-950/45 hover:bg-rose-900 border-rose-800/50 hover:border-rose-500 text-rose-300 hover:text-white" 
                        : "bg-neutral-900 hover:bg-neutral-850 border-neutral-800 hover:border-amber-500/50 text-slate-350 hover:text-white"
                    }`}
                    title={isAdmin ? "Entfernt alle erledigten Aufgaben mit einer Frist, die heute oder in der Vergangenheit liegt." : "Diese Aktion erfordert Administratorrechte (Passwort: admin)."}
                  >
                    {isAdmin ? (
                      <>
                        <Trash2 className="h-4 w-4 text-rose-450 animate-pulse" />
                        <span>Alte erledigte Aufgaben klären</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 text-amber-500" />
                        <span>Alte erledigte Aufgaben klären (Admin)</span>
                      </>
                    )}
                  </button>
                  <button
                    id="tasks-excel-export-btn"
                    onClick={exportToExcel}
                    className="rounded-xl bg-emerald-950/40 hover:bg-emerald-900 border-2 border-emerald-800/40 hover:border-emerald-500 text-emerald-300 hover:text-white font-bold text-xs px-4 py-2.5 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg select-none"
                    title="Exportiert die aktuell gefilterten Aufgaben als Excel-kompatible Datei (.csv)"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Web-Excel Export
                  </button>
                  <button
                    id="tasks-page-create-task-btn"
                    onClick={() => handleAddTask()}
                    className="rounded-xl bg-brand-teal hover:bg-white text-white hover:text-brand-teal border-2 border-brand-teal hover:border-white font-black text-xs px-5 py-2.5 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-brand-teal/30 select-none"
                  >
                    <Plus className="h-4.5 w-4.5" /> Neue Aufgabe
                  </button>
                </div>
              </div>

              {/* SEARCH & FILTERS BOX */}
              <div className="rounded-2xl border-2 border-brand-teal bg-neutral-950 p-5 space-y-4 text-white shadow-xl">
                <div className="flex items-center bg-black rounded-lg px-3 py-2 border-2 border-brand-teal">
                  <Search className="h-4 w-4 text-brand-gray shrink-0 mr-2" />
                  <input
                    id="search-tasks-input"
                    type="text"
                    placeholder="Suche nach Thema, Notizen, Zuständigkeit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none text-xs focus:outline-none placeholder-brand-gray text-white font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-brand-gray hover:text-white p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {/* Filter Room */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-brand-gray block tracking-wider font-mono">Raum</span>
                    <select
                      id="filter-room-select"
                      value={roomFilter}
                      onChange={(e) => setRoomFilter(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border-2 border-brand-gray/60 bg-black text-white focus:outline-none focus:border-brand-teal text-xs font-bold"
                    >
                      <option value="" className="bg-black text-white">Alle Räume</option>
                      {ROOMS.map((r) => (
                        <option key={r} value={r} className="bg-black text-white">
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Status */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-brand-gray block tracking-wider font-mono">Status</span>
                    <select
                      id="filter-status-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border-2 border-brand-gray/60 bg-black text-white focus:outline-none focus:border-brand-teal text-xs font-bold"
                    >
                      <option value="" className="bg-black text-white">Alle Status</option>
                      <option value={TaskStatus.PENDING} className="bg-black text-white">Ausstehend</option>
                      <option value={TaskStatus.IN_PROGRESS} className="bg-black text-white">In Arbeit</option>
                      <option value={TaskStatus.DONE} className="bg-black text-white">Erledigt</option>
                    </select>
                  </div>

                  {/* Filter Priority */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-brand-gray block tracking-wider font-mono">Priorität</span>
                    <select
                      id="filter-priority-select"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border-2 border-brand-gray/60 bg-black text-white focus:outline-none focus:border-brand-teal text-xs font-bold"
                    >
                      <option value="" className="bg-black text-white">Alle Prioritäten</option>
                      <option value={TaskPriority.HIGH} className="bg-black text-white">Hoch</option>
                      <option value={TaskPriority.MEDIUM} className="bg-black text-white">Mittel</option>
                      <option value={TaskPriority.LOW} className="bg-black text-white">Niedrig</option>
                    </select>
                  </div>

                      {/* Filter Assignee */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-brand-gray block tracking-wider font-mono">Zuständig</span>
                        <select
                          id="filter-assignee-select"
                          value={assigneeFilter}
                          onChange={(e) => setAssigneeFilter(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border-2 border-brand-gray/60 bg-black text-white focus:outline-none focus:border-brand-teal text-xs font-bold"
                        >
                          <option value="" className="bg-black text-white">Alle Personen</option>
                          {members.map((member) => {
                            const { name, email } = parseMember(member);
                            return (
                              <option key={member} value={member} className="bg-black text-white">
                                {name} {email ? `(${email})` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                </div>
              </div>

              {/* TASKS LIST GRID / TABLE CARD */}
              <div className="rounded-2xl border-2 border-brand-gray/50 bg-neutral-950 overflow-hidden shadow-xl">
                {filteredTasks.length > 0 ? (
                  <div className="overflow-x-auto border-none">
                    <table className="w-full border-collapse text-xs text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-brand-teal/20 border-b-2 border-brand-teal text-white font-extrabold uppercase tracking-wider text-[10px]">
                          <th className="px-5 py-3.5">Aufgabe / Projekt</th>
                          <th className="px-4 py-3.5">Harnack-Raum</th>
                          <th className="px-4 py-3.5">Zuständig</th>
                          <th className="px-4 py-3.5">Priorität</th>
                          <th className="px-4 py-3.5">Frist</th>
                          <th className="px-4 py-3.5">Status Schnelleinstellung</th>
                          <th className="px-5 py-3.5 text-right">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {filteredTasks.map((t) => {
                          let statusColor = "bg-amber-500/10 text-amber-300 border-amber-500/20";
                          if (t.status === TaskStatus.DONE) statusColor = "bg-emerald-500/10 text-emerald-305 border-emerald-500/20";
                          else if (t.status === TaskStatus.IN_PROGRESS) statusColor = "bg-blue-500/10 text-blue-300 border-blue-500/20";

                          let prioIcon = "🟢 Niedrig";
                          if (t.priority === TaskPriority.HIGH) prioIcon = "🔥 Hoch";
                          else if (t.priority === TaskPriority.MEDIUM) prioIcon = "🟡 Mittel";

                          return (
                            <tr id={`task-row-${t.id}`} key={t.id} className="hover:bg-white/5 group transition-colors">
                              <td className="px-5 py-3.5">
                                <span className={`font-semibold block text-white truncate max-w-xs ${t.status === TaskStatus.DONE ? "line-through text-slate-500" : ""}`}>
                                  {t.title}
                                </span>
                                {t.notes && (
                                  <span className="block text-[10px] text-slate-450 truncate max-w-sm font-mono mt-0.5">
                                    Notiz: {t.notes}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-bold text-slate-200">
                                {t.room}
                              </td>
                              <td className="px-4 py-3.5">
                                {t.assignee ? (
                                  (() => {
                                    const { name, email } = parseMember(t.assignee);
                                    return (
                                      <div className="flex flex-col">
                                        <span className="font-bold text-white truncate max-w-[150px]">{name || "Name offen"}</span>
                                        {email && (
                                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5 truncate max-w-[150px]" title={email}>
                                            📬 {email}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <span className="text-slate-500 italic text-[11px] font-mono">Zuweisung offen</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-bold">
                                <span className={t.priority === TaskPriority.HIGH ? "text-rose-400" : "text-slate-300"}>
                                  {prioIcon}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 font-bold font-mono text-slate-300">
                                {t.deadline}
                              </td>
                              <td className="px-4 py-3.5 select-none">
                                <button
                                  id={`quick-status-${t.id}`}
                                  type="button"
                                  onClick={() => handleToggleStatus(t.id)}
                                  className={`px-3 py-1.5 rounded-full font-bold text-[10.5px] border cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all text-center ${statusColor}`}
                                  title="Klicken zum schnellen Ändern des Status"
                                >
                                  {t.status}
                                </button>
                              </td>
                              <td className="px-5 py-3.5 text-right font-medium">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    id={`edit-task-action-${t.id}`}
                                    onClick={() => handleEditTask(t)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-white/5 transition-all"
                                    title="Aufgabe bearbeiten"
                                  >
                                    <Edit3 className="h-4.5 w-4.5" />
                                  </button>
                                  <button
                                    id={`delete-task-action-${t.id}`}
                                    onClick={() => handleDeleteTask(t.id)}
                                    className={`p-1 rounded-lg transition-all ${
                                      t.status === TaskStatus.DONE && !isAdmin
                                        ? "text-slate-500 hover:text-amber-500 hover:bg-amber-950/20"
                                        : "text-slate-400 hover:text-rose-400 hover:bg-white/5"
                                    }`}
                                    title={t.status === TaskStatus.DONE && !isAdmin ? "Erledigte Aufgabe löschen (Admin-Sperre - Passwort erforderlich)" : "Aufgabe löschen"}
                                  >
                                    {t.status === TaskStatus.DONE && !isAdmin ? (
                                      <Lock className="h-4.5 w-4.5 text-amber-550" />
                                    ) : (
                                      <Trash2 className="h-4.5 w-4.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-20 text-slate-400 space-y-2 animate-fade-in bg-white/5">
                    <ListTodo className="h-10 w-10 mx-auto text-slate-550" />
                    <p className="text-xs italic font-mono">Keine Aufgaben entsprechen den Filterkriterien.</p>
                    <button
                      id="reset-filters-btn"
                      onClick={() => {
                        setSearchQuery("");
                        setRoomFilter("");
                        setPriorityFilter("");
                        setStatusFilter("");
                        setAssigneeFilter("");
                      }}
                      className="text-xs text-emerald-300 font-bold hover:underline"
                    >
                      Filter zurücksetzen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TEAM WORKLOAD */}
          {activeTab === "workload" && (
            <TeamWorkload
              tasks={tasks}
              members={members}
              onAddMember={handleAddMember}
              onRemoveMember={handleRemoveMember}
              onSelectTask={(t) => handleEditTask(t)}
              showConfirm={showCustomConfirm}
            />
          )}

          {/* TAB 4: MANAGER DAILY PROGRESS STATUS REPORT */}
          {activeTab === "report" && <ManagerReport tasks={tasks} members={members} />}

          {/* TAB 5: GOOGLE SHEETS SYNC SYSTEM */}
          {activeTab === "sheets" && (
            <SheetsPanel
              tasks={tasks}
              members={members}
              spreadsheetId={spreadsheetId}
              accessToken={accessToken}
              clientId={clientId}
              isConnected={isConnected}
              onConnectReal={handleConnectReal}
              onDisconnect={handleDisconnect}
              onTriggerSync={handleTriggerSync}
              isSyncing={isSyncing}
              onConnectFirebase={handleConnectFirebase}
              authEmail={authEmail}
            />
          )}

          {/* TAB 6: AUDIT LOGGER HISTORY */}
          {activeTab === "audit" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b-2 border-brand-teal/30">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-black tracking-tight text-white font-display">
                    Änderungs- &amp; Audit-Protokoll
                  </h2>
                  <p className="text-xs text-brand-gray font-bold">
                    Protokolliert alle Erstellungen, Statusänderungen, Bearbeitungen, Löschvorgänge und Bereinigungen von Harnack-Haus-Aufgaben.
                  </p>
                </div>
                {isAdmin && auditLogs.length > 0 && (
                  <button
                    id="clear-audit-logs-btn"
                    onClick={handleClearAuditLogs}
                    className="rounded-xl bg-neutral-900 border-2 border-rose-800/40 hover:border-rose-500 text-rose-350 hover:text-white font-semibold text-xs px-4 py-2.5 transition-all flex items-center gap-1.5 cursor-pointer select-none"
                    title="Löscht alle erfassten Änderungen unwiderruflich"
                  >
                    <Trash2 className="h-4 w-4 text-rose-400" /> Protokoll leeren
                  </button>
                )}
              </div>

              {!isAdmin ? (
                /* Unauthenticated Guard Display asking forpassword pin */
                <div className="rounded-2xl border-2 border-amber-500/50 bg-neutral-950 p-8 text-center max-w-md mx-auto my-12 space-y-6 shadow-xl shadow-amber-500/5 animate-fade-in">
                  <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 w-16 h-16 flex items-center justify-center mx-auto text-amber-400 shadow-md">
                    <Lock className="h-8 w-8 text-amber-450 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-base text-white">Administrator-Sicherheitsprüfung</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Das detaillierte Änderungsprotokoll ist geschützt. Authentifizieren Sie sich als Raumadministrator, um Aufzeichnungen einzusehen.
                    </p>
                  </div>
                  
                  <form onSubmit={handleAdminLoginSubmit} className="space-y-3 pt-2 text-left">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Admin-Kennwort</label>
                      <input
                        type="password"
                        placeholder="Kennwort eingeben (Tipp: admin)"
                        value={adminPassInput}
                        onChange={(e) => {
                          setAdminPassInput(e.target.value);
                          setAdminError("");
                        }}
                        className="w-full bg-black border-2 border-brand-teal rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-teal/50 font-semibold"
                        autoFocus
                      />
                    </div>
                    {adminError && (
                      <p className="text-[10px] font-semibold text-rose-400 bg-rose-950/20 border border-rose-900/40 p-2.5 rounded-lg leading-normal font-mono">
                        ⚠️ {adminError}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-brand-teal hover:bg-white text-white hover:text-brand-teal border-2 border-brand-teal font-black text-xs py-2.5 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                    >
                      <ShieldCheck className="h-4 w-4" /> Freischalten
                    </button>
                  </form>
                  <p className="text-[10px] italic text-slate-500 font-mono pt-1">
                    Passwort: <code className="bg-white/5 border border-white/5 font-bold px-1.5 py-0.5 rounded text-slate-200">admin</code> oder <code className="bg-white/5 border border-white/5 font-bold px-1.5 py-0.5 rounded text-slate-200">harnack</code>
                  </p>
                </div>
              ) : (
                /* Authenticated Logs Dashboard list */
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-brand-gray/50 bg-neutral-950 overflow-hidden shadow-xl">
                    {auditLogs.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {/* Table Header Row */}
                        <div className="bg-brand-teal/20 px-5 py-3 border-b-2 border-brand-teal text-[10px] font-extrabold uppercase tracking-wider text-slate-300 flex flex-row items-center justify-between">
                          <span className="w-40 shrink-0 font-mono">Zeitstempel</span>
                          <span className="w-32 shrink-0 font-mono text-center">Ereignis-Typ</span>
                          <span className="flex-1 px-4 font-mono">Änderungen / Details</span>
                          <span className="w-28 shrink-0 text-right font-mono">Akteur</span>
                        </div>

                        {/* List */}
                        {auditLogs.map((log) => {
                          const logDate = new Date(log.timestamp);
                          const formattedDate = logDate.toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          });

                          let badgeColor = "bg-neutral-900 text-slate-400 border-neutral-800";
                          let badgeText = "Unbekannt";

                          switch (log.action) {
                            case "create":
                              badgeColor = "bg-emerald-500/10 text-emerald-350 border-emerald-500/30";
                              badgeText = "✅ Erstellt";
                              break;
                            case "update":
                              badgeColor = "bg-blue-500/10 text-blue-300 border-blue-500/30";
                              badgeText = "📝 Editiert";
                              break;
                            case "toggle":
                              badgeColor = "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
                              badgeText = "🔄 Status";
                              break;
                            case "delete":
                              badgeColor = "bg-rose-500/10 text-rose-350 border-rose-500/30";
                              badgeText = "🗑️ Gelöscht";
                              break;
                            case "clean":
                              badgeColor = "bg-purple-500/10 text-purple-300 border-purple-500/30";
                              badgeText = "🧹 Bereinigt";
                              break;
                          }

                          return (
                            <div
                              id={`audit-log-row-${log.id}`}
                              key={log.id}
                              className="px-5 py-3.5 flex flex-col md:flex-row md:items-center gap-4 hover:bg-white/5 transition-colors text-xs leading-relaxed"
                            >
                              {/* Date Column */}
                              <div className="w-40 shrink-0 font-mono text-[11px] text-slate-400">
                                📅 {formattedDate}
                              </div>

                              {/* Action badge */}
                              <div className="w-32 shrink-0 flex items-center justify-start md:justify-center">
                                <span className={`px-2.5 py-1 rounded-full border text-[10px] uppercase font-bold w-full text-center tracking-tight truncate ${badgeColor}`}>
                                  {badgeText}
                                </span>
                              </div>

                              {/* Details text */}
                              <div className="flex-1 min-w-0">
                                <span className="text-white font-bold block sm:inline-block mr-1">
                                  {log.taskTitle ? `„${log.taskTitle}“` : `ID: ${log.taskId}`}
                                </span>
                                <span className="text-[10px] text-brand-teal font-bold font-mono bg-brand-teal/10 rounded px-1.5 py-0.5 border border-brand-teal/20 inline-block mr-2" title="Tagungsraum">
                                  🏛️ {log.room}
                                </span>
                                <p className="text-slate-350 text-xs mt-1 block">
                                  {log.details}
                                </p>
                              </div>

                              {/* Actor operator status */}
                              <div className="w-28 shrink-0 text-left md:text-right select-none">
                                <span className={`inline-block px-2.5 py-1 rounded-lg text-[9.5px] font-bold border ${
                                  log.byAdmin 
                                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30" 
                                    : "bg-slate-900 text-slate-400 border-neutral-800"
                                }`}>
                                  {log.byAdmin ? "👑 Admin" : "👥 Mitarbeiter"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-20 text-slate-400 space-y-3 bg-white/5 select-none">
                        <History className="h-10 w-10 mx-auto text-slate-500" />
                        <h4 className="font-bold text-sm text-white">Bislang keine Aktivitäten erfasst</h4>
                        <p className="text-xs italic font-mono max-w-sm mx-auto">
                          Tragen Sie neue Aufgaben ein oder bearbeiten Sie diese, um hier ein lückenloses Protokoll aller Raumplaner-Änderungen zu führen.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 mt-20 py-8 text-center text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5 select-none font-mono">
          <p>Harnack-Haus Belegungsplaner &copy; 2026. Herausgegeben durch MPG Tagungsstätte Berlin-Dahlem.</p>
          <p className="text-[10px]">Echtzeit Google Sheets Synchronisierungsmodul für Microsoft Excel / Google Workspace.</p>
        </div>
      </footer>

      {/* INTERACTIVE SIDE DRAWER: Specific Room tasks detail visualizer */}
      {roomDetailOpen && selectedRoomOnGrid && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">{selectedRoomOnGrid}</h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Raumbezogenes Aufgaben-Protokoll
              </p>
            </div>
            <button
              id="close-room-drawer-btn"
              onClick={() => setRoomDetailOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Detail List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-50">
              <span className="font-bold text-slate-500 uppercase">Geplante Vorgänge</span>
              <span className="font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full text-[10px]">
                {activeRoomTasks.length} gesamt
              </span>
            </div>

            {activeRoomTasks.length > 0 ? (
              <div className="space-y-3">
                {activeRoomTasks.map((t) => {
                  let badge = "bg-amber-50 text-amber-700 border-amber-200";
                  if (t.status === TaskStatus.DONE) badge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  else if (t.status === TaskStatus.IN_PROGRESS) badge = "bg-blue-50 text-blue-700 border-blue-100";

                  return (
                    <div
                      id={`drawer-task-row-${t.id}`}
                      key={t.id}
                      className="p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-3 bg-white"
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-bold text-slate-800 text-xs block leading-relaxed">
                          {t.title}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 ${badge}`}>
                          {t.status}
                        </span>
                      </div>

                      {t.notes && (
                        <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-50">
                          {t.notes}
                        </p>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-105/90 pt-2 font-mono">
                        <span>Zuständig: <b>{(() => {
                          if (!t.assignee) return "Offen";
                          const { name, email } = parseMember(t.assignee);
                          return email ? `${name} (${email})` : name;
                        })()}</b></span>
                        <span>Frist: {t.deadline}</span>
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-50 mt-1">
                        <button
                          id={`drawer-edit-task-${t.id}`}
                          onClick={() => {
                            handleEditTask(t);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" /> Bearbeiten
                        </button>
                        <button
                          id={`drawer-delete-task-${t.id}`}
                          onClick={() => {
                            handleDeleteTask(t.id);
                          }}
                          className={`px-2.5 py-1 text-[10px] font-bold transition-colors rounded-lg flex items-center gap-1 cursor-pointer ${
                            t.status === TaskStatus.DONE && !isAdmin
                              ? "text-amber-700 bg-amber-50 hover:bg-amber-105 border border-amber-200"
                              : "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          }`}
                          title={t.status === TaskStatus.DONE && !isAdmin ? "Löschen erfordert Admin-Passwort" : "Aufgabe löschen"}
                        >
                          {t.status === TaskStatus.DONE && !isAdmin ? (
                            <Lock className="h-3 w-3 text-amber-550" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Löschen</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 italic text-xs">
                Keine Aufgaben für diesen Raum eingetragen.
              </div>
            )}
          </div>

          {/* Quick Create option */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <button
              id="drawer-add-task-btn"
              onClick={() => {
                handleAddTask(selectedRoomOnGrid);
              }}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-emerald-600/10"
            >
              <Plus className="h-4 w-4" /> Aufgabe für diesen Raum hinzufügen
            </button>
          </div>
        </div>
      )}

      {/* FULL FORM COMPONENT DIALOG MODAL */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        initialTask={modalTask}
        defaultRoom={selectedRoomOnGrid}
        existingMembers={members}
      />

      {/* EMAIL TOAST NOTIFICATION OVERLAY */}
      {showEmailToast && recentEmail && (
        <div 
          id="email-notification-toast"
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border p-4 text-white shadow-2xl backdrop-blur-xl animate-bounce-subtle flex flex-col gap-2 transition-all ${
            emailStatus === "sending" ? "border-neutral-700 bg-neutral-900/95" :
            emailStatus === "success" ? "border-emerald-500 bg-slate-900/95" :
            emailStatus === "error" ? "border-rose-500 bg-rose-950/95 text-rose-100" :
            "border-cyan-500 bg-slate-900/95"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <span className={`p-1.5 rounded-xl text-base border shrink-0 ${
              emailStatus === "sending" ? "bg-neutral-800 text-neutral-300 border-neutral-700" :
              emailStatus === "success" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
              emailStatus === "error" ? "bg-rose-500/20 text-rose-300 border-rose-500/30" :
              "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
            }`}>
              {emailStatus === "sending" ? "🔄" : emailStatus === "error" ? "⚠️" : "📬"}
            </span>
            <div className="flex-1 min-w-0">
              <h5 className="font-bold text-xs text-slate-100 flex items-center gap-1.5 flex-wrap">
                {emailStatus === "sending" && "E-Mail wird gesendet..."}
                {emailStatus === "success" && "E-Mail via Gmail versandt!"}
                {emailStatus === "error" && "Gmail-Versand fehlgeschlagen!"}
                {emailStatus === "simulated" && "E-Mail-Simulation erfolgreich!"}
                
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border ${
                  emailStatus === "sending" ? "bg-neutral-800 text-neutral-400 border-neutral-700" :
                  emailStatus === "success" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                  emailStatus === "error" ? "bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold" :
                  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                }`}>
                  {emailStatus === "sending" && "PROZESS"}
                  {emailStatus === "success" && "GMAIL REAL"}
                  {emailStatus === "error" && "FEHLER"}
                  {emailStatus === "simulated" && "SIMULATION"}
                </span>
              </h5>
              <p className="text-[11px] text-slate-300 truncate mt-1">
                Zuständig: <b className="font-mono text-white bg-white/5 px-1 py-0.5 rounded border border-white/5">{recentEmail.to}</b>
              </p>
              
              {emailStatus === "error" && (
                <div className="mt-1.5 bg-black/40 border border-rose-500/20 text-rose-200 text-[10px] p-2 rounded-lg leading-relaxed select-text">
                  <p className="font-semibold text-rose-305 mb-1 text-rose-300">Details: {emailError}</p>
                  <p className="text-[9px] text-slate-400">
                    💡 <b>Lösung:</b> Möglicherweise fehlen die Gmail-Rechte. Bitte wechseln Sie zum Reiter <b>Google Tabellen</b>, klicken Sie auf <b>"Verbindung trennen"</b> und verbinden Sie sich neu, um das E-Mail-Recht zu autorisieren.
                  </p>
                </div>
              )}

              {emailStatus !== "error" && (
                <p className="text-[10px] text-slate-400 italic truncate mt-1">
                  "{recentEmail.subject}"
                </p>
              )}
            </div>
            <button 
              onClick={() => setShowEmailToast(false)}
              className="text-slate-400 hover:text-white p-1 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-end border-t border-white/5 pt-2 mt-1">
            <button
              onClick={() => {
                setShowEmailToast(false);
                setShowEmailModal(true);
              }}
              className="text-[10px] text-brand-teal hover:text-white font-extrabold flex items-center gap-1 cursor-pointer"
            >
              Vollständige E-Mail ansehen &rarr;
            </button>
          </div>
        </div>
      )}

      {/* EMAIL DETAILS PREVIEW MODAL */}
      {showEmailModal && recentEmail && (
        <div id="email-preview-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 shadow-3xl text-left overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/50 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📩</span>
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider font-mono">
                    Gesendete E-Mail-Vorschau
                  </h3>
                  <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    SMTP / Google Mail API Simulation aktiv
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5 border-b border-white/5 pb-3">
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="font-mono w-16 shrink-0 block">An:</span> 
                  <span className="font-mono text-white font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5 truncate">{recentEmail.to}</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="font-mono w-16 shrink-0 block">Betreff:</span> 
                  <span className="font-bold text-white truncate">{recentEmail.subject}</span>
                </div>
              </div>
              <div className="bg-black/45 border border-white/5 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {recentEmail.body}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950/55 border-t border-white/10 text-xs">
              <span className="text-slate-400 font-mono text-[10px]">
                Versendet über Google Gmail OAuth v2
              </span>
              <button
                onClick={() => setShowEmailModal(false)}
                className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 transition-all cursor-pointer text-xs"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PASSCODE AUTHENTICATION MODAL OVERLAY */}
      {showAdminPassModal && (
        <div id="admin-auth-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in text-white">
          <div className="relative w-full max-w-sm rounded-2xl bg-neutral-950 border-2 border-amber-500 p-6 shadow-2xl space-y-5">
            <button
              onClick={() => {
                setShowAdminPassModal(false);
                setPendingActionAfterAdminAuth(null);
                setAdminPassInput("");
                setAdminError("");
              }}
              className="absolute top-4 right-4 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="text-center space-y-2">
              <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-3.5 w-14 h-14 flex items-center justify-center mx-auto text-amber-400">
                <Lock className="h-6 w-6 text-amber-450 animate-pulse" />
              </div>
              <h3 className="font-extrabold text-base text-white font-display">Raumadministrator-Freigabe</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {pendingActionAfterAdminAuth 
                  ? "Für diesen Vorgang (z.B. Löschen erledigter Aufgaben oder Bereinigen der Altlacke) sind Administratorrechte erforderlich." 
                  : "Melden Sie sich an, um das lückenlose Protokoll aller Änderungen freizuschalten."}
              </p>
            </div>

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">Passwort eingeben</label>
                <input
                  type="password"
                  placeholder="Administrator-Passwort"
                  value={adminPassInput}
                  onChange={(e) => {
                    setAdminPassInput(e.target.value);
                    setAdminError("");
                  }}
                  className="w-full bg-black border-2 border-brand-teal rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-teal/50 font-semibold"
                  autoFocus
                />
              </div>

              {adminError && (
                <p className="text-[10px] text-rose-450 bg-rose-950/25 border border-rose-900/30 p-2.5 rounded-lg font-mono font-bold leading-normal">
                  ⚠️ {adminError}
                </p>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminPassModal(false);
                    setPendingActionAfterAdminAuth(null);
                    setAdminPassInput("");
                    setAdminError("");
                  }}
                  className="flex-1 rounded-xl bg-neutral-900 hover:bg-white/5 border border-neutral-800 text-slate-350 hover:text-white transition-all text-xs font-bold py-2.5 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-brand-teal hover:bg-white text-white hover:text-brand-teal border-2 border-brand-teal transition-all font-black text-xs py-2.5 cursor-pointer shadow-lg shadow-brand-teal/20"
                >
                  Bestätigen
                </button>
              </div>
            </form>

            <p className="text-[9.5px] italic text-slate-500 font-mono text-center">
              Tipp: Passwort lautet <code className="bg-white/5 text-slate-200 border border-white/5 font-bold px-1 py-0.5 rounded">admin</code> oder <code className="bg-white/5 text-slate-200 border border-white/5 font-bold px-1 py-0.5 rounded">harnack</code>.
            </p>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM & ALERT MODAL DIALOG */}
      {dialogConfig && dialogConfig.isOpen && (
        <div id="custom-dialog-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in text-white">
          <div className="relative w-full max-w-sm rounded-2xl bg-neutral-950 border-2 border-brand-gray/55 p-6 shadow-2xl space-y-5">
            <button
              onClick={() => setDialogConfig(null)}
              className="absolute top-4 right-4 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="text-center space-y-3">
              <div className={`rounded-2xl p-3.5 w-14 h-14 flex items-center justify-center mx-auto border ${
                dialogConfig.isDanger 
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-450" 
                  : "bg-brand-teal/10 border-brand-teal/30 text-brand-teal"
              }`}>
                {dialogConfig.isDanger ? (
                  <Trash2 className="h-6 w-6 text-rose-400" />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-brand-teal" />
                )}
              </div>
              <h3 className="font-extrabold text-base text-white font-display">
                {dialogConfig.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                {dialogConfig.message}
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              {dialogConfig.type === "confirm" && (
                <button
                  type="button"
                  onClick={() => {
                    if (dialogConfig.onCancel) dialogConfig.onCancel();
                    setDialogConfig(null);
                  }}
                  className="flex-1 rounded-xl bg-neutral-900 hover:bg-white/5 border border-neutral-800 text-slate-350 hover:text-white transition-all text-xs font-bold py-2.5 cursor-pointer"
                >
                  {dialogConfig.cancelText || "Abbrechen"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (dialogConfig.onConfirm) dialogConfig.onConfirm();
                  setDialogConfig(null);
                }}
                className={`flex-1 rounded-xl border-2 transition-all font-black text-xs py-2.5 cursor-pointer shadow-lg ${
                  dialogConfig.isDanger
                    ? "bg-rose-600 hover:bg-white text-white hover:text-rose-600 border-rose-600"
                    : "bg-brand-teal hover:bg-white text-white hover:text-brand-teal border-brand-teal"
                }`}
              >
                {dialogConfig.confirmText || "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
