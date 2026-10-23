"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useConfirmDialog } from "./confirm-dialog-provider";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarDays,
  Check,
  Dumbbell,
  Plus,
  Pencil,
  Save,
  Trash2,
  X,
  Target,
  ClipboardCheck,
} from "lucide-react";

type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number | null;
  completed: boolean;
};

type WorkoutDay = {
  date: string;
  title: string;
  exercises: Exercise[];
};

type ExerciseDraft = {
  name: string;
  sets: string;
  reps: string;
  weight: string;
};


const initialExerciseDraft: ExerciseDraft = {
  name: "",
  sets: "3",
  reps: "10",
  weight: "",
};

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatWorkoutDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isExercise(value: unknown): value is Exercise {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.sets === "number" &&
    Number.isInteger(item.sets) &&
    item.sets >= 1 &&
    typeof item.reps === "number" &&
    Number.isInteger(item.reps) &&
    item.reps >= 1 &&
    typeof item.completed === "boolean"
  );
}

function isWorkoutDay(value: unknown): value is WorkoutDay {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    typeof item.title === "string" &&
    item.title.trim().length > 0 &&
    Array.isArray(item.exercises) &&
    item.exercises.every(isExercise)
  );
}

export default function FitnessWorkspace() {
  const { requestConfirmation } = useConfirmDialog();
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState("");
  const [showDayForm, setShowDayForm] = useState(false);
  const [dayTitle, setDayTitle] = useState("");

  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [exerciseDraft, setExerciseDraft] =
    useState<ExerciseDraft>(initialExerciseDraft);
  const [editingExerciseId, setEditingExerciseId] =
  useState<string | null>(null);
  const [editingExerciseDate, setEditingExerciseDate] =
    useState<string | null>(null);
  const [editExerciseDraft, setEditExerciseDraft] =
    useState<ExerciseDraft>(initialExerciseDraft);
  const [savingExerciseEdit, setSavingExerciseEdit] = useState(false);

  const [formError, setFormError] = useState("");


  useEffect(() => {
    let cancelled = false;

    async function loadFitnessData() {
      const today = getDateKey(new Date());

      setSelectedDate(today);

      try {
        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          throw new Error(
            "Your session was not found. Please sign in again."
          );
        }

        if (!cancelled) {
          setUserId(user.id);
        }

        const {
          data: dayRows,
          error: dayError,
        } = await supabase
          .from("workout_days")
          .select("workout_date, title")
          .eq("user_id", user.id)
          .order("workout_date", { ascending: false });

        if (dayError) throw dayError;

        const {
          data: exerciseRows,
          error: exerciseError,
        } = await supabase
          .from("exercises")
          .select(
            "id, workout_date, name, sets, reps, weight_kg, completed, sort_order"
          )
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true });

        if (exerciseError) throw exerciseError;

        const cloudDays: WorkoutDay[] = (dayRows ?? []).map((day) => ({
          date: day.workout_date,
          title: day.title,
          exercises: (exerciseRows ?? [])
            .filter((exercise) => exercise.workout_date === day.workout_date)
            .map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
              sets: Number(exercise.sets),
              reps: Number(exercise.reps),
              weight:
                exercise.weight_kg === null
                  ? null
                  : Number(exercise.weight_kg),
              completed: exercise.completed,
            })),
        }));

        if (!cancelled) {
          setWorkoutDays(cloudDays);
          setDayTitle(
            cloudDays.find((day) => day.date === today)?.title ?? ""
          );
          setLoadError(null);
        }
      } catch (error) {
        console.error("Could not load cloud fitness data:", error);

        if (!cancelled) {
          setWorkoutDays([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load your workouts. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void loadFitnessData();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDay = workoutDays.find(
    (day) => day.date === selectedDate,
  );

  const exercises = selectedDay?.exercises ?? [];

  const completedCount = exercises.filter(
    (exercise) => exercise.completed,
  ).length;

  const exerciseCount = exercises.length;

  const completionPercent =
    exerciseCount > 0
      ? Math.round((completedCount / exerciseCount) * 100)
      : 0;

  const totalExercisesLogged = workoutDays.reduce(
    (sum, day) => sum + day.exercises.length,
    0,
  );

  const totalCompletedExercises = workoutDays.reduce(
    (sum, day) =>
      sum + day.exercises.filter((exercise) => exercise.completed).length,
    0,
  );

  const recentDays = useMemo(
    () =>
      [...workoutDays].sort((a, b) => b.date.localeCompare(a.date)),
    [workoutDays],
  );

  function handleDateChange(value: string) {
    setSelectedDate(value);

    const day = workoutDays.find((item) => item.date === value);

    setDayTitle(day?.title ?? "");
    setShowDayForm(false);
    setShowExerciseForm(false);
    setExerciseDraft(initialExerciseDraft);
    setFormError("");
  }

  function openDayForm() {
    setDayTitle(selectedDay?.title ?? "");
    setFormError("");
    setShowDayForm(true);
    setShowExerciseForm(false);
  }


  async function saveWorkoutDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = dayTitle.trim();

    if (!selectedDate || !title) {
      setFormError("Choose a date and enter a workout day name.");
      return;
    }

    if (!userId) {
      setFormError("Your session was not found. Please sign in again.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("workout_days")
        .upsert(
          {
            user_id: userId,
            workout_date: selectedDate,
            title: title.slice(0, 70),
          },
          {
            onConflict: "user_id,workout_date",
          },
        );

      if (error) throw error;

      setWorkoutDays((current) => {
        const existing = current.find(
          (day) => day.date === selectedDate,
        );

        if (existing) {
          return current.map((day) =>
            day.date === selectedDate
              ? { ...day, title: title.slice(0, 70) }
              : day,
          );
        }

        return [
          ...current,
          {
            date: selectedDate,
            title: title.slice(0, 70),
            exercises: [],
          },
        ];
      });

      setDayTitle(title.slice(0, 70));
      setFormError("");
      setShowDayForm(false);
    } catch (error) {
      console.error("Could not save workout day:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : "Could not save the workout day. Please try again.",
      );
    }
  }


  function openExerciseForm() {
    if (!selectedDay) {
      setFormError("Create a workout day first.");
      return;
    }

    setFormError("");
    setExerciseDraft(initialExerciseDraft);
    setShowExerciseForm(true);
    setShowDayForm(false);
  }


  async function addExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDay) {
      setFormError("Create a workout day first.");
      return;
    }

    const name = exerciseDraft.name.trim();
    const sets = Number(exerciseDraft.sets);
    const reps = Number(exerciseDraft.reps);
    const weightText = exerciseDraft.weight.trim();

    const weight = weightText === "" ? null : Number(weightText);

    if (!name) {
      setFormError("Enter an exercise name.");
      return;
    }

    if (
      !Number.isInteger(sets) ||
      sets < 1 ||
      sets > 30 ||
      !Number.isInteger(reps) ||
      reps < 1 ||
      reps > 200
    ) {
      setFormError("Sets must be 1–30 and reps must be 1–200.");
      return;
    }

    if (
      weightText !== "" &&
      (
        weight === null ||
        !Number.isFinite(weight) ||
        weight <= 0 ||
        weight > 1000
      )
    ) {
      setFormError(
        "Weight must be greater than 0 and no more than 1000 kg, or leave it blank.",
      );
      return;
    }

    if (!userId) {
      setFormError("Your session was not found. Please sign in again.");
      return;
    }

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("exercises")
        .insert({
          id: crypto.randomUUID(),
          user_id: userId,
          workout_date: selectedDate,
          name: name.slice(0, 80),
          sets,
          reps,
          weight_kg: weight,
          completed: false,
          sort_order: selectedDay.exercises.length,
        })
        .select(
          "id, name, sets, reps, weight_kg, completed",
        )
        .single();

      if (error) throw error;

      const exercise: Exercise = {
        id: data.id,
        name: data.name,
        sets: Number(data.sets),
        reps: Number(data.reps),
        weight: data.weight_kg === null
          ? null
          : Number(data.weight_kg),
        completed: data.completed,
      };

      setWorkoutDays((current) =>
        current.map((day) =>
          day.date === selectedDate
            ? {
                ...day,
                exercises: [...day.exercises, exercise],
              }
            : day,
        ),
      );

      setExerciseDraft(initialExerciseDraft);
      setFormError("");
      setShowExerciseForm(false);
    } catch (error) {
      console.error("Could not add exercise:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : "Could not add the exercise. Please try again.",
      );
    }
  }

function startExerciseEdit(exercise: Exercise) {
  setEditingExerciseId(exercise.id);
  setEditingExerciseDate(selectedDate);

  setEditExerciseDraft({
    name: exercise.name,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weight: exercise.weight == null ? "" : String(exercise.weight),
  });

  setShowExerciseForm(false);
  setShowDayForm(false);
  setFormError("");
}

function cancelExerciseEdit() {
  if (savingExerciseEdit) return;

  setEditingExerciseId(null);
  setEditingExerciseDate(null);
  setEditExerciseDraft(initialExerciseDraft);
  setFormError("");
}

  async function saveExerciseEdit(
    event: FormEvent<HTMLFormElement>,
    date: string,
    exerciseId: string,
  ) {
    event.preventDefault();

    if (
      savingExerciseEdit ||
      editingExerciseId !== exerciseId ||
      editingExerciseDate !== date
    ) {
      return;
    }

    const name = editExerciseDraft.name.trim();
    const sets = Number(editExerciseDraft.sets);
    const reps = Number(editExerciseDraft.reps);
    const weightText = editExerciseDraft.weight.trim();
    const weight = weightText === "" ? null : Number(weightText);

    if (!name) {
      setFormError("Enter an exercise name.");
      return;
    }

    if (
      !Number.isInteger(sets) ||
      sets < 1 ||
      sets > 30 ||
      !Number.isInteger(reps) ||
      reps < 1 ||
      reps > 200
    ) {
      setFormError("Sets must be 1-30 and reps must be 1-200.");
      return;
    }

    if (
      weightText !== "" &&
      (
        weight === null ||
        !Number.isFinite(weight) ||
        weight <= 0 ||
        weight > 1000
      )
    ) {
      setFormError(
        "Weight must be greater than 0 and no more than 1000 kg, or leave it blank.",
      );
      return;
    }

    if (!userId) {
      setFormError("Your session was not found. Please sign in again.");
      return;
    }

    const existingExercise = workoutDays
      .find((day) => day.date === date)
      ?.exercises.find((item) => item.id === exerciseId);

    if (!existingExercise) {
      setFormError("This exercise could not be found. Please refresh and try again.");
      return;
    }

    setSavingExerciseEdit(true);
    setFormError("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("exercises")
        .update({
          name: name.slice(0, 80),
          sets,
          reps,
          weight_kg: weight,
        })
        .eq("user_id", userId)
        .eq("workout_date", date)
        .eq("id", exerciseId)
        .select("id, name, sets, reps, weight_kg")
        .single();

      if (error) throw error;

      setWorkoutDays((current) =>
        current.map((day) =>
          day.date !== date
            ? day
            : {
                ...day,
                exercises: day.exercises.map((item) =>
                  item.id !== exerciseId
                    ? item
                    : {
                        ...item,
                        name: data.name,
                        sets: Number(data.sets),
                        reps: Number(data.reps),
                        weight:
                          data.weight_kg == null
                            ? null
                            : Number(data.weight_kg),
                      },
                ),
              },
        ),
      );

      setEditingExerciseId(null);
      setEditingExerciseDate(null);
      setEditExerciseDraft(initialExerciseDraft);
      setFormError("");
    } catch (error) {
      console.error("Could not update exercise:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : "Could not update the exercise. Please try again.",
      );
    } finally {
      setSavingExerciseEdit(false);
    }
  }

  async function toggleExercise(exerciseId: string) {
    if (!userId) {
      setFormError("Your session was not found. Please sign in again.");
      return;
    }

    const selectedDay = workoutDays.find(
      (day) => day.date === selectedDate,
    );

    const exercise = selectedDay?.exercises.find(
      (item) => item.id === exerciseId,
    );

    if (!exercise) return;

    const nextCompleted = !exercise.completed;

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("exercises")
        .update({ completed: nextCompleted })
        .eq("user_id", userId)
        .eq("workout_date", selectedDate)
        .eq("id", exerciseId);

      if (error) throw error;

      setWorkoutDays((current) =>
        current.map((day) =>
          day.date !== selectedDate
            ? day
            : {
                ...day,
                exercises: day.exercises.map((item) =>
                  item.id === exerciseId
                    ? { ...item, completed: nextCompleted }
                    : item,
                ),
              },
        ),
      );

      setFormError("");
    } catch (error) {
      console.error("Could not update exercise completion:", error);
      setFormError("Could not update exercise completion. Please try again.");
    }
  }

