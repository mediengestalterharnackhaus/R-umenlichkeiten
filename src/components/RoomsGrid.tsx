import React from "react";
import { LayoutGrid, CheckCircle, Clock, AlertCircle, Sparkles } from "lucide-react";
import { Task, TaskStatus, TaskPriority } from "../types";

interface RoomsGridProps {
  rooms: string[];
  tasks: Task[];
  onSelectRoom: (room: string) => void;
  onAddTaskForRoom: (room: string) => void;
}

export default function RoomsGrid({ rooms, tasks, onSelectRoom, onAddTaskForRoom }: RoomsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
      {rooms.map((room) => {
        // Filter tasks for this room
        const roomTasks = tasks.filter((t) => t.room === room);
        const total = roomTasks.length;
        const pending = roomTasks.filter((t) => t.status === TaskStatus.PENDING).length;
        const inProgress = roomTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
        const done = roomTasks.filter((t) => t.status === TaskStatus.DONE).length;

        const hasHighPriority = roomTasks.some(
          (t) => t.priority === TaskPriority.HIGH && t.status !== TaskStatus.DONE
        );

        const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

        // Visual theme based on state for high contrast and brand colors (#006c66, #000000, #888888, #ffffff)
        let cardBg = "bg-black border-2 border-brand-teal hover:border-white hover:bg-brand-teal/15 text-white shadow-[0_4px_12px_rgba(0,108,102,0.15)]";
        let statusBadge = (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-brand-teal px-2 py-0.5 rounded-md border border-white/20">
            Keine Aufgaben
          </span>
        );

        if (total > 0) {
          if (done === total) {
            cardBg = "bg-black hover:bg-emerald-950/20 border-2 border-emerald-500 hover:border-emerald-400 text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]";
            statusBadge = (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-md border border-emerald-500">
                ✔️ Bereit
              </span>
            );
          } else if (hasHighPriority) {
            cardBg = "bg-black hover:bg-rose-950/20 border-2 border-rose-500 hover:border-rose-450 text-white shadow-[0_4px_15px_rgba(239,68,68,0.25)]";
            statusBadge = (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-300 bg-rose-955 px-2.5 py-0.5 rounded-md border border-rose-500 animate-pulse">
                ⚡ Prioritär
              </span>
            );
          } else {
            cardBg = "bg-black hover:bg-cyan-950/20 border-2 border-cyan-500 hover:border-cyan-400 text-white shadow-[0_4px_12px_rgba(6,182,212,0.2)];";
            statusBadge = (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-cyan-300 bg-cyan-955 px-2.5 py-0.5 rounded-md border border-cyan-500">
                ⚙️ In Arbeit
              </span>
            );
          }
        }

        return (
          <div
            id={`room-card-${room.replace(/\s+/g, "-")}`}
            key={room}
            className={`group relative flex flex-col justify-between rounded-2xl p-5 transition-all duration-300 hover:shadow-[0_12px_24px_rgba(0,108,102,0.4)] hover:-translate-y-1 cursor-pointer overflow-hidden ${cardBg}`}
            onClick={() => onSelectRoom(room)}
          >
            {/* Background design accents */}
            <div className="absolute right-0 top-0 -mr-6 -mt-6 h-20 w-20 rounded-full bg-white/5 group-hover:bg-brand-teal/20 transition-all duration-300" />

            <div>
              {/* Room Header */}
              <div className="flex items-start justify-between relative z-10 mb-3">
                <div className="flex flex-col">
                  <h4 className="font-extrabold text-white group-hover:text-cyan-300 transition-colors text-lg tracking-tight font-display">
                    {room}
                  </h4>
                  <p className="text-[10px] text-brand-gray font-extrabold font-mono mt-0.5 uppercase tracking-wider">
                    Harnack-Haus Raum
                  </p>
                </div>
                {statusBadge}
              </div>

              {/* Progress bar and percentages */}
              {total > 0 ? (
                <div className="mt-4 space-y-1.5 relative z-10">
                  <div className="flex justify-between text-xs text-white font-extrabold font-mono">
                    <span>Fortschritt</span>
                    <span className="font-extrabold underline decoration-brand-teal decoration-2">{progressPercent}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden border border-white/20">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progressPercent === 100
                          ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]"
                          : hasHighPriority
                          ? "bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]"
                          : "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 py-1 text-xs text-brand-gray italic font-medium">
                  Keine anstehenden Aufgaben für heute zugewiesen.
                </div>
              )}
            </div>

            {/* Bottom count section & Quick Add */}
            <div className="mt-6 flex items-center justify-between border-t border-brand-gray/30 pt-3 relative z-10">
              <div className="flex items-center space-x-3 text-xs text-white font-extrabold font-mono">
                {total > 0 ? (
                  <>
                    <span className="flex items-center gap-1 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Erledigt">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> {done}
                    </span>
                    <span className="flex items-center gap-1 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-500/20" title="In Arbeit">
                      <AlertCircle className="h-3.5 w-3.5 text-cyan-400" /> {inProgress}
                    </span>
                    <span className="flex items-center gap-1 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/20" title="Ausstehend">
                      <Clock className="h-3.5 w-3.5 text-amber-400" /> {pending}
                    </span>
                  </>
                ) : (
                  <span className="text-brand-gray/80 italic text-[11px] font-bold">Planung leer</span>
                )}
              </div>

              <button
                id={`quick-add-${room.replace(/\s+/g, "-")}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddTaskForRoom(room);
                }}
                className="inline-flex h-8 items-center justify-center gap-1 bg-brand-teal hover:bg-white text-white hover:text-brand-teal border-2 border-brand-teal hover:border-white transition-all rounded-lg px-3 text-xs font-black cursor-pointer shadow-md"
              >
                + Aufgabe
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
