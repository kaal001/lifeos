"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useConfirmDialog } from "@/app/confirm-dialog-provider";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  Droplets,
  Dumbbell,
  Hash,
  Plus,
  Pencil,
  Star,
  Target,
  Trash2,
} from "lucide-react";

type TrackerType = "boolean" | "count" | "duration" | "numeric" | "rating";

type TrackerLog = {
  date: string;
  value: number;
};

type Tracker = {
  id: string;
  name: string;
  type: TrackerType;
  category: string;
  unit: string;
  target: number;
  logs: TrackerLog[];
};

type TrackerDraft = {
  name: string;
  type: TrackerType;
  category: string;
  unit: string;
  target: string;
};



const initialDraft: TrackerDraft = {
  name: "",
  type: "count",
  category: "Health",
  unit: "glasses",
  target: "8",
};



const typeOptions: { value: TrackerType; label: string }[] = [
  { value: "boolean", label: "Yes / No" },
  { value: "count", label: "Count" },
  { value: "duration", label: "Duration" },
  { value: "numeric", label: "Number" },
  { value: "rating", label: "Rating (1–5)" },
];

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTypeIcon(type: TrackerType) {
  switch (type) {
    case "boolean":
      return <CircleCheck size={20} />;
    case "count":
      return <Hash size={20} />;
    case "duration":
      return <Clock3 size={20} />;
    case "numeric":
      return <Activity size={20} />;
    case "rating":
      return <Star size={20} />;
  }
}

function getTodayValue(tracker: Tracker, today: string) {
  return tracker.logs.find((log) => log.date === today)?.value;
}

function formatValue(value: number, tracker: Tracker) {
  if (tracker.type === "boolean") {
    return value > 0 ? "Completed" : "Not completed";
  }

  if (tracker.type === "rating") {
    return `${value}/5`;
  }

  return tracker.unit ? `${value} ${tracker.unit}` : String(value);
}

function getRecentDays() {
  const now = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));

    return {
      key: getDateKey(date),
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
    };
  });
}

export default function TrackerWorkspace() {
  const { requestConfirmation } = useConfirmDialog();
  const [userId, setUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<TrackerDraft>(initialDraft);
  const [editingTracker, setEditingTracker] = useState<string | null>(null);
  const [editingTrackerId, setEditingTrackerId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TrackerDraft>(initialDraft);
  const [savingTrackerEdit, setSavingTrackerEdit] = useState(false);
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});
  const [entryDates, setEntryDates] = useState<Record<string, string>>({});
  const [today, setToday] = useState("");


useEffect(() => {
  let cancelled = false;

  async function loadTrackers() {
    setToday(getDateKey(new Date()));

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("Your session was not found. Please sign in again.");
      }

      if (!cancelled) {
        setUserId(user.id);
      }

      const { data: trackerRows, error: trackerError } = await supabase
        .from("trackers")
        .select("id, name, tracker_type, category, unit, target")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (trackerError) throw trackerError;

      const { data: entryRows, error: entryError } = await supabase
        .from("tracker_entries")
        .select("tracker_id, entry_date, value")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: true });

      if (entryError) throw entryError;

      const entries = entryRows ?? [];

      const cloudTrackers: Tracker[] = (trackerRows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.tracker_type as TrackerType,
        category: row.category,
        unit: row.unit ?? "",
        target: Number(row.target),
        logs: entries
          .filter((entry) => entry.tracker_id === row.id)
          .map((entry) => ({
            date: entry.entry_date,
            value: Number(entry.value),
          })),
      }));

      if (!cancelled) {
        setTrackers(cloudTrackers);
        setLoadError(null);
      }
    } catch (error) {
      console.error("Could not load cloud trackers:", error);

      if (!cancelled) {
        setTrackers([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load your trackers. Please try again.",
        );
      }
    } finally {
      if (!cancelled) {
        setLoaded(true);
      }
    }
  }

  void loadTrackers();

  return () => {
    cancelled = true;
  };
}, []);




  const completedToday = trackers.filter(
    (tracker) => (getTodayValue(tracker, today) ?? 0) > 0,
  ).length;


