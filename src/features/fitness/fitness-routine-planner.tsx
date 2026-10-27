"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getFitnessWeightText, parseFitnessWeightSpec } from "@/features/fitness/fitness-weight-spec";
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronDown, ChevronUp, Dumbbell, Pencil, Plus, Save, Trash2, X } from "lucide-react";

type Routine = {
  id: string;
  name: string;
  weekday: number;
  isActive: boolean;
  sortOrder: number;
};

type RoutineExercise = {
  id: string;
  routineId: string;
  name: string;
  itemType: "strength" | "cardio";
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetWeightSpec: string | null;
  targetDurationMinutes: number | null;
  targetDistanceKm: number | null;
  sortOrder: number;
};

type RoutineRow = {
  id: string;
  name: string;
  weekday: number | string;
  is_active: boolean;
  sort_order: number | string;
};

type RoutineExerciseRow = {
  id: string;
  routine_id: string;
  name: string;
  item_type: "strength" | "cardio";
  target_sets: number | string | null;
  target_reps: number | string | null;
  target_weight_kg: number | string | null;
  target_weight_spec?: string | null;
  target_duration_minutes: number | string | null;
  target_distance_km: number | string | null;
  sort_order: number | string;
};

type RoutineExerciseDraft = {
  name: string;
  sets: string;
  reps: string;
  weight: string;
};

type CustomWorkoutExerciseDraft = {
  draftId: string;
  existingExerciseId?: string | null;
  name: string;
  sets: string;
  reps: string;
  weight: string;
};

type CustomWorkoutDraftPayload = {
  title: string;
  exercises: CustomWorkoutExerciseDraft[];
};

type WorkoutExerciseSnapshot = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number | null;
  weightSpec?: string | null;
  completed: boolean;
};

type WorkoutSnapshot = {
  date: string;
  title: string;
  exercises: WorkoutExerciseSnapshot[];
};

type ExistingWorkout = {
  date: string;
  title: string;
  exercises: Array<{
    id: string;
    name: string;
    sets: number;
    reps: number;
    weight?: number | null;
    weightSpec?: string | null;
    completed: boolean;
  }>;
};

type FitnessRoutinePlannerProps = {
  selectedDate: string;
  contextRevision: number;
  hasWorkoutOnDate: boolean;
  existingWorkout: ExistingWorkout | null;
  onWorkoutCreated: (day: WorkoutSnapshot) => void;
};

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

const EMPTY_EXERCISE_DRAFT: RoutineExerciseDraft = {
  name: "",
  sets: "3",
  reps: "10",
  weight: "",
};

function toRoutine(row: RoutineRow): Routine {
  return {
    id: String(row.id),
    name: String(row.name),
    weekday: Number(row.weekday),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
  };
}