async function deleteExercise(exerciseId: string) {
  if (!userId) {
    setFormError("Your session was not found. Please sign in again.");
    return;
  }

  const exercise = workoutDays
    .find((day) => day.date === selectedDate)
    ?.exercises.find((item) => item.id === exerciseId);

  if (!exercise) return;

  const confirmed = await requestConfirmation({
    title: "Delete this exercise?",
    message: `Are you sure you want to delete "${exercise.name}"? This action cannot be undone.`,
    confirmLabel: "Delete exercise",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("exercises")
      .delete()
      .eq("user_id", userId)
      .eq("workout_date", selectedDate)
      .eq("id", exerciseId);

    if (error) throw error;

    setWorkoutDays((current) =>
      current.map((day) =>
        day.date !== selectedDate
          ? day
          : {
              ...day,
              exercises: day.exercises.filter(
                (item) => item.id !== exerciseId,
              ),
            },
      ),
    );

    setFormError("");
  } catch (error) {
    console.error("Could not delete exercise:", error);
    setFormError("Could not delete the exercise. Please try again.");
  }
}

  async function deleteWorkoutDay() {
    if (!selectedDay) return;

  const confirmed = await requestConfirmation({
    title: "Delete this workout day?",
    message: `Are you sure you want to delete "${selectedDay.title}" and all its exercises? This action cannot be undone.`,
    confirmLabel: "Delete workout day",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

    if (!userId) {
      setFormError("Your session was not found. Please sign in again.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("workout_days")
        .delete()
        .eq("user_id", userId)
        .eq("workout_date", selectedDate);

      if (error) throw error;

      setWorkoutDays((current) =>
        current.filter((day) => day.date !== selectedDate),
      );

      setDayTitle("");
      setShowDayForm(false);
      setShowExerciseForm(false);
      setExerciseDraft(initialExerciseDraft);
      setFormError("");
    } catch (error) {
      console.error("Could not delete workout day:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : "Could not delete the workout day. Please try again.",
      );
    }
  }

  if (!loaded) {
    return (
      <section className="panel fitness-loading">
        Loading your workouts...
      </section>
    );
  }
  if (loadError) {
    return (
      <section className="panel fitness-loading">
        <p>Could not load your cloud workouts.</p>
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

  return (
    <section className="fitness-workspace">
      <div className="fitness-heading">
        <div>
          <div className="panel-kicker">YOUR MOVEMENT WORKSPACE</div>
          <h1>Fitness</h1>
          <p>
            Plan your training days, track exercises, and build consistency
            one session at a time.
          </p>
        </div>

        <button
          className="text-button"
          type="button"
          onClick={openDayForm}
        >
          <Plus size={15} />
          {selectedDay ? "Edit workout day" : "Set workout day"}
        </button>
      </div>

      <section className="fitness-session-hero">
        <div className="fitness-session-top">
          <div className="fitness-session-icon">
            <Dumbbell size={22} />
          </div>

          <div className="fitness-session-heading">
            <span className="fitness-kicker">SELECTED WORKOUT</span>
            <h2>{selectedDay?.title ?? "Plan a training session"}</h2>
            <p>
              {selectedDate ? formatWorkoutDate(selectedDate) : "Choose a date"}
            </p>
          </div>
        </div>

        <div className="fitness-date-controls">
          <label className="academics-field">
            <span>Workout date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => handleDateChange(event.target.value)}
              required
            />
          </label>

          {selectedDay && (
            <button
              type="button"
              className="fitness-delete-day"
              onClick={deleteWorkoutDay}
            >
              <Trash2 size={14} />
              Delete day
            </button>
          )}
        </div>

        <div className="fitness-session-progress">
          <div className="fitness-progress-heading">
            <span>Session progress</span>
            <strong>{completionPercent}%</strong>
          </div>

          <div
            className="fitness-progress-track"
            role="progressbar"
            aria-label="Workout completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionPercent}
          >
            <span style={{ width: `${completionPercent}%` }} />
          </div>

          <p>
            {completedCount} of {exerciseCount} exercises completed
          </p>
        </div>
      </section>

      {showDayForm && (
        <form className="panel fitness-form" onSubmit={saveWorkoutDay}>
          <div className="fitness-form-heading">
            <div>
              <h2>{selectedDay ? "Edit workout day" : "Create workout day"}</h2>
              <p>
                Give this date a name, such as Chest + Tricep Day.
              </p>
            </div>

            <button
              className="fitness-close-button"
              type="button"
              aria-label="Close workout day form"
              onClick={() => {
                setShowDayForm(false);
                setFormError("");
              }}
            >
              <X size={16} />
            </button>
          </div>

          <label className="academics-field">
            <span>Workout day name</span>
            <input
              autoFocus
              value={dayTitle}
              onChange={(event) => setDayTitle(event.target.value)}
              maxLength={70}
              placeholder="e.g. Chest + Tricep Day"
              required
            />
          </label>

          {formError && (
            <p className="fitness-error" role="alert">
              {formError}
            </p>
          )}

          <div className="academics-form-actions">
            <button
              className="text-button academics-cancel"
              type="button"
              onClick={() => {
                setShowDayForm(false);
                setFormError("");
              }}
            >
              Cancel
            </button>

            <button className="primary-button" type="submit">
              <Check size={15} />
              {selectedDay ? "Save changes" : "Create workout day"}
            </button>
          </div>
        </form>
      )}

      <div className="fitness-summary-grid">
        <article className="fitness-summary-card">
          <span className="fitness-summary-icon">
            <CalendarDays size={18} />
          </span>
          <div>
            <span>WORKOUT DAYS</span>
            <strong>{workoutDays.length}</strong>
          </div>
        </article>

        <article className="fitness-summary-card">
          <span className="fitness-summary-icon">
            <ClipboardCheck size={18} />
          </span>
          <div>
            <span>EXERCISES COMPLETED</span>
            <strong>{totalCompletedExercises}</strong>
          </div>
        </article>

        <article className="fitness-summary-card">
          <span className="fitness-summary-icon">
            <Target size={18} />
          </span>
          <div>
            <span>EXERCISES PLANNED</span>
            <strong>{totalExercisesLogged}</strong>
          </div>
        </article>
      </div>

      <div className="fitness-content-grid">
        <section className="panel fitness-checklist-panel">
          <div className="fitness-section-heading">
            <div>
              <h2>Workout checklist</h2>
              <p>
                {selectedDay
                  ? "Tick an exercise when you finish it."
                  : "Set a workout day before adding exercises."}
              </p>
            </div>

            {selectedDay && (
              <button
                className="primary-button fitness-add-button"
                type="button"
                onClick={openExerciseForm}
              >
                <Plus size={14} />
                Add exercise
              </button>
            )}
          </div>

          {!selectedDay ? (
            <div className="fitness-empty-state">
              <span className="fitness-empty-icon">
                <Dumbbell size={26} />
              </span>
              <h3>No workout planned for this date</h3>
              <p>
                Choose “Set workout day”, name your session, then add your
                custom exercises with sets and reps.
              </p>
              <button
                className="text-button"
                type="button"
                onClick={openDayForm}
              >
                <Plus size={15} />
                Set workout day
              </button>
            </div>
          ) : exercises.length === 0 ? (
            <div className="fitness-empty-state">
              <span className="fitness-empty-icon">
                <Target size={25} />
              </span>
              <h3>Your workout is ready</h3>
              <p>
                Add your first exercise. You choose the name, number of sets,
                and reps.
              </p>
              <button
                className="text-button"
                type="button"
                onClick={openExerciseForm}
              >
                <Plus size={15} />
                Add first exercise
              </button>
            </div>
          ) : (
            <div className="fitness-exercise-list">
              {exercises.map((exercise) => (
                <article
                  className={`fitness-exercise-row ${
                    exercise.completed ? "completed" : ""
                  }`}
                  key={exercise.id}
                >
                  <button
                    type="button"
                    className={`fitness-exercise-check ${
                      exercise.completed ? "checked" : ""
                    }`}
                    onClick={() => toggleExercise(exercise.id)}
                    aria-label={
                      exercise.completed
                        ? `Mark ${exercise.name} incomplete`
                        : `Complete ${exercise.name}`
                    }
                    aria-pressed={exercise.completed}
                  >
                    {exercise.completed && <Check size={13} />}
                  </button>

                  {editingExerciseId === exercise.id &&
                    editingExerciseDate === selectedDate ? (
                      <form
                        className="fitness-exercise-edit-form"
                        onSubmit={(event) =>
                          saveExerciseEdit(event, selectedDate, exercise.id)
                        }
                      >
                        <label className="fitness-exercise-edit-field">
                          <span>Exercise name</span>
                          <input
                            autoFocus
                            value={editExerciseDraft.name}
                            onChange={(event) =>
                              setEditExerciseDraft((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            maxLength={80}
                            required
                          />
                        </label>

                        <div className="fitness-exercise-edit-grid">
                          <label className="fitness-exercise-edit-field">
                            <span>Sets</span>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              step="1"
                              value={editExerciseDraft.sets}
                              onChange={(event) =>
                                setEditExerciseDraft((current) => ({
                                  ...current,
                                  sets: event.target.value,
                                }))
                              }
                              required
                            />
                          </label>

                          <label className="fitness-exercise-edit-field">
                            <span>Reps</span>
                            <input
                              type="number"
                              min="1"
                              max="200"
                              step="1"
                              value={editExerciseDraft.reps}
                              onChange={(event) =>
                                setEditExerciseDraft((current) => ({
                                  ...current,
                                  reps: event.target.value,
                                }))
                              }
                              required
                            />
                          </label>

                          <label className="fitness-exercise-edit-field">
                            <span>Weight (kg)</span>
                            <input
                              type="number"
                              min="0.01"
                              max="1000"
                              step="any"
                              value={editExerciseDraft.weight}
                              onChange={(event) =>
                                setEditExerciseDraft((current) => ({
                                  ...current,
                                  weight: event.target.value,
                                }))
                              }
                              placeholder="Optional"
                            />
                          </label>
                        </div>

                        <div className="fitness-exercise-edit-actions">
                          <button
                            className="text-button"
                            type="button"
                            onClick={cancelExerciseEdit}
                            disabled={savingExerciseEdit}
                          >
                            Cancel
                          </button>

                          <button
                            className="primary-button"
                            type="submit"
                            disabled={savingExerciseEdit}
                          >
                            <Save size={14} />
                            {savingExerciseEdit ? "Saving..." : "Save exercise"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="fitness-exercise-copy">
                          <strong>{exercise.name}</strong>
                          <span>
                            {exercise.sets} {exercise.sets === 1 ? "set" : "sets"} ×{" "}
                            {exercise.reps} {exercise.reps === 1 ? "rep" : "reps"}
                            {exercise.weight != null && exercise.weight > 0
                              ? ` · ${exercise.weight.toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })} kg`
                              : " · No weight"}
                          </span>
                        </div>

                        <div className="fitness-exercise-actions">
                          <button
                            type="button"
                            className="fitness-edit-exercise"
                            onClick={() => startExerciseEdit(exercise)}
                            title="Edit exercise"
                            aria-label={`Edit ${exercise.name}`}
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            type="button"
                            className="fitness-delete-exercise"
                            onClick={() => deleteExercise(exercise.id)}
                            aria-label={`Delete ${exercise.name}`}
                            title="Delete exercise"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
            </div>
          )}

          {showExerciseForm && selectedDay && (
            <form className="fitness-form fitness-exercise-form" onSubmit={addExercise}>
              <div className="fitness-form-heading">
                <div>
                  <h2>Add an exercise</h2>
                  <p>Choose your own exercise name and targets.</p>
                </div>

                <button
                  className="fitness-close-button"
                  type="button"
                  aria-label="Close exercise form"
                  onClick={() => {
                    setShowExerciseForm(false);
                    setFormError("");
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <label className="academics-field">
                <span>Exercise name</span>
                <input
                  autoFocus
                  value={exerciseDraft.name}
                  onChange={(event) =>
                    setExerciseDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  maxLength={80}
                  placeholder="e.g. Incline Dumbbell Press"
                  required
                />
              </label>

              <div className="fitness-exercise-target-grid">
                <label className="academics-field">
                  <span>Sets</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    value={exerciseDraft.sets}
                    onChange={(event) =>
                      setExerciseDraft((current) => ({
                        ...current,
                        sets: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="academics-field">
                  <span>Reps per set</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    step="1"
                    value={exerciseDraft.reps}
                    onChange={(event) =>
                      setExerciseDraft((current) => ({
                        ...current,
                        reps: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="academics-field fitness-weight-field">
                <span>Weight (kg, optional)</span>
                <input
                    type="number"
                    min="0.01"
                    max="1000"
                    step="any"
                    value={exerciseDraft.weight}
                    onChange={(event) =>
                    setExerciseDraft((current) => ({
                        ...current,
                        weight: event.target.value,
                    }))
                    }
                    placeholder="e.g. 12.5"
                />
                </label>
              </div>

              {formError && (
                <p className="fitness-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="academics-form-actions">
                <button
                  className="text-button academics-cancel"
                  type="button"
                  onClick={() => {
                    setShowExerciseForm(false);
                    setFormError("");
                  }}
                >
                  Cancel
                </button>

                <button className="primary-button" type="submit">
                  <Plus size={14} />
                  Add exercise
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="panel fitness-history-panel">
          <div className="fitness-section-heading">
            <div>
              <h2>Workout history</h2>
              <p>Choose a date to review that session.</p>
            </div>
          </div>

          {recentDays.length === 0 ? (
            <div className="fitness-history-empty">
              Your saved workout days will appear here.
            </div>
          ) : (
            <div className="fitness-history-list">
              {recentDays.slice(0, 8).map((day) => {
                const done = day.exercises.filter(
                  (exercise) => exercise.completed,
                ).length;

                const total = day.exercises.length;

                return (
                  <button
                    type="button"
                    className={`fitness-history-item ${
                      day.date === selectedDate ? "active" : ""
                    }`}
                    key={day.date}
                    onClick={() => handleDateChange(day.date)}
                  >
                    <span className="fitness-history-date">
                      <CalendarDays size={16} />
                    </span>

                    <span className="fitness-history-copy">
                      <strong>{day.title}</strong>
                      <span>{formatWorkoutDate(day.date)}</span>
                      <small>
                        {done}/{total} exercises complete
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {formError && !showDayForm && !showExerciseForm && (
        <p className="fitness-error" role="alert">
          {formError}
        </p>
      )}

      <div className="fitness-storage-note">
        <CalendarDays size={15} />
        <span>Your workouts and workout history are saved to your LifeOS account.</span>
      </div>
    </section>
  );
}