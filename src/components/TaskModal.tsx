import React, { useState } from "react";
import { Plus, X, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Task, TaskPriority, TaskStatus, ROOMS } from "../types";
import { parseMember } from "../sheetsHelper";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, "id" | "createdAt"> & { id?: string }) => void;
  initialTask?: Task | null;
  defaultRoom?: string;
  existingMembers: string[];
}

export default function TaskModal({
  isOpen,
  onClose,
  onSave,
  initialTask,
  defaultRoom = "Goethe-Saal",
  existingMembers
}: TaskModalProps) {
  const [title, setTitle] = useState(initialTask?.title || "");
  const [room, setRoom] = useState(initialTask?.room || defaultRoom);
  const [assignee, setAssignee] = useState(initialTask?.assignee || "");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority || TaskPriority.MEDIUM);
  const [deadline, setDeadline] = useState(initialTask?.deadline || new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState(initialTask?.notes || "");
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status || TaskStatus.PENDING);
  const [isAddingNewAssignee, setIsAddingNewAssignee] = useState(false);

  React.useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setRoom(initialTask.room);
      setAssignee(initialTask.assignee);
      setPriority(initialTask.priority);
      setDeadline(initialTask.deadline);
      setNotes(initialTask.notes);
      setStatus(initialTask.status);
    } else {
      setTitle("");
      setRoom(defaultRoom);
      setAssignee("");
      setPriority(TaskPriority.MEDIUM);
      setDeadline(new Date().toISOString().split("T")[0]);
      setNotes("");
      setStatus(TaskStatus.PENDING);
    }
  }, [initialTask, defaultRoom, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalAssignee = assignee;
    if (isAddingNewAssignee) {
      const email = newEmail.trim();
      const name = newName.trim();
      if (email) {
        finalAssignee = name ? `${name} <${email}>` : email;
      } else if (name) {
        finalAssignee = name;
      }
    }

    onSave({
      ...(initialTask?.id ? { id: initialTask.id } : {}),
      title: title.trim(),
      room,
      assignee: finalAssignee,
      priority,
      deadline,
      notes: notes.trim(),
      status
    });

    setNewName("");
    setNewEmail("");
    setIsAddingNewAssignee(false);
    onClose();
  };

  return (
    <div id="add-edit-task-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs transition-opacity overflow-y-auto">
      <div 
        id="add-edit-task-modal-container"
        className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-100 shadow-2xl overflow-hidden transition-all text-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">
            {initialTask ? "Aufgabe bearbeiten" : "Neue Aufgabe hinzufügen"}
          </h3>
          <button
            id="close-modal-btn"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Room Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Harnack-Haus Raum
            </label>
            <select
              id="task-room-select"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {ROOMS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Task Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Aufgabe/Projektbezeichnung
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              placeholder="z.B. Buffet aufbauen, Tontechnik prüfen..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400"
            />
          </div>

          {/* Assignee / Responsible Person */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Verantwortliche Person (Zuständigkeit)
              </label>
              <button
                id="toggle-new-assignee-btn"
                type="button"
                onClick={() => setIsAddingNewAssignee(!isAddingNewAssignee)}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {isAddingNewAssignee ? "Aus Liste wählen" : "+ Neue Person"}
              </button>
            </div>

            {isAddingNewAssignee ? (
              <div className="space-y-3 p-3 bg-slate-50 border border-slate-205 rounded-xl">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Name der Person
                  </label>
                  <input
                    id="task-new-assignee-name-input"
                    type="text"
                    required
                    placeholder="z.B. Herr Gruber"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    E-Mail-Adresse (für automatische Benachrichtigung)
                  </label>
                  <input
                    id="task-new-assignee-email-input"
                    type="email"
                    required
                    placeholder="z.B. gruber@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    📧 Die Person erhält beim Speichern eine direkte Benachrichtigung an diese E-Mail.
                  </p>
                </div>
              </div>
            ) : (
              <select
                id="task-assignee-select"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">-- Nicht zugewiesen --</option>
                {existingMembers.map((member) => {
                  const { name, email } = parseMember(member);
                  return (
                    <option key={member} value={member}>
                      {name} {email ? `(${email})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Row layout for Priority & Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Priorität
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value={TaskPriority.HIGH}>🔥 Hoch</option>
                <option value={TaskPriority.MEDIUM}>🟡 Mittel</option>
                <option value={TaskPriority.LOW}>🟢 Niedrig</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Frist (Soll-Datum)
              </label>
              <input
                id="task-deadline-input"
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Notizen / Kommentare
            </label>
            <textarea
              id="task-notes-textarea"
              rows={3}
              placeholder="Präzise Anweisungen für das Team, technische Besonderheiten..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-slate-400"
            ></textarea>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Status der Umsetzung
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: TaskStatus.PENDING, label: "Ausstehend", icon: Clock, color: "text-amber-500 bg-amber-50 border-amber-200 hover:bg-amber-100/50" },
                { value: TaskStatus.IN_PROGRESS, label: "In Arbeit", icon: AlertTriangle, color: "text-blue-500 bg-blue-50 border-blue-200 hover:bg-blue-100/50" },
                { value: TaskStatus.DONE, label: "Erledigt", icon: CheckCircle, color: "text-emerald-500 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50" }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = status === item.value;
                return (
                  <button
                    id={`status-btn-${item.value}`}
                    key={item.value}
                    type="button"
                    onClick={() => setStatus(item.value)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      isSelected
                        ? "ring-2 ring-emerald-500 bg-emerald-50/70 text-emerald-900 border-emerald-400"
                        : "bg-white border-slate-100 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <Icon className="h-4 w-4 mb-1" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              id="cancel-modal-btn"
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              Abbrechen
            </button>
            <button
              id="submit-task-btn"
              type="submit"
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 active:bg-emerald-800 transition-all shadow-md shadow-emerald-600/10"
            >
              {initialTask ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
