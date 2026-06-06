import React, { useState } from "react";
import { 
  FileSpreadsheet, 
  RefreshCw, 
  ExternalLink, 
  Settings, 
  Terminal, 
  CheckCircle, 
  HelpCircle, 
  Copy, 
  Info,
  Layers,
  Lock,
  ArrowRight
} from "lucide-react";
import { Task, TaskStatus, TaskPriority } from "../types";
import { getApiLogs, clearApiLogs } from "../sheetsHelper";

interface SheetsPanelProps {
  tasks: Task[];
  members: string[];
  spreadsheetId: string;
  accessToken: string;
  clientId: string;
  isConnected: boolean;
  onConnectReal: (clientId: string) => void;
  onDisconnect: () => void;
  onTriggerSync: () => Promise<void>;
  isSyncing: boolean;
  onConnectFirebase?: () => Promise<void>;
  authEmail?: string | null;
}

export default function SheetsPanel({
  tasks,
  members,
  spreadsheetId,
  accessToken,
  clientId,
  isConnected,
  onConnectReal,
  onDisconnect,
  onTriggerSync,
  isSyncing,
  onConnectFirebase,
  authEmail
}: SheetsPanelProps) {
  const [inputClientId, setInputClientId] = useState(clientId || "");
  const [authMethod, setAuthMethod] = useState<"firebase" | "manual">("firebase");
  const [activeTab, setActiveTab] = useState<"tutorial" | "logs">("tutorial");
  const [sheetPreviewTab, setSheetPreviewTab] = useState<"tasks" | "workloads" | "reports">("tasks");
  const [copiedUrl, setCopiedUrl] = useState(false);

  const logs = getApiLogs();
  const redirectUri = window.location.origin;

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputClientId.trim()) return;
    onConnectReal(inputClientId.trim());
  };

  // Pre-calculate Simulated Sheets data to show user what is currently written
  const mappedTasks = tasks.map((t, idx) => ({
    id: idx + 2,
    cols: [
      t.id,
      t.room,
      t.title,
      t.assignee || "Zuweisung offen",
      t.priority,
      t.deadline,
      t.notes || "-",
      t.status,
      new Date(t.createdAt).toLocaleDateString("de-DE")
    ]
  }));

  const workloadRows = members.map((member, idx) => {
    const userTasks = tasks.filter((t) => t.assignee === member);
    const pending = userTasks.filter((t) => t.status !== TaskStatus.DONE).length;
    const done = userTasks.filter((t) => t.status === TaskStatus.DONE).length;
    const limitStatus = pending > 3 ? "⚠️ Überlastet" : pending > 1 ? "Normal" : "Verfügbar";
    return {
      id: idx + 2,
      cols: [member, pending.toString(), done.toString(), limitStatus]
    };
  });

  const reportRow = {
    id: 2,
    cols: [
      new Date().toLocaleDateString("de-DE"),
      tasks.length.toString(),
      tasks.filter((t) => t.status === TaskStatus.PENDING).length.toString(),
      tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length.toString(),
      tasks.filter((t) => t.status === TaskStatus.DONE).length.toString(),
      tasks.length > 0 ? `${Math.round((tasks.filter((t) => t.status === TaskStatus.DONE).length / tasks.length) * 100)}%` : "0%"
    ]
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
      {/* Settings and Instruction Column */}
      <div className="lg:col-span-5 space-y-6">
        {/* Connection status card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-100 text-sm tracking-tight flex items-center gap-2 font-display">
              <Settings className="h-4.5 w-4.5 text-slate-400" />
              Schnittstellen-Status
            </h4>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              isConnected
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
                : "bg-amber-500/15 text-amber-300 border-amber-500/20"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              {isConnected ? "Google Sheets Aktiv" : "Lokaler Simulator"}
            </span>
          </div>

          <p className="text-xs text-slate-350 leading-relaxed">
            Standardmäßig läuft die App im <b className="text-slate-100">lokalen Simulator</b>. Ihre Aktionen werden vollständig simuliert und die ausgehenden REST-Endpunkte direkt in den Entwickler-Logs dargestellt.
          </p>

          {!isConnected ? (
            <div className="space-y-4 pt-2">
              {/* Optional Connection Mode Selector */}
              <div className="flex rounded-lg bg-black/20 p-1 border border-white/5">
                <button
                  type="button"
                  onClick={() => setAuthMethod("firebase")}
                  className={`flex-1 text-center py-1.5 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${
                    authMethod === "firebase"
                      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/25"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  Schnell-Verbindung
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod("manual")}
                  className={`flex-1 text-center py-1.5 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${
                    authMethod === "manual"
                      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/25"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  Eigene Client-ID
                </button>
              </div>

              {authMethod === "firebase" ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-350 leading-relaxed">
                    Verbinden Sie die App direkt mit Ihrem Google-Konto, um Berichte in Google Sheets zu schreiben und E-Mails zu versenden.
                  </p>
                  <button
                    id="connect-firebase-oauth-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onConnectFirebase) onConnectFirebase();
                    }}
                    className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs py-2.5 px-4 transition-all cursor-pointer shadow-md select-none"
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4 shrink-0">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    Mit Google verbinden (1-Klick)
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConnect} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">
                      Google Client-ID
                    </label>
                    <input
                      id="client-id-input"
                      type="text"
                      placeholder="Geben Sie Ihre Google Client-ID ein..."
                      value={inputClientId}
                      onChange={(e) => setInputClientId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 px-3 py-2 text-xs bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-500"
                    />
                  </div>
                  <button
                    id="connect-real-oauth-btn"
                    type="submit"
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                  >
                    Mit Google Account verknüpfen <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/20 p-3 text-xs space-y-1.5 text-slate-250">
                <span className="font-bold text-emerald-300 flex items-center gap-1 font-display">
                  <CheckCircle className="h-4 w-4 text-emerald-405" /> Erfolgreich verknüpft!
                </span>
                {authEmail && (
                  <p className="text-slate-300 text-[11px]">
                    Konto: <b className="text-white font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{authEmail}</b>
                  </p>
                )}
                <p className="font-mono text-[10px] break-all leading-relaxed text-slate-350">
                  Spreadsheet-ID: {spreadsheetId || "Wird beim ersten Sync erstellt..."}
                </p>
                {spreadsheetId && (
                  <a
                    id="open-google-sheet-link"
                    href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:underline pt-1"
                  >
                    Google Sheet öffnen <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                id="disconnect-oauth-btn"
                onClick={onDisconnect}
                className="w-full rounded-xl bg-white/5 hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/20 text-slate-300 font-bold text-xs py-2.5 transition-all cursor-pointer border border-white/10"
              >
                Verbindung trennen
              </button>
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 text-white shadow-2xl">
          <div className="flex border-b border-white/10 pb-2">
            <button
              id="tutorial-tab-btn"
              onClick={() => setActiveTab("tutorial")}
              className={`flex-1 text-center py-2 text-xs font-bold border-b-2 gap-1.5 flex justify-center items-center cursor-pointer transition-all ${
                activeTab === "tutorial"
                  ? "border-emerald-500 text-emerald-300 pointer-events-none"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <HelpCircle className="h-4 w-4" /> OAuth Anleitung
            </button>
            <button
              id="logs-tab-btn"
              onClick={() => {
                setActiveTab("logs");
              }}
              className={`flex-1 text-center py-2 text-xs font-bold border-b-2 gap-1.5 flex justify-center items-center cursor-pointer transition-all ${
                activeTab === "logs"
                  ? "border-emerald-500 text-emerald-300 pointer-events-none"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="h-4 w-4" /> API Traffic Logs ({logs.length})
            </button>
          </div>

          <div className="pt-4 min-h-[220px]">
            {activeTab === "tutorial" ? (
              <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
                <span className="font-bold text-slate-250 block font-display">So aktivieren Sie Ihr echtes Google Sheet:</span>
                <ol className="list-decimal pl-4 space-y-2 mt-1 text-slate-300">
                  <li>
                    Öffnen Sie die Google Cloud-Konsole:{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-300 hover:underline inline-flex items-center gap-0.5 font-bold"
                    >
                      console.cloud.google.com <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </li>
                  <li>
                    Erstellen Sie ein OAuth 2.0 Client-ID-Projekt (Webapplikation).
                  </li>
                  <li>
                    Fügen Sie als <b className="text-slate-205">Autorisierte Weiterleitungs-URI</b> diese URL hinzu:
                    <div className="flex items-center gap-1.5 mt-1">
                      <code className="bg-black/30 border border-white/10 px-2 py-0.5 rounded font-mono text-[10px] text-slate-200 select-all shrink truncate max-w-xs block">
                        {redirectUri}
                      </code>
                      <button
                        id="copy-redirect-uri-btn"
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(redirectUri);
                          setCopiedUrl(true);
                          setTimeout(() => setCopiedUrl(false), 2000);
                        }}
                        className="text-emerald-400 hover:text-emerald-350 hover:bg-white/5 p-1 rounded transition-colors"
                        title="URL kopieren"
                      >
                        {copiedUrl ? "Kopiert!" : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </li>
                  <li>
                    Kopieren Sie die Client-ID, fügen Sie diese oben ein und klicken Sie auf Verbinden.
                  </li>
                </ol>
                <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20 mt-2 text-slate-300 text-[10px] space-y-1.5 pb-3">
                  <div className="flex items-start gap-1 pb-1">
                    <Info className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                    <p className="font-semibold text-blue-300">Wichtiger Hinweis für E-Mail-Dienste & Google APIs:</p>
                  </div>
                  <p className="pl-4.5 leading-relaxed">
                    1. Bei der Anmeldung fordert Google Berechtigungen zur Bearbeitung von <b>Google Tabellen</b>, Erstellung von Dateien im <b>Drive</b> sowie Berechtigungen zum <b>Versenden von E-Mails (Gmail)</b> an. Bitte haken Sie <b>alle drei Boxen</b> an, damit Benachrichtigungs-Mails fehlerfrei versendet werden können!
                  </p>
                  <p className="pl-4.5 leading-relaxed">
                    2. Stellen Sie in Ihrer Google Cloud-Konsole sicher, dass neben der <b>Google Sheets API</b> auch die <b>Gmail API</b> aktiviert ist! Ohne die Freischaltung der Gmail API im Cloud-Projekt meldet Google einen Verbindungsfehler beim E-Mail-Versand.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-white/5 text-[10px] text-slate-450 font-mono">
                  <span>Ausgehende API Anfragen</span>
                  <button
                    id="clear-logs-btn"
                    onClick={() => {
                      clearApiLogs();
                    }}
                    className="hover:text-rose-450 font-bold uppercase transition-colors cursor-pointer"
                  >
                    Verlauf löschen
                  </button>
                </div>

                {logs.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto space-y-2 font-mono text-[10.5px] pr-1">
                    {logs.map((log, idx) => (
                      <div
                        id={`api-log-item-${idx}`}
                        key={idx}
                        className="p-2 rounded-lg bg-black/40 text-slate-300 border border-white/5 space-y-1 overflow-x-auto"
                      >
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>{log.timestamp}</span>
                          <span className={
                            log.status === "success" ? "text-emerald-400 font-bold" :
                            log.status === "error" ? "text-rose-400 font-bold" : "text-amber-400 animate-pulse"
                          }>
                            ● {log.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-blue-300 bg-blue-900/40 px-1 py-0.2 rounded text-[8px] font-mono border border-blue-500/10">
                            {log.method}
                          </span>
                          <span className="text-[10px] text-slate-205 select-all truncate font-mono">{log.url}</span>
                        </div>
                        {log.payload && (
                          <details className="mt-1">
                            <summary className="text-[8.5px] cursor-pointer text-slate-450 hover:text-slate-300 font-mono">
                              Payload verbergen/anzeigen
                            </summary>
                            <pre className="mt-1 bg-black/60 p-1.5 rounded text-[9px] text-slate-450 select-all font-mono">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                        {log.response && (
                          <details className="mt-0.5">
                            <summary className="text-[8.5px] cursor-pointer text-slate-450 hover:text-slate-300 font-mono">
                              Server Antwort
                            </summary>
                            <pre className="mt-1 bg-black/60 p-1.5 rounded text-[9px] text-emerald-400/90 select-all font-mono">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                    <Terminal className="h-8 w-8 mb-2 text-slate-500" />
                    <p className="font-mono text-[11px] text-slate-300">Kein API Traffic protokolliert.</p>
                    <p className="text-[10px] mt-1 text-slate-450">Senden Sie Daten ab, um Anfragen zu erfassen.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Spreadsheet Simulation Preview Column */}
      <div className="lg:col-span-7 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex flex-col h-full space-y-4 shadow-2xl text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="space-y-0.5">
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-1.5 font-display">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                Google Tabellen Simulation (Live Voransicht)
              </h3>
              <p className="text-xs text-slate-355">
                Echtzeit-Berechnung des Tabelleninhalts, der bei Klick in das Dokument geschrieben wird.
              </p>
            </div>

            <button
              id="sync-spreadsheet-now-btn"
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-white/5 disabled:text-slate-450 text-white font-bold text-xs px-4 py-2 flex items-center justify-center gap-1.5 cursor-pointer h-9 shadow-md shadow-emerald-600/10 transition-all font-mono"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Verarbeite..." : "Tabellen aktualisieren"}
            </button>
          </div>

          {/* Excel/Sheet Subtabs Selection */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
            {[
              { id: "tasks", label: "📄 Aufgaben", ref: "Tab 1: Aufgaben" },
              { id: "workloads", label: "👥 Team-Auslastung", ref: "Tab 2: Auslastung" },
              { id: "reports", label: "📊 Tägliche Berichte", ref: "Tab 3: Berichte" }
            ].map((subtab) => (
              <button
                id={`sheet-subtab-${subtab.id}`}
                key={subtab.id}
                onClick={() => setSheetPreviewTab(subtab.id as any)}
                className={`flex-1 py-1 px-2 text-center text-xs font-bold rounded-md cursor-pointer transition-all ${
                  sheetPreviewTab === subtab.id
                    ? "bg-white/15 text-white shadow-sm border border-white/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {subtab.label}
              </button>
            ))}
          </div>

          {/* Interactive Google Sheet Grid */}
          <div className="flex-1 overflow-auto border border-white/10 rounded-xl max-h-[350px] bg-black/20">
            <table className="w-full text-[11px] font-mono border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-slate-300 sticky top-0 uppercase text-[10px]">
                  <th className="px-2 py-1.5 border-r border-white/10 font-bold bg-white/10 text-center w-8 select-none">
                    #
                  </th>
                  {sheetPreviewTab === "tasks" && (
                    <>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">A: ID</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">B: Raum</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">C: Aufgabe</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">D: Zuständig</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">E: Priorität</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">F: Frist</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">G: Notizen</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">H: Status</th>
                      <th className="px-3 py-1.5 text-left">I: Erstellt Am</th>
                    </>
                  )}
                  {sheetPreviewTab === "workloads" && (
                    <>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">A: Team-Mitglied</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">B: Offene Aufgaben</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">C: Erledigte Aufgaben</th>
                      <th className="px-3 py-1.5 text-left">D: Auslastungsstatus</th>
                    </>
                  )}
                  {sheetPreviewTab === "reports" && (
                    <>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">A: Bericht-Datum</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">B: Aufgaben Gesamt</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">C: Ausstehend</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">D: In Bearbeitung</th>
                      <th className="px-3 py-1.5 border-r border-white/10 text-left">E: Erledigt</th>
                      <th className="px-3 py-1.5 text-left">F: Erfüllungsquote</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* Headers Row representing Row 1 in Excel */}
                <tr className="bg-white/5 border-b border-white/10 font-bold text-slate-350 select-all text-[10px]">
                  <td className="bg-white/10 text-slate-400 py-1 border-r border-white/10 text-center select-none font-bold">
                    1
                  </td>
                  {sheetPreviewTab === "tasks" && (
                    ["ID", "Raum", "Aufgabe", "Zuständige Person", "Priorität", "Frist (Soll-Datum)", "Notizen", "Status", "Erstellt Am"].map((h, i) => (
                      <td key={i} className="px-3 py-1 border-r border-white/5 truncate max-w-xs">{h}</td>
                    ))
                  )}
                  {sheetPreviewTab === "workloads" && (
                    ["Team-Mitglied", "Offene Aufgaben", "Erledigte Aufgaben", "Auslastung"].map((h, i) => (
                      <td key={i} className="px-3 py-1 border-r border-white/5 truncate max-w-xs">{h}</td>
                    ))
                  )}
                  {sheetPreviewTab === "reports" && (
                    ["Datum", "Gesamtanzahl Aufgaben", "Ausstehend", "In Bearbeitung", "Erledigt", "Fortschrittskennzahl"].map((h, i) => (
                      <td key={i} className="px-3 py-1 border-r border-white/5 truncate max-w-xs">{h}</td>
                    ))
                  )}
                </tr>

                {/* Data ROWS */}
                {sheetPreviewTab === "tasks" && (
                  mappedTasks.length > 0 ? (
                    mappedTasks.map((row) => (
                      <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 text-slate-200">
                        <td className="bg-white/5 text-slate-400 py-1 border-r border-white/10 text-center select-none font-medium">
                          {row.id}
                        </td>
                        {row.cols.map((cell, cidx) => (
                          <td key={cidx} className="px-3 py-1 border-r border-white/5 max-w-xs truncate" title={cell}>
                            <span className={
                              cell === "Ausstehend" ? "text-amber-300 font-bold ml-0.5" :
                              cell === "In Bearbeitung" ? "text-blue-300 font-bold ml-0.5" :
                              cell === "Erledigt" ? "text-emerald-305 font-bold ml-0.5" :
                              cell === "Hoch" ? "text-rose-400 font-bold" : ""
                            }>
                              {cell}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-slate-450 italic font-mono">
                        Keine Aufgaben vorhanden (Tabelle leer).
                      </td>
                    </tr>
                  )
                )}

                {sheetPreviewTab === "workloads" && (
                  workloadRows.length > 0 ? (
                    workloadRows.map((row) => (
                      <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 text-slate-200">
                        <td className="bg-white/5 text-slate-400 py-1 border-r border-white/10 text-center select-none font-medium">
                          {row.id}
                        </td>
                        {row.cols.map((cell, cidx) => (
                          <td key={cidx} className="px-3 py-1 border-r border-white/5 max-w-xs truncate" title={cell}>
                            <span className={cell.startsWith("⚠️") ? "text-amber-305 font-bold" : ""}>
                              {cell}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-450 italic font-mono">
                        Keine Teammitglieder vorhanden.
                      </td>
                    </tr>
                  )
                )}

                {sheetPreviewTab === "reports" && (
                  <tr className="border-b border-white/5 hover:bg-white/5 text-slate-200">
                    <td className="bg-white/5 text-slate-400 py-1 border-r border-white/10 text-center select-none font-medium">
                      2
                    </td>
                    {reportRow.cols.map((cell, cidx) => (
                      <td key={cidx} className="px-3 py-1 border-r border-white/5 max-w-xs truncate" title={cell}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Inline notification info */}
          <div className="flex items-start gap-1 pb-1 font-sans text-[11px] text-slate-400">
            <Info className="h-3.5 w-3.5 text-slate-450 mt-0.5 shrink-0" />
            <p>
              Tipp: Jede Änderung an Aufgaben, Fristen oder Zuweisungen aktualisiert diese Tabellen-Struktur sofort. Klicken Sie auf <b className="text-slate-200">„Tabellen aktualisieren“</b> oben, um die simulierten Logs zu betrachten oder (falls verknüpft) Ihr echtes Google Sheet im Drive zu überschreiben.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
