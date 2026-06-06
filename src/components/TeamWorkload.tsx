import React, { useState } from "react";
import { Users, AlertTriangle, CheckCircle, Clock, Trash2, UserPlus, FileText } from "lucide-react";
import { Task, TaskStatus, TaskPriority } from "../types";
import { parseMember } from "../sheetsHelper";

interface TeamWorkloadProps {
  tasks: Task[];
  members: string[];
  onAddMember: (name: string) => void;
  onRemoveMember: (name: string) => void;
  onSelectTask: (task: Task) => void;
  showConfirm?: (options: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }) => void;
}

export default function TeamWorkload({ 
  tasks, 
  members, 
  onAddMember, 
  onRemoveMember, 
  onSelectTask,
  showConfirm
}: TeamWorkloadProps) {
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMemberName.trim();
    const cleanEmail = newMemberEmail.trim();
    if (!cleanName && !cleanEmail) return;

    let finalMemberStr = "";
    if (cleanEmail) {
      finalMemberStr = cleanName ? `${cleanName} <${cleanEmail}>` : cleanEmail;
    } else {
      finalMemberStr = cleanName;
    }

    if (members.includes(finalMemberStr)) {
      setErrorMsg("Dieses Team-Mitglied existiert bereits.");
      return;
    }
    
    onAddMember(finalMemberStr);
    setNewMemberName("");
    setNewMemberEmail("");
    setErrorMsg("");
  };

  // Compile detailed workload stats for each member
  const workloads = members.map((member) => {
    const memberTasks = tasks.filter((t) => t.assignee === member);
    const total = memberTasks.length;
    const completed = memberTasks.filter((t) => t.status === TaskStatus.DONE).length;
    const inProgress = memberTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const pending = memberTasks.filter((t) => t.status === TaskStatus.PENDING).length;
    const activeCount = inProgress + pending;

    const highPriorityActive = memberTasks.filter(
      (t) => t.priority === TaskPriority.HIGH && t.status !== TaskStatus.DONE
    ).length;

    // Status logic: >3 active tasks is an overload, or if they have more than 1 high priority active task
    const isOverloaded = activeCount > 3 || highPriorityActive >= 2;

    return {
      name: member,
      total,
      completed,
      inProgress,
      pending,
      activeCount,
      highPriorityActive,
      isOverloaded,
      tasksList: memberTasks
    };
  });

  // Calculate unassigned tasks
  const unassignedTasks = tasks.filter((t) => !t.assignee);

  return (
    <div className="space-y-6 relative z-10">
      {/* Intro & Add Team Member Form */}
      <div className="bg-neutral-950 rounded-2xl border-2 border-brand-teal p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xl text-white">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
            <Users className="h-5 w-5 text-brand-teal" />
            Personalplanung & Kapazitätsübersicht
          </h3>
          <p className="text-xs text-brand-gray leading-relaxed font-bold">
            Überwachen Sie die Aufgabenverteilung Ihres Harnack-Haus Teams. Ein Team-Mitglied gilt als überlastet bei mehr als 3 aktiven Aufgaben oder 2 hochpriorisierten offenen Vorgängen.
          </p>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 max-w-lg w-full items-end">
          <div className="flex-1 relative space-y-1.5 w-full">
            <input
              id="new-member-name-input"
              type="text"
              placeholder="Name (z.B. Herr Gruber)"
              value={newMemberName}
              onChange={(e) => {
                setNewMemberName(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              className="w-full rounded-xl border-2 border-brand-gray/60 px-3 py-2 text-xs bg-black focus:outline-none focus:border-brand-teal placeholder-brand-gray text-white font-bold"
            />
            <input
              id="new-member-email-input"
              type="email"
              placeholder="E-Mail (z.B. gruber@example.com)"
              value={newMemberEmail}
              onChange={(e) => {
                setNewMemberEmail(e.target.value);
                if (errorMsg) setErrorMsg("");
              }}
              className="w-full rounded-xl border-2 border-brand-gray/60 px-3 py-2 text-xs bg-black focus:outline-none focus:border-brand-teal placeholder-brand-gray text-white font-bold animate-fade-in"
            />
            {errorMsg && (
              <span className="absolute -bottom-5 left-0 text-[10px] text-rose-500 font-bold">
                {errorMsg}
              </span>
            )}
          </div>
          <button
            id="add-member-submit-btn"
            type="submit"
            className="rounded-xl bg-brand-teal hover:bg-white text-white hover:text-brand-teal border-2 border-brand-teal hover:border-white font-black text-xs px-4 py-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer h-9 shadow-md shrink-0 select-none pb-2"
          >
            <UserPlus className="h-3.5 w-3.5" /> Hinzufügen
          </button>
        </form>
      </div>

      {/* Main Grid for Workloads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {workloads.map((wl) => {
          const ratioPercent = wl.total > 0 ? Math.round((wl.completed / wl.total) * 100) : 0;

          return (
            <div
              id={`team-member-card-${wl.name.replace(/\s+/g, "-")}`}
              key={wl.name}
              className={`rounded-2xl border-2 p-5 space-y-4 shadow-xl transition-all relative ${
                wl.isOverloaded 
                  ? "border-amber-500 bg-neutral-950 shadow-[0_4px_12px_rgba(245,158,11,0.15)] text-white" 
                  : "border-brand-teal bg-neutral-950 hover:border-white text-white shadow-md shadow-brand-teal/5"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  {(() => {
                    const { name, email } = parseMember(wl.name);
                    return (
                      <div className="flex flex-col">
                        <h4 className="font-bold text-white text-base font-display">{name || "Name fehlt"}</h4>
                        {email && (
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1" title={email}>
                            📬 {email}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-1.5 mt-1.5 font-mono text-xs">
                    <span className="text-slate-400">
                      {wl.total} Aufgaben gesamt
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300 font-medium">
                      {wl.activeCount} aktiv
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {wl.isOverloaded && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/20 animate-pulse font-mono">
                      <AlertTriangle className="h-3 w-3" /> Überlastet
                    </span>
                  )}
                  <button
                    id={`remove-member-${wl.name.replace(/\s+/g, "-")}`}
                    onClick={() => {
                      if (showConfirm) {
                        showConfirm({
                          title: "Mitglied entfernen?",
                          message: `Möchten Sie ${wl.name} wirklich aus dem System entfernen?`,
                          confirmText: "Entfernen",
                          cancelText: "Abbrechen",
                          isDanger: true,
                          onConfirm: () => onRemoveMember(wl.name)
                        });
                      } else if (window.confirm(`Möchten Sie ${wl.name} wirklich aus dem System entfernen?`)) {
                        onRemoveMember(wl.name);
                      }
                    }}
                    className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Entfernen aus Team"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress & Breakdown Bars */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-350">Erledigte Auslastung</span>
                  <span className="text-emerald-400">{ratioPercent}% ({wl.completed}/{wl.total})</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${ratioPercent}%` }} />
                  <div className="h-full bg-blue-450" style={{ width: `${wl.total > 0 ? (wl.inProgress / wl.total) * 100 : 0}%` }} />
                  <div className="h-full bg-amber-450" style={{ width: `${wl.total > 0 ? (wl.pending / wl.total) * 100 : 0}%` }} />
                </div>

                {/* Legend Indicators */}
                <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Erledigt ({wl.completed})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-455" /> In Arbeit ({wl.inProgress})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-455" /> Ausstehend ({wl.pending})
                  </span>
                </div>
              </div>

              {/* Assigned Tasks detail list */}
              <div className="space-y-1.5 border-t border-white/5 pt-3">
                <span className="block text-[11px] font-bold text-slate-350 uppercase tracking-wider mb-2 font-mono">
                  Zugewiesene Aufgaben
                </span>

                {wl.tasksList.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {wl.tasksList.map((t) => {
                      let statusBadge = "bg-amber-500/15 text-amber-302 border-amber-500/20";
                      if (t.status === TaskStatus.DONE) statusBadge = "bg-emerald-500/15 text-emerald-302 border-emerald-500/20";
                      else if (t.status === TaskStatus.IN_PROGRESS) statusBadge = "bg-blue-500/15 text-blue-302 border-blue-500/20";

                      return (
                        <div
                          id={`workload-task-row-${t.id}`}
                          key={t.id}
                          onClick={() => onSelectTask(t)}
                          className="flex items-center justify-between p-2 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/10 bg-white/5 cursor-pointer text-xs transition-colors text-white"
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-semibold text-slate-200 truncate">
                              {t.title}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              🏠 {t.room} • Frist: {t.deadline}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge} shrink-0`}>
                            {t.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-450 italic py-1 font-mono">
                    Aktuell keine zugewiesenen Aufgaben im System.
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Unassigned column list */}
        <div className="rounded-2xl border border-white/10 border-dashed bg-white/5 backdrop-blur-md p-5 space-y-4 shadow-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-100 text-base flex items-center gap-1.5 font-display">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Nicht zugewiesene Aufgaben
              </h4>
              <p className="text-xs text-slate-400">
                Diese Aufgaben müssen noch einem Teammitglied zugewiesen werden.
              </p>
            </div>
            <span className="bg-amber-500/15 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-500/20">
              {unassignedTasks.length} offen
            </span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {unassignedTasks.length > 0 ? (
              unassignedTasks.map((t) => (
                <div
                  id={`unassigned-task-${t.id}`}
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-colors shadow-2xl cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-slate-200 block">
                      {t.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {t.room} • Priorität: {t.priority === TaskPriority.HIGH ? "🔥 Hoch" : t.priority === TaskPriority.MEDIUM ? "Mittel" : "Niedrig"}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-450 hover:underline">
                    Zuweisen &rarr;
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 italic">
                Ausgezeichnet! Alle aktiven Aufgaben sind zugewiesen.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
