import React, { useState } from "react";
import { FileText, Copy, CheckCircle2, AlertCircle, Clock, Calendar, Check, Send } from "lucide-react";
import { Task, TaskStatus, TaskPriority, ROOMS } from "../types";

interface ManagerReportProps {
  tasks: Task[];
  members: string[];
}

export default function ManagerReport({ tasks, members }: ManagerReportProps) {
  const [copied, setCopied] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [sentReport, setSentReport] = useState(false);

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const inProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
  const pending = tasks.filter((t) => t.status === TaskStatus.PENDING).length;

  const highPriorityPending = tasks.filter(
    (t) => t.priority === TaskPriority.HIGH && t.status !== TaskStatus.DONE
  ).length;

  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // Compile detailed room-by-room status
  const roomStatus = ROOMS.map((room) => {
    const roomTasks = tasks.filter((t) => t.room === room);
    const roomDone = roomTasks.filter((t) => t.status === TaskStatus.DONE).length;
    const roomTotal = roomTasks.length;

    let status = "Bereit (Keine Aufgaben)";
    let statusColor = "text-slate-400";
    if (roomTotal > 0) {
      if (roomDone === roomTotal) {
        status = "Bereit (Alle erledigt)";
        statusColor = "text-emerald-500 font-medium";
      } else if (roomTasks.some((t) => t.priority === TaskPriority.HIGH && t.status !== TaskStatus.DONE)) {
        status = "Achtung (Kritische Aufgaben)";
        statusColor = "text-rose-500 font-bold";
      } else {
        status = "In Arbeit";
        statusColor = "text-blue-500 font-medium";
      }
    }

    return {
      name: room,
      total: roomTotal,
      done: roomDone,
      statusStr: status,
      statusColor
    };
  });

  // Calculate team members workloads to mention overwhelmed members
  const overwhelmedMembers = members.filter((member) => {
    const activeTasks = tasks.filter(
      (t) => t.assignee === member && t.status !== TaskStatus.DONE
    ).length;
    return activeTasks > 3;
  });

  // Hot items (High priority pending tasks)
  const urgentTasks = tasks.filter(
    (t) => t.priority === TaskPriority.HIGH && t.status !== TaskStatus.DONE
  );

  const formatReportText = () => {
    const todayStr = new Date().toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    return `TÄGLICHER STATUSBERICHT - HARNACK-HAUS VERANSTALTUNGSMANAGEMENT
Datum: ${todayStr}
Systemzeit: 2026-06-05 07:13:00 UTC

==================================================
1. GESAMTFORTSCHRITT
==================================================
Erfüllungsgrad:   ${completionRate}%
Aufgaben Gesamt:  ${total}
- Erledigt:       ${done}
- In Arbeit:      ${inProgress}
- Ausstehend:     ${pending}
Offene Prioritätsaufgaben (Dringend): ${highPriorityPending}

==================================================
2. DETAILS NACH RAUMSTATUS
==================================================
${roomStatus
  .map(
    (rs) =>
      `• ${rs.name.padEnd(15)}: ${rs.statusStr.padEnd(28)} (${rs.done}/${rs.total} erledigt)`
  )
  .join("\n")}

==================================================
3. TEAM-AUSLASTUNG & ALERTE
==================================================
${
  overwhelmedMembers.length > 0
    ? `⚠️ AUSLASTUNG-ALERT: Folgende Personen sind aktuell überlastet (>3 offene Aufgaben):\n${overwhelmedMembers
        .map((m) => `  - ${m}`)
        .join("\n")}`
    : `✔️ KAPAZITÄT: Alles im grünen Bereich. Keine Überlastungen im Team verzeichnet.`
}

==================================================
4. DRINGENDE UND OFFENE AUFGABEN (PRIORITÄT HOCH)
==================================================
${
  urgentTasks.length > 0
    ? urgentTasks
        .map(
          (t) =>
            `- [${t.room}] ${t.title}\n  Soll-Frist: ${t.deadline} | Zuständig: ${
              t.assignee || "Nicht zugewiesen"
            }\n  Notizen: ${t.notes || "Keine"}`
        )
        .join("\n\n")
    : "Keine überfälligen oder hochpriorisierten kritischen Aufgaben offen."
}

==================================================
Bericht automatisch generiert durch Harnack-Haus Management-Cockpit.
`;
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(formatReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentDay = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
      {/* Metric Visualizations Column */}
      <div className="lg:col-span-5 space-y-6">
        {/* Progress Gauge */}
        <div id="manager-report-progress-gauge" className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4 shadow-2xl text-white">
          <h4 className="font-bold text-slate-200 text-sm tracking-tight flex items-center gap-2 font-display">
            <Calendar className="h-4 w-4 text-emerald-400" />
            Tagesfortschritt ({currentDay})
          </h4>

          <div className="flex flex-col items-center justify-center py-6">
            {/* SVG Donut Chart */}
            <div className="relative h-40 w-40">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Track */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-white/10 fill-none"
                  strokeWidth="8"
                />
                {/* Completion Track */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-emerald-450 fill-none transition-all duration-500"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * completionRate) / 100}
                  strokeLinecap="round"
                />
              </svg>
              {/* Inner Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-display">
                <span className="text-3xl font-extrabold tracking-tight">{completionRate}%</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-mono">Erfüllt</span>
              </div>
            </div>

            {/* Statistics breakdown row */}
            <div className="grid grid-cols-3 gap-4 w-full mt-6 text-center">
              <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                <span className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                  Erledigt
                </span>
                <span className="text-lg font-bold text-emerald-450">{done}</span>
              </div>
              <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                <span className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                  Aktiv
                </span>
                <span className="text-lg font-bold text-blue-450 font-mono">
                  {inProgress}
                </span>
              </div>
              <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                <span className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                  Offen
                </span>
                <span className="text-lg font-bold text-amber-450 font-mono">{pending}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Urgent Attention Alert Box */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 backdrop-blur-md p-5 space-y-3 text-white">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <h4 className="font-bold text-rose-300 text-sm tracking-tight font-display">
              Kritische Aufgaben ({urgentTasks.length})
            </h4>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {urgentTasks.length > 0 ? (
              urgentTasks.map((t) => (
                <div
                  id={`urgent-report-item-${t.id}`}
                  key={t.id}
                  className="bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs gap-1.5 flex flex-col"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-200">{t.title}</span>
                    <span className="shrink-0 bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase">
                      Hoch
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>🏢 Raum: {t.room}</span>
                    <span>👤 {t.assignee || "Keiner"}</span>
                    <span>⌛ Soll: {t.deadline}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-rose-300 italic font-mono">
                Hervorragend! Keine hochpriorisierten Aufgaben sind derzeit im Verzug.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Structured Text Area and Copy Feature Column */}
      <div className="lg:col-span-7 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex flex-col space-y-4 h-full shadow-2xl text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="space-y-0.5 animate-fade-in">
              <h3 className="font-extrabold text-slate-100 text-base flex items-center gap-1.5 font-display">
                <FileText className="h-5 w-5 text-emerald-400" />
                Automatierter Tagesbericht für Manager
              </h3>
              <p className="text-xs text-slate-405">
                Dieser Bericht formatiert alle Belegungszustände, Auslastungswerte und Fristen präsentationsbereit.
              </p>
            </div>

            <button
              id="copy-report-btn"
              onClick={handleCopyReport}
              className={`rounded-xl px-4 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer h-9 shadow-md ${
                copied
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/10 border font-bold"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Bericht kopiert!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Bericht kopieren
                </>
              )}
            </button>
          </div>

          {/* Clean Text Box containing formatted document */}
          <div className="flex-1 min-h-[350px] relative">
            <textarea
              id="formatted-manager-report-textarea"
              readOnly
              value={formatReportText()}
              className="w-full h-full min-h-[350px] rounded-xl bg-black/35 border border-white/10 p-4 font-mono text-xs text-slate-200 focus:outline-none focus:ring-0 leading-relaxed resize-y focus:border-white/20"
            />
          </div>

          {/* Quick-Send Mock Form */}
          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2 items-center justify-between">
            <div className="text-[11px] text-slate-400 font-mono">
              * Kopieren Sie den Text für E-Mails, MS Teams, Slack oder WhatsApp.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