function toRoutineExercise(row: RoutineExerciseRow): RoutineExercise {
  return {
    id: String(row.id),
    routineId: String(row.routine_id),
    name: String(row.name),
    itemType: row.item_type === "cardio" ? "cardio" : "strength",
    targetSets: row.target_sets == null ? null : Number(row.target_sets),
    targetReps: row.target_reps == null ? null : Number(row.target_reps),
    targetWeightKg: row.target_weight_kg == null ? null : Number(row.target_weight_kg),
    targetWeightSpec: row.target_weight_spec?.trim() || (row.target_weight_kg == null ? null : String(row.target_weight_kg)),
    targetDurationMinutes: row.target_duration_minutes == null ? null : Number(row.target_duration_minutes),
    targetDistanceKm: row.target_distance_km == null ? null : Number(row.target_distance_km),
    sortOrder: Number(row.sort_order),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : fallback;

  if (message.includes("workout_routines_user_id_weekday_name_key")) {
    return "A routine with that name already exists for this weekday.";
  }
  return message.trim() ? message : fallback;
}

function formatDate(value: string) {
  if (!value) return "the selected date";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function weekdayForDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date().getDay() : date.getDay();
}

function formatWeightLabel(weightSpec?: string | null, legacyWeight?: number | null) {
  const text = getFitnessWeightText(weightSpec, legacyWeight);
  return text ? ` · ${text} kg` : "";
}

const FITNESS_ROUTINE_LOAD_TIMEOUT_MS = 12_000;

export default function FitnessRoutinePlanner({
  selectedDate,
  contextRevision,
  hasWorkoutOnDate,
  existingWorkout,
  onWorkoutCreated,
}: FitnessRoutinePlannerProps) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);
  const [weekdayOverride, setWeekdayOverride] = useState<{
    selectedDate: string;
    contextRevision: number;
    weekday: number;
  } | null>(null);
  const viewWeekday =
    weekdayOverride !== null &&
    weekdayOverride.selectedDate === selectedDate &&
    weekdayOverride.contextRevision === contextRevision
      ? weekdayOverride.weekday
      : weekdayForDate(selectedDate);
  const [selectedRoutineId, setSelectedRoutineId] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState("");
  const [routineWeekday, setRoutineWeekday] = useState("0");
  const [pendingDeleteRoutineId, setPendingDeleteRoutineId] = useState<string | null>(null);

  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [editingRoutineExerciseId, setEditingRoutineExerciseId] = useState<string | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<RoutineExerciseDraft>(EMPTY_EXERCISE_DRAFT);
  const [pendingDeleteExerciseId, setPendingDeleteExerciseId] = useState<string | null>(null);

  // CUSTOM_WORKOUT_DRAFT_V3: edits here belong only to the selected workout date.
  const [showCustomWorkout, setShowCustomWorkout] = useState(false);
  const [customWorkoutContext, setCustomWorkoutContext] = useState<{
    selectedDate: string;
    contextRevision: number;
    weekday: number;
  } | null>(null);
  const [customWorkoutTitle, setCustomWorkoutTitle] = useState("");
  const [customWorkoutExercises, setCustomWorkoutExercises] = useState<CustomWorkoutExerciseDraft[]>([]);
  const showCustomWorkoutForCurrentContext =
    showCustomWorkout &&
    customWorkoutContext !== null &&
    customWorkoutContext.selectedDate === selectedDate &&
    customWorkoutContext.contextRevision === contextRevision &&
    customWorkoutContext.weekday === viewWeekday;

  function setViewWeekday(nextWeekday: number) {
    if (nextWeekday === weekdayForDate(selectedDate)) {
      setWeekdayOverride(null);
      return;
    }
    setWeekdayOverride({
      selectedDate,
      contextRevision,
      weekday: nextWeekday,
    });
  }

  useEffect(() => {
    if (!showCustomWorkoutForCurrentContext) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("fitness-custom-workout-editor")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showCustomWorkoutForCurrentContext]);

  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;
    let timeoutId: number | undefined;
    let timedOut = false;

    async function loadPlanner() {
      setLoaded(false);
      setLoadError("");
      try {
        const db = createClient() as unknown as SupabaseClient;
        const {
          data: { session },
          error: sessionError,
        } = await db.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          throw new Error("Your session was not found. Please sign in again.");
        }
        if (!cancelled) setUserId(session.user.id);

        const requestController = new AbortController();
        activeController = requestController;
        timeoutId = window.setTimeout(() => {
          timedOut = true;
          requestController.abort();
        }, FITNESS_ROUTINE_LOAD_TIMEOUT_MS);

        const [routineResult, exerciseResult] = await Promise.all([
          db
            .from("workout_routines")
            .select("id, name, weekday, is_active, sort_order")
            .eq("user_id", session.user.id)
            .order("weekday", { ascending: true })
            .order("sort_order", { ascending: true })
            .abortSignal(requestController.signal),
          db
            .from("workout_routine_exercises")
            .select("id, routine_id, name, item_type, target_sets, target_reps, target_weight_kg, target_weight_spec, target_duration_minutes, target_distance_km, sort_order")
            .eq("user_id", session.user.id)
            .order("sort_order", { ascending: true })
            .abortSignal(requestController.signal),
        ]);
        if (timedOut) {
          throw new Error("Loading weekly routines took too long. Check your connection and retry.");
        }

        if (routineResult.error) throw routineResult.error;
        if (exerciseResult.error) throw exerciseResult.error;

        const nextRoutines = ((routineResult.data ?? []) as unknown as RoutineRow[]).map(toRoutine);
        const nextExercises = ((exerciseResult.data ?? []) as unknown as RoutineExerciseRow[]).map(toRoutineExercise);
        if (!cancelled) {
          setRoutines(nextRoutines);
          setRoutineExercises(nextExercises);
          setLoadError("");
        }
      } catch (loadFailure) {
        if (!cancelled) setLoadError(timedOut ? "Loading weekly routines took too long. Check your connection and retry." : getErrorMessage(loadFailure, "Could not load weekly routines. Please retry."));
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        activeController = null;
        if (!cancelled) setLoaded(true);
      }
    }

    void loadPlanner();
    return () => { cancelled = true; activeController?.abort(); if (timeoutId !== undefined) window.clearTimeout(timeoutId); };
  }, [retryKey]);

  const dayRoutines = useMemo(
    () => routines.filter((routine) => routine.weekday === viewWeekday).sort((a, b) => a.sortOrder - b.sortOrder),
    [routines, viewWeekday],
  );

  const explicitlySelectedRoutine = dayRoutines.find(
    (routine) => routine.id === selectedRoutineId,
  );
  const effectiveSelectedRoutineId = explicitlySelectedRoutine?.isActive
    ? explicitlySelectedRoutine.id
    : (dayRoutines.find((routine) => routine.isActive)?.id ?? explicitlySelectedRoutine?.id ?? dayRoutines[0]?.id ?? "");
  const selectedRoutine = routines.find(
    (routine) => routine.id === effectiveSelectedRoutineId,
  ) ?? null;
  const selectedRoutineExercises = useMemo(
    () => routineExercises
      .filter((exercise) => exercise.routineId === effectiveSelectedRoutineId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [routineExercises, effectiveSelectedRoutineId],
  );

  function startNewRoutine() {
    setIsPlannerCollapsed(false);
    cancelCustomWorkout();
    setEditingRoutineId(null);
    setRoutineName("");
    setRoutineWeekday(String(viewWeekday));
    setShowRoutineForm(true);
    setShowExerciseForm(false);
    setError("");
    setMessage("");
  }

  function startRoutineEdit(routine: Routine) {
    cancelCustomWorkout();
    setEditingRoutineId(routine.id);
    setRoutineName(routine.name);
    setRoutineWeekday(String(routine.weekday));
    setShowRoutineForm(true);
    setShowExerciseForm(false);
    setError("");
    setMessage("");
  }

  function cancelRoutineForm() {
    setShowRoutineForm(false);
    setEditingRoutineId(null);
    setRoutineName("");
    setError("");
  }

  async function saveRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError("Your session was not found. Please sign in again.");
      return;
    }
    const name = routineName.trim();
    const weekday = Number(routineWeekday);
    if (!name) {
      setError("Enter a name for this workout routine.");
      return;
    }
    if (name.length > 70 || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      setError("Use a routine name of up to 70 characters and choose a valid weekday.");
      return;
    }

    const routineBeingEdited = editingRoutineId
      ? routines.find((routine) => routine.id === editingRoutineId)
      : undefined;
    const nextSortOrder = routineBeingEdited && routineBeingEdited.weekday === weekday
      ? routineBeingEdited.sortOrder
      : routines.filter((routine) => routine.weekday === weekday)
          .reduce((max, routine) => Math.max(max, routine.sortOrder), -1) + 1;

    setBusyAction("save-routine");
    setError("");
    setMessage("");
    try {
      const db = createClient() as unknown as SupabaseClient;
      const result = editingRoutineId
        ? await db
            .from("workout_routines")
            .update({ name, weekday, sort_order: nextSortOrder, updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("id", editingRoutineId)
            .select("id, name, weekday, is_active, sort_order")
            .single()
        : await db
            .from("workout_routines")
            .insert({
              id: crypto.randomUUID(),
              user_id: userId,
              name,
              weekday,
              is_active: true,
              sort_order: nextSortOrder,
            })
            .select("id, name, weekday, is_active, sort_order")
            .single();
      if (result.error) throw result.error;
      const saved = toRoutine(result.data as unknown as RoutineRow);
      setRoutines((current) => editingRoutineId
        ? current.map((routine) => routine.id === saved.id ? saved : routine)
        : [...current, saved]);
      setViewWeekday(saved.weekday);
      setSelectedRoutineId(saved.id);
      setShowRoutineForm(false);
      setEditingRoutineId(null);
      setRoutineName("");
      setMessage(editingRoutineId ? "Routine updated." : "Routine created.");
    } catch (saveFailure) {
      setError(getErrorMessage(saveFailure, "Could not save the routine. Please retry."));
    } finally {
      setBusyAction("");
    }
  }

  async function deleteRoutine(routine: Routine) {
    if (!userId) return;
    cancelCustomWorkout();
    setBusyAction(`delete-routine-${routine.id}`);
    setError("");
    try {
      const db = createClient() as unknown as SupabaseClient;
      const { error: deleteError } = await db
        .from("workout_routines")
        .delete()
        .eq("user_id", userId)
        .eq("id", routine.id);
      if (deleteError) throw deleteError;
      setRoutines((current) => current.filter((item) => item.id !== routine.id));
      setRoutineExercises((current) => current.filter((item) => item.routineId !== routine.id));
      setPendingDeleteRoutineId(null);
      if (selectedRoutineId === routine.id) setSelectedRoutineId("");
      setMessage("Routine deleted.");
    } catch (deleteFailure) {
      setError(getErrorMessage(deleteFailure, "Could not delete the routine. Please retry."));
    } finally {
      setBusyAction("");
    }
  }

  async function toggleRoutineActive(routine: Routine) {
    if (!userId) return;
    cancelCustomWorkout();
    setBusyAction(`toggle-routine-${routine.id}`);
    setError("");
    try {
      const db = createClient() as unknown as SupabaseClient;
      const { data, error: updateError } = await db
        .from("workout_routines")
        .update({ is_active: !routine.isActive, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", routine.id)
        .select("id, name, weekday, is_active, sort_order")
        .single();
      if (updateError) throw updateError;
      const updated = toRoutine(data as unknown as RoutineRow);
      setRoutines((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(updated.isActive ? "Routine activated." : "Routine paused.");
    } catch (updateFailure) {
      setError(getErrorMessage(updateFailure, "Could not update this routine. Please retry."));
    } finally {
      setBusyAction("");
    }
  }

  function startNewRoutineExercise() {
    cancelCustomWorkout();
    if (!selectedRoutine) {
      setError("Create or select a routine first.");
      return;
    }
    setEditingRoutineExerciseId(null);
    setExerciseDraft(EMPTY_EXERCISE_DRAFT);
    setShowExerciseForm(true);
    setShowRoutineForm(false);
    setError("");
    setMessage("");
  }

  function startRoutineExerciseEdit(exercise: RoutineExercise) {
    cancelCustomWorkout();
    setEditingRoutineExerciseId(exercise.id);
    setExerciseDraft({
      name: exercise.name,
      sets: String(exercise.targetSets ?? 3),
      reps: String(exercise.targetReps ?? 10),
      weight: getFitnessWeightText(exercise.targetWeightSpec, exercise.targetWeightKg),
    });
    setShowExerciseForm(true);
    setShowRoutineForm(false);
    setError("");
    setMessage("");
  }

  async function saveRoutineExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !selectedRoutine) {
      setError("Select a routine first, then add its exercises.");
      return;
    }
    const name = exerciseDraft.name.trim();
    const sets = Number(exerciseDraft.sets);
    const reps = Number(exerciseDraft.reps);
    const weightResult = parseFitnessWeightSpec(exerciseDraft.weight);
    if (!name || name.length > 80) {
      setError("Enter an exercise name up to 80 characters.");
      return;
    }
    if (!Number.isInteger(sets) || sets < 1 || sets > 30 || !Number.isInteger(reps) || reps < 1 || reps > 200) {
      setError("Sets must be 1–30 and reps must be 1–200.");
      return;
    }
    if (!weightResult.valid) {
      setError(weightResult.error ?? "Enter a valid weight, range, or comma-separated weight list.");
      return;
    }

    setBusyAction("save-routine-exercise");
    setError("");
    try {
      const db = createClient() as unknown as SupabaseClient;
      const payload = {
        name,
        item_type: "strength",
        target_sets: sets,
        target_reps: reps,
        target_weight_kg: weightResult.numericValue,
        target_weight_spec: weightResult.value,
        target_duration_minutes: null,
        target_distance_km: null,
        updated_at: new Date().toISOString(),
      };
      const result = editingRoutineExerciseId
        ? await db
            .from("workout_routine_exercises")
            .update(payload)
            .eq("user_id", userId)
            .eq("routine_id", selectedRoutine.id)
            .eq("id", editingRoutineExerciseId)
            .select("id, routine_id, name, item_type, target_sets, target_reps, target_weight_kg, target_weight_spec, target_duration_minutes, target_distance_km, sort_order")
            .single()
        : await db
            .from("workout_routine_exercises")
            .insert({
              id: crypto.randomUUID(),
              user_id: userId,
              routine_id: selectedRoutine.id,
              ...payload,
              sort_order: selectedRoutineExercises.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
            })
            .select("id, routine_id, name, item_type, target_sets, target_reps, target_weight_kg, target_weight_spec, target_duration_minutes, target_distance_km, sort_order")
            .single();
      if (result.error) throw result.error;
      const saved = toRoutineExercise(result.data as unknown as RoutineExerciseRow);
      setRoutineExercises((current) => editingRoutineExerciseId
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setShowExerciseForm(false);
      setEditingRoutineExerciseId(null);
      setExerciseDraft(EMPTY_EXERCISE_DRAFT);
      setMessage(editingRoutineExerciseId ? "Routine exercise updated." : "Exercise added to routine.");
    } catch (saveFailure) {
      setError(getErrorMessage(saveFailure, "Could not save this routine exercise. Please retry."));
    } finally {
      setBusyAction("");
    }
  }

  async function deleteRoutineExercise(exercise: RoutineExercise) {
    if (!userId || !selectedRoutine) return;
    cancelCustomWorkout();
    setBusyAction(`delete-exercise-${exercise.id}`);
    setError("");
    try {
      const db = createClient() as unknown as SupabaseClient;
      const { error: deleteError } = await db
        .from("workout_routine_exercises")
        .delete()
        .eq("user_id", userId)
        .eq("routine_id", selectedRoutine.id)
        .eq("id", exercise.id);
      if (deleteError) throw deleteError;
      setRoutineExercises((current) => current.filter((item) => item.id !== exercise.id));
      setPendingDeleteExerciseId(null);
      setMessage("Exercise removed from this routine. Saved workouts remain unchanged.");
    } catch (deleteFailure) {
      setError(getErrorMessage(deleteFailure, "Could not remove this exercise. Please retry."));
    } finally {
      setBusyAction("");
    }
  }

  function startCustomWorkout(routine: Routine) {
    if (!selectedDate) {
      setError("Choose a workout date first.");
      return;
    }
    if (!routine.isActive) {
      setError("Activate this routine before using it for a workout.");
      return;
    }

    const templateItems = routineExercises
      .filter((item) => item.routineId === routine.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (templateItems.some((item) => item.itemType === "cardio")) {
      setError("This routine contains cardio items. Cardio snapshot support will be added in the next Fitness feature pass.");
      return;
    }
    if (templateItems.length === 0) {
      setError("Add at least one strength exercise to this routine before customizing it.");
      return;
    }

    const currentDay = existingWorkout?.date === selectedDate ? existingWorkout : null;
    const usedIds = new Set<string>();
    const drafts: CustomWorkoutExerciseDraft[] = templateItems.map((item) => {
      const matched = currentDay?.exercises.find((exercise) =>
        !usedIds.has(exercise.id) &&
        exercise.name.trim().toLocaleLowerCase() === item.name.trim().toLocaleLowerCase()
      );
      if (matched) usedIds.add(matched.id);
      return {
        draftId: crypto.randomUUID(),
        existingExerciseId: matched?.id ?? null,
        name: item.name,
        sets: String(matched?.sets ?? item.targetSets ?? 3),
        reps: String(matched?.reps ?? item.targetReps ?? 10),
        weight: matched
          ? getFitnessWeightText(matched.weightSpec, matched.weight)
          : getFitnessWeightText(item.targetWeightSpec, item.targetWeightKg),
      };
    });

    setCustomWorkoutTitle(routine.name);
    setCustomWorkoutExercises(drafts);
    setCustomWorkoutContext({ selectedDate, contextRevision, weekday: viewWeekday });
    setShowCustomWorkout(true);
    setIsPlannerCollapsed(false);
    setShowExerciseForm(false);
    setShowRoutineForm(false);
    setError("");
    setMessage("");
  }

  function cancelCustomWorkout() {
    setShowCustomWorkout(false);
    setCustomWorkoutContext(null);
    setCustomWorkoutTitle("");
    setCustomWorkoutExercises([]);
    setError("");
  }

  function updateCustomWorkoutExercise(draftId: string, patch: Partial<CustomWorkoutExerciseDraft>) {
    setCustomWorkoutExercises((current) => current.map((item) =>
      item.draftId === draftId ? { ...item, ...patch } : item,
    ));
  }

  function addCustomWorkoutExercise() {
    setCustomWorkoutExercises((current) => [...current, {
      draftId: crypto.randomUUID(),
      name: "",
      sets: "3",
      reps: "10",
      weight: "",
    }]);
    setError("");
  }

  function removeCustomWorkoutExercise(draftId: string) {
    setCustomWorkoutExercises((current) => current.filter((item) => item.draftId !== draftId));
    setError("");
  }

  function moveCustomWorkoutExercise(draftId: string, direction: -1 | 1) {
    setCustomWorkoutExercises((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((item) => item.draftId === draftId);
      const toIndex = fromIndex + direction;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= next.length) return current;
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  }

  async function moveRoutineExercise(exerciseId: string, direction: -1 | 1) {
    if (!userId || !selectedRoutine) return;
    const ordered = [...selectedRoutineExercises];
    const fromIndex = ordered.findIndex((item) => item.id === exerciseId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= ordered.length || busyAction !== "") return;

    const moving = ordered[fromIndex];
    const target = ordered[toIndex];
    setBusyAction(`reorder-${selectedRoutine.id}`);
    setError("");
    setMessage("");
    try {
      const db = createClient() as unknown as SupabaseClient;
      const [movingResult, targetResult] = await Promise.all([
        db.from("workout_routine_exercises")
          .update({ sort_order: target.sortOrder, updated_at: new Date().toISOString() })
          .eq("user_id", userId).eq("routine_id", selectedRoutine.id).eq("id", moving.id),
        db.from("workout_routine_exercises")
          .update({ sort_order: moving.sortOrder, updated_at: new Date().toISOString() })
          .eq("user_id", userId).eq("routine_id", selectedRoutine.id).eq("id", target.id),
      ]);
      if (movingResult.error) throw movingResult.error;
      if (targetResult.error) throw targetResult.error;

      setRoutineExercises((current) => current.map((item) => {
        if (item.id === moving.id) return { ...item, sortOrder: target.sortOrder };
        if (item.id === target.id) return { ...item, sortOrder: moving.sortOrder };
        return item;
      }));
      setMessage("Exercise order updated. Future snapshots will use this order; saved workouts stay unchanged.");
    } catch (reorderFailure) {
      setError(getErrorMessage(reorderFailure, "Could not change the exercise order. Reloading the saved order."));
      setRetryKey((value) => value + 1);
    } finally {
      setBusyAction("");
    }
  }
  async function applyRoutine(routine: Routine, customDraft?: CustomWorkoutDraftPayload) {
    if (!userId || !selectedDate) {
      setError("Your session or selected date is missing. Please try again.");
      return;
    }
    if (!routine.isActive) {
      setError("Activate this routine before using it for a workout.");
      return;
    }

    const templateItems = routineExercises
      .filter((item) => item.routineId === routine.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    let workoutTitle = routine.name.trim();
    let sourceExercises: Array<{
      name: string;
      sets: number;
      reps: number;
      weight: number | null;
      weightSpec: string | null;
      existingExerciseId: string | null;
    }>;

    if (customDraft) {
      workoutTitle = customDraft.title.trim();
      if (!workoutTitle || workoutTitle.length > 70) {
        setError("Enter a workout title up to 70 characters.");
        return;
      }
      if (customDraft.exercises.length < 1 || customDraft.exercises.length > 30) {
        setError("A custom workout needs 1–30 exercises.");
        return;
      }

      const parsed: Array<{
        name: string;
        sets: number;
        reps: number;
        weight: number | null;
        weightSpec: string | null;
        existingExerciseId: string | null;
      }> = [];
      for (const [index, item] of customDraft.exercises.entries()) {
        const name = item.name.trim();
        const sets = Number(item.sets);
        const reps = Number(item.reps);
        const weightResult = parseFitnessWeightSpec(item.weight);
        if (!name || name.length > 80) {
          setError(`Exercise ${index + 1}: enter a name up to 80 characters.`);
          return;
        }
        if (!Number.isInteger(sets) || sets < 1 || sets > 30 || !Number.isInteger(reps) || reps < 1 || reps > 200) {
          setError(`Exercise ${index + 1}: sets must be 1–30 and reps must be 1–200.`);
          return;
        }
        if (!weightResult.valid) {
          setError(`Exercise ${index + 1}: ${weightResult.error ?? "enter a valid weight specification."}`);
          return;
        }
        parsed.push({
          name,
          sets,
          reps,
          weight: weightResult.numericValue,
          weightSpec: weightResult.value,
          existingExerciseId: item.existingExerciseId ?? null,
        });
      }
      sourceExercises = parsed;
    } else {
      if (templateItems.some((item) => item.itemType === "cardio")) {
        setError("This routine contains cardio targets. Cardio workout snapshots are not supported yet; no changes were made.");
        return;
      }
      if (templateItems.length === 0) {
        setError("Add at least one strength exercise before creating a workout.");
        return;
      }
      const parsedTemplateItems = templateItems.map((item) => ({
        item,
        weightResult: parseFitnessWeightSpec(
          getFitnessWeightText(item.targetWeightSpec, item.targetWeightKg),
        ),
      }));
      const invalidTemplateWeight = parsedTemplateItems.find(({ weightResult }) => !weightResult.valid);
      if (invalidTemplateWeight) {
        setError(
          `The routine has an invalid weight for ${invalidTemplateWeight.item.name}: ${invalidTemplateWeight.weightResult.error ?? "check the weight specification."}`,
        );
        return;
      }
      sourceExercises = parsedTemplateItems.map(({ item, weightResult }) => ({
        name: item.name,
        sets: item.targetSets ?? 3,
        reps: item.targetReps ?? 10,
        weight: weightResult.numericValue,
        weightSpec: weightResult.value,
        existingExerciseId: null,
      }));
    }

    const currentDay = existingWorkout?.date === selectedDate ? existingWorkout : null;
    const existingExercises = currentDay?.exercises ?? [];
    const usedExistingIds = new Set<string>();
    const normalizedName = (value: string) => value.trim().toLocaleLowerCase();
    const exercisesPayload = sourceExercises.map((item, index) => {
      let existingId = item.existingExerciseId;
      if (!existingId || usedExistingIds.has(existingId) || !existingExercises.some((exercise) => exercise.id === existingId)) {
        existingId = null;
      }
      if (!existingId) {
        const match = existingExercises.find((exercise) =>
          !usedExistingIds.has(exercise.id) && normalizedName(exercise.name) === normalizedName(item.name)
        );
        existingId = match?.id ?? null;
      }
      if (existingId) usedExistingIds.add(existingId);
      return {
        existing_id: existingId,
        name: item.name,
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight,
        weight_spec: item.weightSpec,
        sort_order: index,
      };
    });

    setBusyAction(`apply-routine-${routine.id}`);
    setError("");
    setMessage("");
    try {
      const syncClient = createClient() as unknown as {
        rpc: (functionName: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      };
      const { data, error: syncError } = await syncClient.rpc("sync_fitness_workout_from_routine", {
        p_routine_id: routine.id,
        p_workout_date: selectedDate,
        p_title: workoutTitle.slice(0, 70),
        p_exercises: exercisesPayload,
      });
      if (syncError) throw syncError;
      if (!data || typeof data !== "object") {
        throw new Error("The database did not return the saved workout. Reload Fitness before retrying.");
      }

      const payload = data as Record<string, unknown>;
      if (!Array.isArray(payload.exercises)) {
        throw new Error("The saved workout response was incomplete. Reload Fitness before retrying.");
      }
      const snapshot: WorkoutSnapshot = {
        date: typeof payload.date === "string" ? payload.date : selectedDate,
        title: typeof payload.title === "string" ? payload.title : workoutTitle.slice(0, 70),
        exercises: payload.exercises.map((entry) => {
          const exercise = entry as Record<string, unknown>;
          return {
            id: String(exercise.id),
            name: String(exercise.name),
            sets: Number(exercise.sets),
            reps: Number(exercise.reps),
            weight: exercise.weight == null ? null : Number(exercise.weight),
            weightSpec: exercise.weightSpec == null ? null : String(exercise.weightSpec),
            completed: Boolean(exercise.completed),
          };
        }),
      };

      onWorkoutCreated(snapshot);
      setShowCustomWorkout(false);
      setCustomWorkoutContext(null);
      setCustomWorkoutTitle("");
      setCustomWorkoutExercises([]);
      setMessage(currentDay
        ? `Workout updated for ${formatDate(selectedDate)}. Completion checks were kept for exercises that still exist.`
        : customDraft
          ? `Custom workout saved for ${formatDate(selectedDate)}. Your reusable routine was not changed.`
          : `Routine copied to ${formatDate(selectedDate)}. Later template edits will not change this saved workout.`);
    } catch (applyFailure) {
      setError(getErrorMessage(applyFailure, "Could not save this workout. Please retry."));
    } finally {
      setBusyAction("");
    }
  }

  if (!loaded) {
    return <section className="panel fitness-routine-panel">Loading weekly routines…</section>;
  }

  if (loadError) {
    return (
      <section className="panel fitness-routine-panel">
        <div className="fitness-routine-header">
          <div>
            <h2>Weekly routine planner</h2>
            <p>Could not load your routines.</p>
          </div>
          <button type="button" className="text-button" onClick={() => setRetryKey((value) => value + 1)}>
            Try again
          </button>
        </div>
        <p className="fitness-error" role="alert">{loadError}</p>
      </section>
    );
  }

  return (
    <section className="panel fitness-routine-panel">
      <div className="fitness-routine-header">
        <div className="fitness-routine-title">
          <span className="fitness-kicker">REPEATABLE TRAINING PLAN</span>
          <h2><CalendarDays size={17} /> Weekly routine planner</h2>
          <p>Create reusable workouts by weekday. Applying one makes a separate dated workout, so future template edits do not rewrite your history.</p>
        </div>
        <div className="fitness-routine-header-actions">
          <button
            type="button"
            className="fitness-routine-collapse-toggle"
            aria-expanded={!isPlannerCollapsed}
            aria-controls="fitness-routine-planner-body"
            aria-label={isPlannerCollapsed ? "Expand weekly routine planner" : "Collapse weekly routine planner"}
            title={isPlannerCollapsed ? "Expand planner" : "Collapse planner"}
            onClick={() => setIsPlannerCollapsed((current) => !current)}
          >
            {isPlannerCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
          <button type="button" className="primary-button" onClick={startNewRoutine} disabled={busyAction !== ""}>
            <Plus size={15} /> New routine
          </button>
        </div>
      </div>

      <div id="fitness-routine-planner-body" className="fitness-routine-body" hidden={isPlannerCollapsed}>
      <div className="fitness-routine-day-navigation">
        <div className="fitness-routine-day-heading">
          <div>
            <strong>Weekly schedule</strong>
            <span>Select a day to create or manage its reusable routines.</span>
          </div>
          {viewWeekday !== weekdayForDate(selectedDate) && (
            <button type="button" className="fitness-routine-small-button" onClick={() => { cancelCustomWorkout(); setViewWeekday(weekdayForDate(selectedDate)); setError(""); setMessage(""); }}>
              Use date&apos;s day
            </button>
          )}
        </div>
        <div className="fitness-routine-weekday-tabs" role="group" aria-label="Weekly routine weekdays">
          {WEEKDAYS.map((day) => {
            const dayRoutinesForTab = routines.filter((routine) => routine.weekday === day.value);
            const activeCount = dayRoutinesForTab.filter((routine) => routine.isActive).length;
            const selected = viewWeekday === day.value;
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={selected}
                className={`fitness-routine-weekday-tab${selected ? " active" : ""}${day.value === weekdayForDate(selectedDate) ? " date-day" : ""}`}
                onClick={() => { cancelCustomWorkout(); setViewWeekday(day.value); setError(""); setMessage(""); }}
              >
                <span>{day.label}</span>
                <small>{dayRoutinesForTab.length === 0 ? "No routine" : `${activeCount} active · ${dayRoutinesForTab.length} total`}</small>
              </button>
            );
          })}
        </div>
        <div className="fitness-routine-date-context">
          <div>
            <span>Workout date</span>
            <strong>{formatDate(selectedDate)}</strong>
            <small>{viewWeekday === weekdayForDate(selectedDate)
              ? `${WEEKDAYS[viewWeekday]?.label ?? "Selected day"} routines are automatically selected for this date.`
              : `Browsing ${WEEKDAYS[viewWeekday]?.label ?? "selected day"} templates. The workout date remains ${formatDate(selectedDate)}.`}</small>
          </div>
          <span className="fitness-routine-auto-badge">
            {viewWeekday === weekdayForDate(selectedDate) ? "DATE MATCH" : "TEMPLATE BROWSING"}
          </span>
        </div>
      </div>

      {showRoutineForm && (
        <form className="fitness-routine-edit-form" onSubmit={saveRoutine}>
          <div className="fitness-form-heading">
            <div>
              <h3>{editingRoutineId ? "Edit routine" : "Create a weekly routine"}</h3>
              <p>Choose the weekday and give the routine a clear name.</p>
            </div>
            <button type="button" className="fitness-close-button" aria-label="Close routine form" onClick={cancelRoutineForm} disabled={busyAction !== ""}><X size={15} /></button>
          </div>
          <div className="fitness-routine-form-grid">
            <label className="academics-field">
              <span>Routine name</span>
              <input value={routineName} onChange={(event) => setRoutineName(event.target.value)} maxLength={70} placeholder="e.g. Chest + Triceps" required />
            </label>
            <label className="academics-field">
              <span>Weekly day</span>
              <select value={routineWeekday} onChange={(event) => setRoutineWeekday(event.target.value)}>
                {WEEKDAYS.map((day) => <option key={day.value} value={String(day.value)}>{day.label}</option>)}
              </select>
            </label>
          </div>
          <div className="academics-form-actions">
            <button type="button" className="text-button academics-cancel" onClick={cancelRoutineForm} disabled={busyAction !== ""}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busyAction !== ""}><Save size={15} /> {busyAction === "save-routine" ? "Saving…" : "Save routine"}</button>
          </div>
        </form>
      )}

      <div className={`fitness-routine-layout${dayRoutines.length === 0 ? " empty" : ""}`}>
        <div className="fitness-routine-list-column">
          <div className="fitness-routine-subheading">
            <h3>{WEEKDAYS[viewWeekday]?.label ?? "Selected day"} routines</h3>
            <span>{dayRoutines.length} saved</span>
          </div>
          {dayRoutines.length === 0 ? (
            <div className="fitness-routine-empty">
              <Dumbbell size={22} />
              <strong>No routine for this weekday yet</strong>
              <span>Create a routine, then add its planned exercises.</span>
              <button type="button" className="text-button" onClick={startNewRoutine}>Create routine</button>
            </div>
          ) : (
            <div className="fitness-routine-list">
              {dayRoutines.map((routine) => {
                const exerciseCount = routineExercises.filter((item) => item.routineId === routine.id).length;
                const isSelected = routine.id === effectiveSelectedRoutineId;
                return (
                  <article key={routine.id} className={`fitness-routine-item${isSelected ? " selected" : ""}`}>
                    <button type="button" className="fitness-routine-select" onClick={() => { cancelCustomWorkout(); setSelectedRoutineId(routine.id); setError(""); setMessage(""); }} aria-pressed={isSelected}>
                      <strong>{routine.name}</strong>
                      <span>{exerciseCount} exercises · {routine.isActive ? "Active" : "Paused"}</span>
                    </button>
                    <div className="fitness-routine-actions">
                      <button type="button" className="fitness-routine-icon-button" title="Edit routine" aria-label={`Edit ${routine.name}`} onClick={() => startRoutineEdit(routine)} disabled={busyAction !== ""}><Pencil size={14} /></button>
                      <button type="button" className="fitness-routine-small-button" onClick={() => void toggleRoutineActive(routine)} disabled={busyAction !== ""}>{routine.isActive ? "Pause" : "Activate"}</button>
                      {pendingDeleteRoutineId === routine.id ? (
                        <div className="fitness-routine-confirm" role="group" aria-label={`Confirm deleting ${routine.name}`}>
                          <span>Delete routine?</span>
                          <button type="button" onClick={() => void deleteRoutine(routine)} disabled={busyAction !== ""}>Confirm</button>
                          <button type="button" onClick={() => setPendingDeleteRoutineId(null)} disabled={busyAction !== ""}>Cancel</button>
                        </div>
                      ) : (
                        <button type="button" className="fitness-routine-icon-button danger" title="Delete routine" aria-label={`Delete ${routine.name}`} onClick={() => setPendingDeleteRoutineId(routine.id)} disabled={busyAction !== ""}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {dayRoutines.length > 0 && (
          <div className="fitness-routine-detail">
          {selectedRoutine ? (
            <>
              <div className="fitness-routine-subheading">
                <div>
                  <h3>{selectedRoutine.name}</h3>
                  <span>{WEEKDAYS[selectedRoutine.weekday]?.label ?? "Weekly"} · {selectedRoutine.isActive ? "Active" : "Paused"}</span>
                </div>
                <button type="button" className="text-button" onClick={startNewRoutineExercise} disabled={busyAction !== ""}><Plus size={14} /> Add exercise</button>
              </div>

              {selectedRoutineExercises.length === 0 ? (
                <div className="fitness-routine-empty compact">
                  <strong>No exercises in this routine</strong>
                  <span>Add the planned sets, reps, and optional weight.</span>
                </div>
              ) : (
                <div className="fitness-routine-exercise-list">
                  {selectedRoutineExercises.map((exercise, exerciseIndex) => (
                    <article key={exercise.id} className="fitness-routine-exercise-item">
                      <div className="fitness-routine-exercise-copy">
                        <strong>{exercise.name}</strong>
                        <span>{exercise.targetSets} sets × {exercise.targetReps} reps{formatWeightLabel(exercise.targetWeightSpec, exercise.targetWeightKg)}</span>
                      </div>
                      <div className="fitness-routine-actions fitness-routine-exercise-actions">
                        <button type="button" className="fitness-routine-icon-button" title="Move exercise up" aria-label={`Move ${exercise.name} up`} onClick={() => void moveRoutineExercise(exercise.id, -1)} disabled={busyAction !== "" || exerciseIndex === 0}><ArrowUp size={14} /></button>
                        <button type="button" className="fitness-routine-icon-button" title="Move exercise down" aria-label={`Move ${exercise.name} down`} onClick={() => void moveRoutineExercise(exercise.id, 1)} disabled={busyAction !== "" || exerciseIndex === selectedRoutineExercises.length - 1}><ArrowDown size={14} /></button>
                        <button type="button" className="fitness-routine-icon-button" title="Edit exercise" aria-label={`Edit ${exercise.name}`} onClick={() => startRoutineExerciseEdit(exercise)} disabled={busyAction !== ""}><Pencil size={14} /></button>
                        {pendingDeleteExerciseId === exercise.id ? (
                          <div className="fitness-routine-confirm" role="group" aria-label={`Confirm deleting ${exercise.name}`}>
                            <span>Remove?</span>
                            <button type="button" onClick={() => void deleteRoutineExercise(exercise)} disabled={busyAction !== ""}>Confirm</button>
                            <button type="button" onClick={() => setPendingDeleteExerciseId(null)} disabled={busyAction !== ""}>Cancel</button>
                          </div>
                        ) : (
                          <button type="button" className="fitness-routine-icon-button danger" title="Remove exercise" aria-label={`Remove ${exercise.name}`} onClick={() => setPendingDeleteExerciseId(exercise.id)} disabled={busyAction !== ""}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {showExerciseForm && (
                <form className="fitness-routine-edit-form" onSubmit={saveRoutineExercise}>
                  <div className="fitness-form-heading">
                    <div>
                      <h3>{editingRoutineExerciseId ? "Edit planned exercise" : "Add planned exercise"}</h3>
                      <p>These are targets. Actual set results will be recorded separately.</p>
                    </div>
                    <button type="button" className="fitness-close-button" aria-label="Close exercise form" onClick={() => { setShowExerciseForm(false); setEditingRoutineExerciseId(null); setExerciseDraft(EMPTY_EXERCISE_DRAFT); setError(""); }} disabled={busyAction !== ""}><X size={15} /></button>
                  </div>
                  <label className="academics-field">
                    <span>Exercise name</span>
                    <input value={exerciseDraft.name} onChange={(event) => setExerciseDraft((current) => ({ ...current, name: event.target.value }))} maxLength={80} placeholder="e.g. Bench press" required />
                  </label>
                  <div className="fitness-routine-form-grid triple">
                    <label className="academics-field"><span>Sets</span><input type="number" min={1} max={30} step={1} value={exerciseDraft.sets} onChange={(event) => setExerciseDraft((current) => ({ ...current, sets: event.target.value }))} required /></label>
                    <label className="academics-field"><span>Target reps</span><input type="number" min={1} max={200} step={1} value={exerciseDraft.reps} onChange={(event) => setExerciseDraft((current) => ({ ...current, reps: event.target.value }))} required /></label>
                    <label className="academics-field fitness-routine-weight-field">
                      <span>Weight (kg, optional)</span>
                      <input
                        type="text"
                        inputMode="text"
                        maxLength={64}
                        aria-describedby="fitness-routine-weight-help"
                        value={exerciseDraft.weight}
                        onChange={(event) => setExerciseDraft((current) => ({ ...current, weight: event.target.value }))}
                        placeholder="e.g. 30, 40-55, 50"
                      />
                      <small id="fitness-routine-weight-help" className="fitness-routine-field-help">
                        Use one weight, a range (40-55), or a list (30,40-55,50). Leave blank if not needed.
                      </small>
                    </label>
                  </div>
                  <div className="academics-form-actions">
                    <button type="button" className="text-button academics-cancel" onClick={() => { setShowExerciseForm(false); setEditingRoutineExerciseId(null); setExerciseDraft(EMPTY_EXERCISE_DRAFT); setError(""); }} disabled={busyAction !== ""}>Cancel</button>
                    <button type="submit" className="primary-button" disabled={busyAction !== ""}><Save size={15} /> {busyAction === "save-routine-exercise" ? "Saving…" : "Save exercise"}</button>
                  </div>
                </form>
              )}

              {showCustomWorkoutForCurrentContext && (
                <section id="fitness-custom-workout-editor" className="fitness-custom-workout-editor" aria-label="Customize dated workout">
                  <div className="fitness-custom-workout-heading">
                    <div>
                      <h3>Customize this workout</h3>
                      <p>Changes here affect only {formatDate(selectedDate)}. Your reusable weekly routine stays unchanged.</p>
                    </div>
                    <button type="button" className="fitness-routine-icon-button" aria-label="Cancel workout customization" title="Cancel customization" onClick={cancelCustomWorkout} disabled={busyAction !== ""}><X size={15} /></button>
                  </div>
                  <label className="academics-field">
                    <span>Workout title</span>
                    <input value={customWorkoutTitle} onChange={(event) => setCustomWorkoutTitle(event.target.value)} maxLength={70} required />
                  </label>
                  <div className="fitness-custom-exercise-list">
                    {customWorkoutExercises.map((draft, index) => (
                      <div className="fitness-custom-exercise-row" key={draft.draftId}>
                        <label className="academics-field custom-name-field">
                          <span>Exercise {index + 1}</span>
                          <input value={draft.name} onChange={(event) => updateCustomWorkoutExercise(draft.draftId, { name: event.target.value })} maxLength={80} required />
                        </label>
                        <label className="academics-field">
                          <span>Sets</span>
                          <input type="number" min={1} max={30} step={1} inputMode="numeric" value={draft.sets} onChange={(event) => updateCustomWorkoutExercise(draft.draftId, { sets: event.target.value })} required />
                        </label>
                        <label className="academics-field">
                          <span>Target reps</span>
                          <input type="number" min={1} max={200} step={1} inputMode="numeric" value={draft.reps} onChange={(event) => updateCustomWorkoutExercise(draft.draftId, { reps: event.target.value })} required />
                        </label>
                        <label className="academics-field">
                          <span>Weight (kg)</span>
                          <input type="text" inputMode="text" maxLength={64} value={draft.weight} onChange={(event) => updateCustomWorkoutExercise(draft.draftId, { weight: event.target.value })} placeholder="30, 40-55" aria-describedby={`fitness-custom-weight-help-${draft.draftId}`} />
                          <small id={`fitness-custom-weight-help-${draft.draftId}`} className="fitness-routine-field-help">Value, range, or comma-separated list.</small>
                        </label>
                        <div className="fitness-custom-exercise-actions">
                          <button type="button" className="fitness-routine-icon-button" title="Move exercise up" aria-label={`Move ${draft.name || `exercise ${index + 1}`} up in this workout`} onClick={() => moveCustomWorkoutExercise(draft.draftId, -1)} disabled={busyAction !== "" || index === 0}><ArrowUp size={14} /></button>
                          <button type="button" className="fitness-routine-icon-button" title="Move exercise down" aria-label={`Move ${draft.name || `exercise ${index + 1}`} down in this workout`} onClick={() => moveCustomWorkoutExercise(draft.draftId, 1)} disabled={busyAction !== "" || index === customWorkoutExercises.length - 1}><ArrowDown size={14} /></button>
                          <button type="button" className="fitness-routine-icon-button danger custom-remove-button" title="Remove this exercise" aria-label={`Remove ${draft.name || `exercise ${index + 1}`} from custom workout`} onClick={() => removeCustomWorkoutExercise(draft.draftId)} disabled={busyAction !== ""}><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="fitness-custom-workout-actions">
                    <button type="button" className="text-button" onClick={addCustomWorkoutExercise} disabled={busyAction !== "" || customWorkoutExercises.length >= 30}><Plus size={14} /> Add exercise</button>
                    <div>
                      <button type="button" className="text-button academics-cancel" onClick={cancelCustomWorkout} disabled={busyAction !== ""}>Cancel</button>
                      <button type="button" className="primary-button" onClick={() => void applyRoutine(selectedRoutine!, { title: customWorkoutTitle, exercises: customWorkoutExercises })} disabled={busyAction !== "" || !selectedDate || customWorkoutExercises.length === 0}><Save size={15} /> {busyAction === `apply-routine-${selectedRoutine?.id}` ? "Saving workout…" : "Save custom workout"}</button>
                    </div>
                  </div>
                  {hasWorkoutOnDate && <p className="fitness-routine-inline-note">Saving here updates the selected date in place. Matching exercises keep their completion checkbox; your reusable template remains unchanged.</p>}
                </section>
              )}
              <div className="fitness-routine-apply">
                <div>
                  <strong>Apply to selected workout date</strong>
                  <span>{formatDate(selectedDate)}</span>
                </div>
                <div className="fitness-routine-create-actions">
                  <button type="button" className="text-button" onClick={() => startCustomWorkout(selectedRoutine)} disabled={busyAction !== "" || !selectedRoutine.isActive || selectedRoutineExercises.length === 0 || selectedRoutineExercises.some((item) => item.itemType === "cardio") || !selectedDate}>
                    <Pencil size={14} /> Customize first
                  </button>
                  <button type="button" className="primary-button" onClick={() => void applyRoutine(selectedRoutine)} disabled={busyAction !== "" || !selectedRoutine.isActive || selectedRoutineExercises.length === 0 || !selectedDate}>
                    <Check size={15} /> {busyAction === `apply-routine-${selectedRoutine.id}` ? "Saving…" : hasWorkoutOnDate ? "Update from routine" : "Create from routine"}
                  </button>
                </div>
                {hasWorkoutOnDate && <p className="fitness-routine-inline-note">This date already has a workout. Updating syncs its exercise list in place: matching names keep their completed checkbox, new exercises start unchecked, and exercises no longer in the routine are removed.</p>}
                {viewWeekday !== weekdayForDate(selectedDate) && <p className="fitness-routine-inline-note">You are applying a {WEEKDAYS[viewWeekday]?.label ?? "selected day"} routine to {formatDate(selectedDate)}. The workout date will remain unchanged.</p>}
              </div>
              {!selectedRoutine.isActive && <p className="fitness-routine-inline-note">This routine is paused. Activate it to create a dated workout.</p>}
            </>
          ) : (
            <div className="fitness-routine-empty">
              <Dumbbell size={22} />
              <strong>Select a routine to edit its exercises</strong>
              <span>Routine templates stay separate from saved workouts.</span>
            </div>
          )}
          </div>
        )}
      </div>

      {error && <p className="fitness-error" role="alert">{error}</p>}
      {message && <p className="fitness-routine-success" role="status">{message}</p>}
      <p className="fitness-routine-footnote">Applying a routine syncs the selected date to its current strength targets. Matching exercises keep their completion checkbox; new exercises start unchecked. Exercises removed from the template are removed from that dated workout.</p>
      </div>
    </section>
  );
}