async function addTracker(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const name = draft.name.trim();
  const category = draft.category.trim();

  if (!name || !category) return;

  if (!userId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  const target =
    draft.type === "rating"
      ? 5
      : draft.type === "boolean"
        ? 1
        : Number(draft.target);

  if (!Number.isFinite(target) || target <= 0) {
    window.alert("Please enter a valid target greater than zero.");
    return;
  }

  const trackerId = crypto.randomUUID();
  const unit =
    draft.type === "boolean" ? "" : draft.unit.trim().slice(0, 20);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("trackers")
      .insert({
        id: trackerId,
        user_id: userId,
        name: name.slice(0, 80),
        tracker_type: draft.type,
        category: category.slice(0, 40),
        unit,
        target,
      })
      .select("id, name, tracker_type, category, unit, target")
      .single();

    if (error) throw error;

    const tracker: Tracker = {
      id: data.id,
      name: data.name,
      type: data.tracker_type as TrackerType,
      category: data.category,
      unit: data.unit ?? "",
      target: Number(data.target),
      logs: [],
    };

    setTrackers((current) => [tracker, ...current]);
    setDraft(initialDraft);
    setShowForm(false);
    setLoadError(null);
  } catch (error) {
    console.error("Could not create cloud tracker:", error);

    window.alert(
      `Could not create this tracker. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  }
}

function startTrackerEdit(tracker: Tracker) {
  setEditingTrackerId(tracker.id);
  setEditDraft({
    name: tracker.name,
    type: tracker.type,
    category: tracker.category,
    unit: tracker.unit,
    target: String(tracker.target),
  });
  setShowForm(false);
  setEditingTracker(null);
}

function cancelTrackerEdit() {
  if (savingTrackerEdit) return;

  setEditingTrackerId(null);
  setEditDraft(initialDraft);
}

async function saveTrackerEdit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const trackerId = editingTrackerId;
  const name = editDraft.name.trim();
  const category = editDraft.category.trim();

  if (!trackerId || !name || !category || savingTrackerEdit) return;

  if (!userId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  const existingTracker = trackers.find(
    (tracker) => tracker.id === trackerId,
  );

  if (!existingTracker) return;

  const target =
    existingTracker.type === "rating"
      ? 5
      : existingTracker.type === "boolean"
        ? 1
        : Number(editDraft.target);

  if (!Number.isFinite(target) || target <= 0) {
    window.alert("Please enter a valid target greater than zero.");
    return;
  }

  const unit =
    existingTracker.type === "boolean"
      ? ""
      : editDraft.unit.trim().slice(0, 20);

  setSavingTrackerEdit(true);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("trackers")
      .update({
        name: name.slice(0, 80),
        category: category.slice(0, 40),
        unit,
        target,
      })
      .eq("user_id", userId)
      .eq("id", trackerId)
      .select("id, name, tracker_type, category, unit, target")
      .single();

    if (error) throw error;

    setTrackers((current) =>
      current.map((tracker) =>
        tracker.id === trackerId
          ? {
              ...tracker,
              name: data.name,
              category: data.category,
              unit: data.unit ?? "",
              target: Number(data.target),
            }
          : tracker,
      ),
    );

    setEditingTrackerId(null);
    setEditDraft(initialDraft);
    setLoadError(null);
  } catch (error) {
    console.error("Could not update tracker:", error);

    window.alert(
      `Could not update this tracker. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  } finally {
    setSavingTrackerEdit(false);
  }
}
function startCheckInEdit(
  trackerId: string,
  currentValue: number | undefined,
) {
  setEntryDates((current) => ({
    ...current,
    [trackerId]: today || getDateKey(new Date()),
  }));

  setEntryValues((current) => ({
    ...current,
    [trackerId]: currentValue === undefined ? "" : String(currentValue),
  }));

  setEditingTracker(trackerId);
}
async function saveCheckIn(trackerId: string,value: number,selectedDate?: string,) {
  if (!Number.isFinite(value)) return;

  if (!userId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  const tracker = trackers.find((item) => item.id === trackerId);
  if (!tracker) return;

  const safeValue =
    tracker.type === "boolean"
      ? value > 0
        ? 1
        : 0
      : tracker.type === "rating"
        ? Math.min(5, Math.max(1, Math.round(value)))
        : Math.max(0, value);

  const entryDate = selectedDate || today || getDateKey(new Date());

  if (entryDate > getDateKey(new Date())) {
    window.alert("Future-dated check-ins are not supported.");
    return;
  }

  try {
    const supabase = createClient();

    const { error } = await supabase.from("tracker_entries").upsert(
      {
        user_id: userId,
        tracker_id: trackerId,
        entry_date: entryDate,
        value: safeValue,
      },
      {
        onConflict: "user_id,tracker_id,entry_date",
      },
    );

    if (error) throw error;

    setTrackers((current) =>
      current.map((item) => {
        if (item.id !== trackerId) return item;

        const existingLogs = item.logs.filter(
          (log) => log.date !== entryDate,
        );

        return {
          ...item,
          logs: [...existingLogs, { date: entryDate, value: safeValue }].sort(
            (a, b) => a.date.localeCompare(b.date),
          ),
        };
      }),
    );

    setEditingTracker(null);
    setLoadError(null);
  } catch (error) {
    console.error("Could not save tracker check-in:", error);

    window.alert(
      `Could not save this check-in. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  }
}



async function deleteTracker(trackerId: string) {
  if (!userId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  const tracker = trackers.find((item) => item.id === trackerId);
  if (!tracker) return;

  const confirmed = await requestConfirmation({
    title: "Delete this tracker?",
    message: `Are you sure you want to delete "${tracker.name}"? This action cannot be undone.`,
    confirmLabel: "Delete tracker",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("trackers")
      .delete()
      .eq("user_id", userId)
      .eq("id", trackerId);

    if (error) throw error;

    setTrackers((current) =>
      current.filter((item) => item.id !== trackerId),
    );

    setEditingTracker(null);
    setLoadError(null);
  } catch (error) {
    console.error("Could not delete cloud tracker:", error);

    window.alert(
      `Could not delete this tracker. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  }
}


  function updateDraft<K extends keyof TrackerDraft>(
    key: K,
    value: TrackerDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  if (!loaded) {
    return (
      <section className="panel tracker-loading">
        Loading your trackers...
      </section>
    );
  }
  if (loadError) {
  return (
    <section className="panel tracker-loading">
      <p>Could not load your cloud trackers.</p>
      <p>{loadError}</p>
      <button
        className="text-button"
        type="button"
        onClick={() => window.location.reload()}
      >
        Try again
      </button>
    </section>
  );
  }
  const recentDays = getRecentDays();

  return (
    <section className="tracker-workspace">
      <div className="tracker-page-heading">
        <div>
          <div className="panel-kicker">MEASURE WHAT MATTERS</div>
          <h1>Your trackers</h1>
          <p>
            Build awareness through small, consistent daily check-ins.
          </p>
        </div>

        <button
          className="text-button"
          type="button"
          onClick={() => setShowForm((current) => !current)}
        >
          <Plus size={15} />
          {showForm ? "Cancel" : "Create tracker"}
        </button>
      </div>

      <div className="tracker-summary">
        <article className="tracker-summary-card">
          <span className="tracker-summary-icon">
            <Target size={19} />
          </span>
          <div>
            <span className="tracker-summary-label">TOTAL TRACKERS</span>
            <strong>{trackers.length}</strong>
          </div>
        </article>

        <article className="tracker-summary-card">
          <span className="tracker-summary-icon">
            <CircleCheck size={19} />
          </span>
          <div>
            <span className="tracker-summary-label">CHECKED IN TODAY</span>
            <strong>{completedToday}</strong>
          </div>
        </article>

        <article className="tracker-summary-card">
          <span className="tracker-summary-icon">
            <CalendarDays size={19} />
          </span>
          <div>
            <span className="tracker-summary-label">TODAY&apos;S DATE</span>
            <strong>
              {today
                ? new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </strong>
          </div>
        </article>
      </div>

      {showForm && (
        <form className="panel tracker-create-form" onSubmit={addTracker}>
          <div className="tracker-form-heading">
            <div>
              <h2>Create a tracker</h2>
              <p>Choose what you want to measure every day.</p>
            </div>
            <Plus size={20} />
          </div>

          <div className="tracker-form-grid">
            <label className="tracker-field">
              <span>Tracker name</span>
              <input
                autoFocus
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                placeholder="e.g. Daily reading"
                maxLength={80}
                required
              />
            </label>

            <label className="tracker-field">
              <span>Tracker type</span>
              <select
                value={draft.type}
                onChange={(event) =>
                  updateDraft("type", event.target.value as TrackerType)
                }
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="tracker-field">
              <span>Category</span>
              <input
                value={draft.category}
                onChange={(event) =>
                  updateDraft("category", event.target.value)
                }
                placeholder="e.g. Learning"
                maxLength={40}
                required
              />
            </label>

            {draft.type !== "boolean" && (
              <>
                <label className="tracker-field">
                  <span>Unit</span>
                  <input
                    value={draft.unit}
                    onChange={(event) =>
                      updateDraft("unit", event.target.value)
                    }
                    placeholder={
                      draft.type === "duration"
                        ? "minutes"
                        : draft.type === "rating"
                          ? "optional"
                          : "e.g. pages"
                    }
                    maxLength={20}
                  />
                </label>

                <label className="tracker-field">
                  <span>
                    {draft.type === "rating" ? "Maximum rating" : "Daily target"}
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="any"
                    value={draft.type === "rating" ? "5" : draft.target}
                    disabled={draft.type === "rating"}
                    onChange={(event) =>
                      updateDraft("target", event.target.value)
                    }
                    required
                  />
                </label>
              </>
            )}
          </div>

          <div className="tracker-form-actions">
            <button
              className="text-button tracker-cancel"
              type="button"
              onClick={() => {
                setShowForm(false);
                setDraft(initialDraft);
              }}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              <Plus size={15} />
              Create tracker
            </button>
          </div>
        </form>
      )}

      <div className="tracker-list-heading">
        <div>
          <h2>Your daily trackers</h2>
          <p>Record today&apos;s values and review recent check-ins.</p>
        </div>
      </div>

      {trackers.length === 0 ? (
        <div className="panel tracker-empty">
          <span className="tracker-empty-icon">
            <Activity size={26} />
          </span>
          <h3>Start tracking your progress</h3>
          <p>
            Create a tracker for any routine or personal goal you want to
            measure.
          </p>
          <button
            className="text-button"
            type="button"
            onClick={() => setShowForm(true)}
          >
            <Plus size={15} />
            Create your first tracker
          </button>
        </div>
      ) : (
        <div className="tracker-grid">
          {trackers.map((tracker) => {
            const currentValue = getTodayValue(tracker, today);
            const hasCheckedIn = currentValue !== undefined;
            const isEditing = editingTracker === tracker.id;
            const selectedDate = entryDates[tracker.id] ?? today;
            const selectedDateValue = getTodayValue(tracker, selectedDate);
            const progress =
              tracker.type === "boolean"
                ? currentValue && currentValue > 0
                  ? 100
                  : 0
                : hasCheckedIn
                  ? Math.min(
                      100,
                      Math.round((currentValue / tracker.target) * 100),
                    )
                  : 0;

            return (
              <article className="panel tracker-card" key={tracker.id}>
                <div className="tracker-card-header">
                  <span className="tracker-type-icon">
                    {getTypeIcon(tracker.type)}
                  </span>
                  <button
                    className="tracker-edit"
                    type="button"
                    onClick={() => startTrackerEdit(tracker)}
                    disabled={savingTrackerEdit}
                    aria-label={`Edit ${tracker.name}`}
                    title="Edit tracker"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    className="tracker-delete"
                    type="button"
                    onClick={() => deleteTracker(tracker.id)}
                    aria-label={`Delete ${tracker.name}`}
                    title="Delete tracker"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="tracker-category">{tracker.category}</div>
                <h3>{tracker.name}</h3>
                <div className="tracker-type-label">
                  {typeOptions.find((option) => option.value === tracker.type)
                    ?.label}
                </div>
                
                {editingTrackerId === tracker.id && (
                  <form
                    className="tracker-metadata-edit"
                    onSubmit={saveTrackerEdit}
                  >
                    <label className="tracker-field">
                      <span>Tracker name</span>
                      <input
                        autoFocus
                        value={editDraft.name}
                        onChange={(event) =>
                          setEditDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        maxLength={80}
                        required
                      />
                    </label>

                    <label className="tracker-field">
                      <span>Category</span>
                      <input
                        value={editDraft.category}
                        onChange={(event) =>
                          setEditDraft((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                        maxLength={40}
                        required
                      />
                    </label>

                    {tracker.type !== "boolean" && (
                      <>
                        <label className="tracker-field">
                          <span>Unit</span>
                          <input
                            value={editDraft.unit}
                            onChange={(event) =>
                              setEditDraft((current) => ({
                                ...current,
                                unit: event.target.value,
                              }))
                            }
                            maxLength={20}
                            placeholder="Optional"
                          />
                        </label>

                        <label className="tracker-field">
                          <span>
                            {tracker.type === "rating" ? "Maximum rating" : "Daily target"}
                          </span>
                          <input
                            type="number"
                            min="0.01"
                            max="1000000"
                            step="any"
                            value={tracker.type === "rating" ? "5" : editDraft.target}
                            disabled={tracker.type === "rating"}
                            onChange={(event) =>
                              setEditDraft((current) => ({
                                ...current,
                                target: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                      </>
                    )}

                    <div className="tracker-form-actions">
                      <button
                        className="text-button tracker-cancel"
                        type="button"
                        onClick={cancelTrackerEdit}
                        disabled={savingTrackerEdit}
                      >
                        Cancel
                      </button>

                      <button
                        className="primary-button"
                        type="submit"
                        disabled={savingTrackerEdit}
                      >
                        <Check size={15} />
                        {savingTrackerEdit ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </form>
                )}

                <div className="tracker-current-value">
                  <strong>
                    {hasCheckedIn
                      ? formatValue(currentValue, tracker)
                      : "No check-in"}
                  </strong>
                  <span>{hasCheckedIn ? "Today" : "Not recorded today"}</span>
                </div>

                {tracker.type !== "boolean" && (
                  <>
                    <div className="tracker-target-row">
                      <span>Daily target</span>
                      <strong>
                        {tracker.target} {tracker.unit}
                      </strong>
                    </div>

                    <div
                      className="tracker-meter"
                      role="progressbar"
                      aria-label={`${tracker.name} target completion`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </>
                )}

                <div className="tracker-history">
                  <div className="tracker-history-heading">LAST 7 DAYS</div>
                  <div className="tracker-history-days">
                    {recentDays.map((day) => {
                      const log = tracker.logs.find(
                        (entry) => entry.date === day.key,
                      );

                      const successful =
                        log !== undefined &&
                        (tracker.type === "boolean"
                          ? log.value > 0
                          : log.value >= tracker.target);

                      return (
                        <div className="tracker-history-day" key={day.key}>
                          <span
                            className={`tracker-history-dot ${
                              successful
                                ? "success"
                                : log
                                  ? "recorded"
                                  : ""
                            }`}
                            title={
                              log
                                ? formatValue(log.value, tracker)
                                : "No check-in"
                            }
                          >
                            {log && <Check size={11} />}
                          </span>
                          <small>{day.label}</small>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isEditing && (
                  <form
                    className="tracker-checkin-form"
                    onSubmit={(event) => {
                      event.preventDefault();

                      const rawValue = entryValues[tracker.id] ?? "";
                      if (rawValue.trim() === "" || !selectedDate) return;

                      const value = Number(rawValue);

                      if (!Number.isFinite(value) || value < 0) return;

                      if (tracker.type === "rating" && (value < 1 || value > 5)) {
                        return;
                      }

                      saveCheckIn(tracker.id, value, selectedDate);
                    }}
                  >
                    <label className="tracker-field">
                      <span>Entry date</span>
                      <input
                        type="date"
                        value={selectedDate}
                        max={today || undefined}
                        required
                        onChange={(event) => {
                          const nextDate = event.target.value;

                          setEntryDates((current) => ({
                            ...current,
                            [tracker.id]: nextDate,
                          }));

                          const existingValue = tracker.logs.find(
                            (log) => log.date === nextDate,
                          )?.value;

                          setEntryValues((current) => ({
                            ...current,
                            [tracker.id]:
                              existingValue === undefined ? "" : String(existingValue),
                          }));
                        }}
                      />
                    </label>

                    {tracker.type === "boolean" ? (
                      <label className="tracker-field">
                        <span>Check-in status</span>
                        <select
                          value={
                            entryValues[tracker.id] ??
                            (selectedDateValue === undefined
                              ? ""
                              : String(selectedDateValue))
                          }
                          onChange={(event) =>
                            setEntryValues((current) => ({
                              ...current,
                              [tracker.id]: event.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Select status</option>
                          <option value="1">Completed</option>
                          <option value="0">Not completed</option>
                        </select>
                      </label>
                    ) : (
                      <label className="tracker-field">
                        <span>
                          {tracker.type === "rating"
                            ? "Your rating (1–5)"
                            : `Value for selected date${tracker.unit ? ` (${tracker.unit})` : ""}`}
                        </span>
                        <input
                          type="number"
                          min={tracker.type === "rating" ? 1 : 0}
                          max={tracker.type === "rating" ? 5 : 1000000}
                          step={tracker.type === "rating" ? 1 : "any"}
                          value={
                            entryValues[tracker.id] ??
                            (selectedDateValue === undefined
                              ? ""
                              : String(selectedDateValue))
                          }
                          onChange={(event) =>
                            setEntryValues((current) => ({
                              ...current,
                              [tracker.id]: event.target.value,
                            }))
                          }
                          placeholder={
                            tracker.type === "rating" ? "1 to 5" : "Enter a value"
                          }
                          required
                        />
                      </label>
                    )}

                    <div className="tracker-form-actions">
                      <button
                        className="text-button tracker-cancel"
                        type="button"
                        onClick={() => setEditingTracker(null)}
                      >
                        Cancel
                      </button>

                      <button className="primary-button" type="submit">
                        <Check size={15} />
                        Save check-in
                      </button>
                    </div>
                  </form>
                )}

                <div className="tracker-card-actions">
                  {tracker.type === "boolean" ? (
                    <>
                      <button
                        className="primary-button tracker-checkin-button"
                        type="button"
                        onClick={() =>
                          saveCheckIn(
                            tracker.id,
                            currentValue && currentValue > 0 ? 0 : 1,
                          )
                        }
                      >
                        <Check size={15} />
                        {currentValue && currentValue > 0
                          ? "Undo check-in"
                          : "Mark as done"}
                      </button>

                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingTracker(null);
                          } else {
                            startCheckInEdit(tracker.id, currentValue);
                          }
                        }}
                      >
                        {isEditing ? "Close editor" : "Edit history"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary-button tracker-checkin-button"
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setEditingTracker(null);
                        } else {
                          startCheckInEdit(tracker.id, currentValue);
                        }
                      }}
                    >
                      <Plus size={15} />
                      {hasCheckedIn ? "Update today's value" : "Add check-in"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="tracker-note">
        <Droplets size={16} />
        <span>Your trackers and check-ins are saved to your LifeOS account.</span>
      </div>
    </section>
  );
}