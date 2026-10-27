"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Dumbbell,
  GraduationCap,
  Target,
  TrendingUp,
  FolderKanban,
  Sparkles,
} from "lucide-react";

type RangeKey = "7" | "30" | "90" | "all";
type EventKind = "task" | "fitness" | "learning";

type TaskRecord = {
  id: string;
  title: string;
  priority: string;
  completed: boolean;
  date: string;
};

type FitnessExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number | null;
  weightSpec?: string | null;
  completed: boolean;
};

type FitnessDay = {
  date: string;
  title: string;
  exercises: FitnessExercise[];
};

type PracticeSession = {
  id: string;
  date: string;
  minutes: number;
  note: string;
};

type LearningMilestone = {
  id: string;
  title: string;
  completed: boolean;
};

type LearningPath = {
  id: string;
  title: string;
  category: string;
  milestones: LearningMilestone[];
  sessions: PracticeSession[];
  links: { id: string; kind: string; title: string }[];
};

type AssessmentRecord = {
  id: string;
  title: string;
  completed: boolean;
  obtainedMarks: number;
  totalMarks: number;
  resultStatus: string;
};

type CourseRecord = {
  id: string;
  name: string;
  code: string;
  credits: number;
  assessments: AssessmentRecord[];
};

type GradeBand = {
  id: string;
  minMark: number;
  maxMark: number;
  gradePoint: number;
  grade: string;
};

type GoalStats = {
  total: number;
  completed: number;
  milestoneTotal: number;
  milestoneCompleted: number;
};

type AnalyticsEvent = {
  id: string;
  date: string;
  kind: EventKind;
  title: string;
  detail: string;
  minutes?: number;
};

type CourseSummary = {
  id: string;
  name: string;
  code: string;
  credits: number;
  obtained: number;
  possible: number;
  percentage: number | null;
  grade: GradeBand | null;
};

const STORAGE = {
  tasks: "lifeos-tasks-v1",
  trackers: "lifeos-trackers-v1",
  goals: "lifeos-goals-v1",
  fitness: "lifeos-fitness-v1",
  growth: "lifeos-personal-growth-v1",
  academics: "lifeos-academics-v1",
  grading: "lifeos-academic-grading-scale-v1",
  previousRecord: "lifeos-academic-previous-record-v1",
};

const DEFAULT_SCALE: GradeBand[] = [
  { id: "a-plus", minMark: 80, maxMark: 100, gradePoint: 4, grade: "A+" },
  { id: "a", minMark: 75, maxMark: 79, gradePoint: 3.75, grade: "A" },
  { id: "a-minus", minMark: 70, maxMark: 74, gradePoint: 3.5, grade: "A-" },
  { id: "b-plus", minMark: 65, maxMark: 69, gradePoint: 3.25, grade: "B+" },
  { id: "b", minMark: 60, maxMark: 64, gradePoint: 3, grade: "B" },
  { id: "b-minus", minMark: 55, maxMark: 59, gradePoint: 2.75, grade: "B-" },
  { id: "c-plus", minMark: 50, maxMark: 54, gradePoint: 2.5, grade: "C+" },
  { id: "c", minMark: 45, maxMark: 49, gradePoint: 2.25, grade: "C" },
  { id: "d", minMark: 40, maxMark: 44, gradePoint: 2, grade: "D" },
  { id: "f", minMark: 0, maxMark: 39, gradePoint: 0, grade: "F" },
];

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function dayDifference(start: string, end: string): number {
  const a = dateFromKey(start).getTime();
  const b = dateFromKey(end).getTime();
  return Math.round((b - a) / 86_400_000);
}

function formatDate(value: string): string {
  if (!isDateKey(value)) return value || "Unknown date";

  return dateFromKey(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);

  if (hours === 0) return `${remaining} min`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeTasks(value: unknown): TaskRecord[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is TaskRecord => {
    const task = record(item);

    return (
      task !== null &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean" &&
      typeof task.date === "string" &&
      isDateKey(task.date)
    );
  }).map((task) => ({
    ...task,
    priority: typeof task.priority === "string" ? task.priority : "Medium",
  }));
}

function normalizeFitness(value: unknown): FitnessDay[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const day = record(item);

    if (
      !day ||
      typeof day.date !== "string" ||
      !isDateKey(day.date) ||
      typeof day.title !== "string" ||
      !Array.isArray(day.exercises)
    ) {
      return [];
    }

    const exercises: FitnessExercise[] = day.exercises.flatMap((raw) => {
      const exercise = record(raw);

      if (
        !exercise ||
        typeof exercise.id !== "string" ||
        typeof exercise.name !== "string" ||
        typeof exercise.completed !== "boolean"
      ) {
        return [];
      }

      return [{
        id: exercise.id,
        name: exercise.name,
        sets: safeNumber(exercise.sets),
        reps: safeNumber(exercise.reps),
        weight:
          typeof exercise.weight === "number" ? exercise.weight : null,
        weightSpec:
          typeof exercise.weightSpec === "string" ? exercise.weightSpec : null,
        completed: exercise.completed,
      }];
    });

    return [{ date: day.date, title: day.title, exercises }];
  });
}

function normalizeGrowth(value: unknown): LearningPath[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((rawPath) => {
    const path = record(rawPath);

    if (
      !path ||
      typeof path.id !== "string" ||
      typeof path.title !== "string"
    ) {
      return [];
    }

    const milestones: LearningMilestone[] = Array.isArray(path.milestones)
      ? path.milestones.flatMap((rawMilestone) => {
          const milestone = record(rawMilestone);

          if (
            !milestone ||
            typeof milestone.id !== "string" ||
            typeof milestone.title !== "string"
          ) {
            return [];
          }

          return [{
            id: milestone.id,
            title: milestone.title,
            completed: milestone.completed === true,
          }];
        })
      : [];

    const sessions: PracticeSession[] = Array.isArray(path.sessions)
      ? path.sessions.flatMap((rawSession) => {
          const session = record(rawSession);

          if (
            !session ||
            typeof session.id !== "string" ||
            typeof session.date !== "string" ||
            !isDateKey(session.date) ||
            typeof session.minutes !== "number" ||
            !Number.isFinite(session.minutes) ||
            session.minutes < 1
          ) {
            return [];
          }

          return [{
            id: session.id,
            date: session.date,
            minutes: session.minutes,
            note: typeof session.note === "string" ? session.note : "",
          }];
        })
      : [];

    const links = Array.isArray(path.links)
      ? path.links.flatMap((rawLink) => {
          const link = record(rawLink);

          if (
            !link ||
            typeof link.id !== "string" ||
            typeof link.title !== "string" ||
            typeof link.kind !== "string"
          ) {
            return [];
          }

          return [{
            id: link.id,
            title: link.title,
            kind: link.kind,
          }];
        })
      : [];

    return [{
      id: path.id,
      title: path.title,
      category: typeof path.category === "string" ? path.category : "General",
      milestones,
      sessions,
      links,
    }];
  });
}

function normalizeCourses(value: unknown): CourseRecord[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((rawCourse) => {
    const course = record(rawCourse);

    if (
      !course ||
      typeof course.id !== "string" ||
      typeof course.name !== "string" ||
      !Array.isArray(course.assessments)
    ) {
      return [];
    }

    const assessments: AssessmentRecord[] = course.assessments.flatMap(
      (rawAssessment) => {
        const assessment = record(rawAssessment);

        if (
          !assessment ||
          typeof assessment.id !== "string" ||
          typeof assessment.title !== "string"
        ) {
          return [];
        }

        return [{
          id: assessment.id,
          title: assessment.title,
          completed: assessment.completed === true,
          obtainedMarks: Math.max(0, safeNumber(assessment.obtainedMarks)),
          totalMarks: Math.max(0, safeNumber(assessment.totalMarks)),
          resultStatus:
            assessment.resultStatus === "Received" ? "Received" : "Pending",
        }];
      },
    );

    return [{
      id: course.id,
      name: course.name,
      code: typeof course.code === "string" ? course.code : "",
      credits: Math.max(0.5, safeNumber(course.credits, 3)),
      assessments,
    }];
  });
}

function normalizeScale(value: unknown): GradeBand[] {
  if (!Array.isArray(value)) return DEFAULT_SCALE;

  const scale: GradeBand[] = value.flatMap((raw, index) => {
    const item = record(raw);
    if (!item) return [];

    const minMark = safeNumber(item.minMark, -1);
    const maxMark = safeNumber(item.maxMark, -1);
    const gradePoint = safeNumber(item.gradePoint, -1);

    if (
      minMark < 0 ||
      maxMark > 100 ||
      minMark > maxMark ||
      gradePoint < 0 ||
      gradePoint > 5
    ) {
      return [];
    }

    return [{
      id: typeof item.id === "string" ? item.id : `band-${index}`,
      minMark,
      maxMark,
      gradePoint,
      grade: typeof item.grade === "string" ? item.grade : "Grade",
    }];
  });

  return scale.length > 0 ? scale : DEFAULT_SCALE;
}

function getGradeBand(
  scale: GradeBand[],
  percentage: number,
): GradeBand | null {
  return (
    [...scale]
      .sort((a, b) => b.minMark - a.minMark)
      .find(
        (band) =>
          percentage >= band.minMark &&
          (band.maxMark === 100
            ? percentage <= 100
            : percentage < band.maxMark + 1),
      ) ?? null
  );
}

function getGoalStats(value: unknown): GoalStats {
  const container = record(value);

  const goals = Array.isArray(value)
    ? value
    : Array.isArray(container?.goals)
      ? container.goals
      : [];

  let milestoneTotal = 0;
  let milestoneCompleted = 0;
  let completedGoals = 0;
  let validGoals = 0;

  goals.forEach((rawGoal) => {
    const goal = record(rawGoal);
    if (!goal) return;

    validGoals += 1;

    if (
      goal.completed === true ||
      goal.status === "Completed" ||
      goal.status === "completed"
    ) {
      completedGoals += 1;
    }

    const milestones = Array.isArray(goal.milestones)
      ? goal.milestones
      : [];

    milestones.forEach((rawMilestone) => {
      const milestone = record(rawMilestone);
      if (!milestone) return;

      milestoneTotal += 1;

      if (
        milestone.completed === true ||
        milestone.done === true ||
        milestone.isCompleted === true
      ) {
        milestoneCompleted += 1;
      }
    });
  });

  return {
    total: validGoals,
    completed: completedGoals,
    milestoneTotal,
    milestoneCompleted,
  };
}

function getTrackerCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;

  const container = record(value);
  if (!container) return 0;

  for (const key of ["trackers", "items", "data"]) {
    if (Array.isArray(container[key])) return (container[key] as unknown[]).length;
  }

  return 0;
}

function StatCard({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="analytics-stat-card">
      <div className="analytics-stat-top">
        <span className="analytics-stat-icon">{icon}</span>
        <span className="analytics-stat-label">{label}</span>
      </div>
      <strong className="analytics-stat-value">{value}</strong>
      <span className="analytics-stat-note">{note}</span>
    </article>
  );
}

export default function AnalyticsWorkspace() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("30");

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [fitnessDays, setFitnessDays] = useState<FitnessDay[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [gradingScale, setGradingScale] = useState<GradeBand[]>(DEFAULT_SCALE);
  const [previousCgpa, setPreviousCgpa] = useState<number | null>(null);
  const [previousCredits, setPreviousCredits] = useState<number | null>(null);
  const [goalStats, setGoalStats] = useState<GoalStats>({
    total: 0,
    completed: 0,
    milestoneTotal: 0,
    milestoneCompleted: 0,
  });
  const [trackerCount, setTrackerCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalyticsData() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          throw new Error(
            "Your session could not be verified. Please sign in again.",
          );
        }

        const [
          { data: taskRows, error: taskError },
          { data: workoutDayRows, error: workoutDayError },
          { data: exerciseRows, error: exerciseError },
          { data: pathRows, error: pathError },
          { data: milestoneRows, error: milestoneError },
          { data: sessionRows, error: sessionError },
          { data: linkRows, error: linkError },
          { data: courseRows, error: courseError },
          { data: assessmentRows, error: assessmentError },
          { data: gradingRows, error: gradingError },
          { data: academicSettings, error: settingsError },
          { data: goalRows, error: goalError },
          { data: goalMilestoneRows, error: goalMilestoneError },
          { data: trackerRows, error: trackerError },
        ] = await Promise.all([
          supabase
            .from("tasks")
            .select("id, title, priority, completed, task_date")
            .eq("user_id", user.id)
            .order("task_date", { ascending: false }),

          supabase
            .from("workout_days")
            .select("workout_date, title")
            .eq("user_id", user.id)
            .order("workout_date", { ascending: false }),

          supabase
            .from("exercises")
            .select(
              "id, workout_date, name, sets, reps, weight_kg, weight_spec, completed",
            )
            .eq("user_id", user.id)
            .order("sort_order", { ascending: true }),

          supabase
            .from("learning_paths")
            .select("id, title, category")
            .eq("user_id", user.id),

          supabase
            .from("learning_milestones")
            .select("id, learning_path_id, title, completed")
            .eq("user_id", user.id)
            .order("sort_order", { ascending: true }),

          supabase
            .from("practice_sessions")
            .select("id, learning_path_id, practice_date, minutes, note")
            .eq("user_id", user.id)
            .order("practice_date", { ascending: false }),

          supabase
            .from("learning_links")
            .select("id, learning_path_id, title, link_kind")
            .eq("user_id", user.id),

          supabase
            .from("academic_courses")
            .select("id, name, code, credits")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("academic_assessments")
            .select(
              "id, course_id, title, completed, obtained_marks, total_marks, result_status",
            )
            .eq("user_id", user.id),

          supabase
            .from("academic_grading_bands")
            .select("id, min_mark, max_mark, grade_point, grade")
            .eq("user_id", user.id)
            .order("sort_order", { ascending: true }),

          supabase
            .from("academic_settings")
            .select("previous_cgpa, completed_credits")
            .eq("user_id", user.id)
            .maybeSingle(),

          supabase
            .from("goals")
            .select("id")
            .eq("user_id", user.id),

          supabase
            .from("goal_milestones")
            .select("id, goal_id, completed")
            .eq("user_id", user.id),

          supabase
            .from("trackers")
            .select("id")
            .eq("user_id", user.id),
        ]);

        const queryError =
          taskError ??
          workoutDayError ??
          exerciseError ??
          pathError ??
          milestoneError ??
          sessionError ??
          linkError ??
          courseError ??
          assessmentError ??
          gradingError ??
          settingsError ??
          goalError ??
          goalMilestoneError ??
          trackerError;

        if (queryError) throw queryError;

        const cloudTasks: TaskRecord[] = (taskRows ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          priority: row.priority,
          completed: row.completed,
          date: row.task_date,
        }));

        const cloudFitness: FitnessDay[] = (workoutDayRows ?? []).map(
          (day) => ({
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
                weightSpec:
                  exercise.weight_spec == null
                    ? (exercise.weight_kg == null ? null : String(exercise.weight_kg))
                    : String(exercise.weight_spec),
                completed: exercise.completed,
              })),
          }),
        );

        const cloudLearningPaths: LearningPath[] = (pathRows ?? []).map(
          (path) => ({
            id: path.id,
            title: path.title,
            category: path.category,
            milestones: (milestoneRows ?? [])
              .filter((item) => item.learning_path_id === path.id)
              .map((item) => ({
                id: item.id,
                title: item.title,
                completed: item.completed,
              })),
            sessions: (sessionRows ?? [])
              .filter((item) => item.learning_path_id === path.id)
              .map((item) => ({
                id: item.id,
                date: item.practice_date,
                minutes: Number(item.minutes),
                note: item.note ?? "",
              })),
            links: (linkRows ?? [])
              .filter((item) => item.learning_path_id === path.id)
              .map((item) => ({
                id: item.id,
                title: item.title,
                kind: item.link_kind,
              })),
          }),
        );

        const cloudCourses: CourseRecord[] = (courseRows ?? []).map(
          (course) => ({
            id: course.id,
            name: course.name,
            code: course.code,
            credits: Number(course.credits),
            assessments: (assessmentRows ?? [])
              .filter((item) => item.course_id === course.id)
              .map((item) => ({
                id: item.id,
                title: item.title,
                completed: item.completed,
                obtainedMarks: Number(item.obtained_marks),
                totalMarks: Number(item.total_marks),
                resultStatus: item.result_status,
              })),
          }),
        );

        const cloudGradingScale: GradeBand[] =
          (gradingRows ?? []).length > 0
            ? (gradingRows ?? []).map((band) => ({
                id: band.id,
                minMark: Number(band.min_mark),
                maxMark: Number(band.max_mark),
                gradePoint: Number(band.grade_point),
                grade: band.grade,
              }))
            : DEFAULT_SCALE;

        const goalMilestones = goalMilestoneRows ?? [];
        const goals = (goalRows ?? []).map((goal) => {
          const milestones = goalMilestones.filter(
            (item) => item.goal_id === goal.id,
          );

          return {
            completed:
              milestones.length > 0 &&
              milestones.every((item) => item.completed),
            milestones,
          };
        });

        const computedGoalStats = getGoalStats(goals);

        const cgpa =
          academicSettings?.previous_cgpa == null
            ? null
            : Number(academicSettings.previous_cgpa);

        const credits =
          academicSettings?.completed_credits == null
            ? null
            : Number(academicSettings.completed_credits);

        if (cancelled) return;

        setTasks(cloudTasks);
        setFitnessDays(cloudFitness);
        setLearningPaths(cloudLearningPaths);
        setCourses(cloudCourses);
        setGradingScale(cloudGradingScale);

        setPreviousCgpa(
          cgpa !== null && Number.isFinite(cgpa) && cgpa >= 0 && cgpa <= 5
            ? cgpa
            : null,
        );

        setPreviousCredits(
          credits !== null &&
            Number.isFinite(credits) &&
            credits >= 0
            ? credits
            : null,
        );

        setGoalStats(computedGoalStats);
        setTrackerCount((trackerRows ?? []).length);
        setLoadError(null);
      } catch (error) {
        console.error("Could not load cloud analytics:", error);

        if (!cancelled) {
          setLoadError(
            error instanceof Error &&
              error.message ===
                "Your session could not be verified. Please sign in again."
              ? error.message
              : "Could not load your analytics. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void loadAnalyticsData();

    return () => {
      cancelled = true;
    };
  }, []);
  const today = dateKey(new Date());

const events = useMemo<AnalyticsEvent[]>(() => {
  const taskEvents: AnalyticsEvent[] = tasks
    .filter((task) => task.completed && isDateKey(task.date))
    .map((task) => ({
      id: `task-${task.id}`,
      date: task.date,
      kind: "task" as const,
      title: task.title,
      detail: `Task completed · ${task.priority} priority`,
    }));

  const fitnessEvents: AnalyticsEvent[] = fitnessDays.flatMap((day) =>
    day.exercises
      .filter((exercise) => exercise.completed)
      .map((exercise) => ({
        id: `fitness-${day.date}-${exercise.id}`,
        date: day.date,
        kind: "fitness" as const,
        title: `${day.title} · ${exercise.name}`,
        detail: `${exercise.sets} sets × ${exercise.reps} reps${
          exercise.weightSpec?.trim()
            ? ` · ${exercise.weightSpec.trim()} kg`
            : exercise.weight != null && exercise.weight > 0
              ? ` · ${exercise.weight} kg`
              : ""
        }`,
      })),
  );

  const learningEvents: AnalyticsEvent[] = learningPaths.flatMap((path) =>
    path.sessions.map((session) => ({
      id: `learning-${path.id}-${session.id}`,
      date: session.date,
      kind: "learning" as const,
      title: path.title,
      detail: session.note.trim() || "Learning practice session",
      minutes: session.minutes,
    })),
  );

  return [...taskEvents, ...fitnessEvents, ...learningEvents].sort(
    (a, b) => b.date.localeCompare(a.date),
  );
}, [tasks, fitnessDays, learningPaths]);

  const rangeStart = useMemo(() => {
    if (range !== "all") {
      return dateKey(addDays(new Date(), -(Number(range) - 1)));
    }

    const dates = events.map((event) => event.date).filter(isDateKey);

    return dates.length > 0
      ? dates.reduce((earliest, current) =>
          current < earliest ? current : earliest,
        )
      : dateKey(addDays(new Date(), -29));
  }, [range, events]);

  const daysInRange =
    range === "all"
      ? Math.max(1, dayDifference(rangeStart, today) + 1)
      : Number(range);

  const rangeEvents = useMemo(
    () =>
      events.filter(
        (event) => event.date >= rangeStart && event.date <= today,
      ),
    [events, rangeStart, today],
  );

  const rangedTasks = tasks.filter(
    (task) => task.date >= rangeStart && task.date <= today,
  );

  const completedTasks = rangedTasks.filter((task) => task.completed).length;

  const taskCompletionRate =
    rangedTasks.length > 0
      ? Math.round((completedTasks / rangedTasks.length) * 100)
      : null;

  const learningSessions = learningPaths.flatMap((path) =>
    path.sessions.filter(
      (session) => session.date >= rangeStart && session.date <= today,
    ),
  );

  const learningMinutes = learningSessions.reduce(
    (sum, session) => sum + session.minutes,
    0,
  );

  const rangedFitnessDays = fitnessDays.filter(
    (day) => day.date >= rangeStart && day.date <= today,
  );

  const completedWorkoutDays = rangedFitnessDays.filter((day) =>
    day.exercises.some((exercise) => exercise.completed),
  );

  const completedExercises = rangedFitnessDays.reduce(
    (sum, day) =>
      sum + day.exercises.filter((exercise) => exercise.completed).length,
    0,
  );

  const activeDates = useMemo(
    () => new Set(rangeEvents.map((event) => event.date)),
    [rangeEvents],
  );

  const longestStreak = useMemo(() => {
    const ordered = [...activeDates].sort();
    let best = 0;
    let current = 0;
    let previous = "";

    ordered.forEach((value) => {
      if (previous && dayDifference(previous, value) === 1) {
        current += 1;
      } else {
        current = 1;
      }

      best = Math.max(best, current);
      previous = value;
    });

    return best;
  }, [activeDates]);

  const courseSummaries = useMemo<CourseSummary[]>(
    () =>
      courses.map((course) => {
        const received = course.assessments.filter(
          (assessment) => assessment.resultStatus === "Received",
        );

        const obtained = received.reduce(
          (sum, assessment) => sum + assessment.obtainedMarks,
          0,
        );

        const possible = received.reduce(
          (sum, assessment) => sum + assessment.totalMarks,
          0,
        );

        const percentage =
          possible > 0 ? (obtained / possible) * 100 : null;

        return {
          id: course.id,
          name: course.name,
          code: course.code,
          credits: course.credits,
          obtained,
          possible,
          percentage,
          grade:
            percentage === null
              ? null
              : getGradeBand(gradingScale, percentage),
        };
      }),
    [courses, gradingScale],
  );

  const gradedCourses = courseSummaries.filter(
    (course) => course.grade !== null,
  );

  const gradedCredits = gradedCourses.reduce(
    (sum, course) => sum + course.credits,
    0,
  );

  const weightedGradePoints = gradedCourses.reduce(
    (sum, course) =>
      sum + (course.grade?.gradePoint ?? 0) * course.credits,
    0,
  );

  const semesterGpa =
    gradedCredits > 0 ? weightedGradePoints / gradedCredits : null;

  const projectedCgpa =
    previousCgpa !== null &&
    previousCredits !== null &&
    semesterGpa !== null &&
    previousCredits + gradedCredits > 0
      ? (previousCgpa * previousCredits + weightedGradePoints) /
        (previousCredits + gradedCredits)
      : null;

  const totalMilestones = learningPaths.reduce(
    (sum, path) => sum + path.milestones.length,
    0,
  );

  const completedLearningMilestones = learningPaths.reduce(
    (sum, path) =>
      sum + path.milestones.filter((milestone) => milestone.completed).length,
    0,
  );

  const learningLinkCount = learningPaths.reduce(
    (sum, path) => sum + path.links.length,
    0,
  );

  const last30Days = useMemo(() => {
    const result: { date: string; count: number }[] = [];
    const start = addDays(new Date(), -29);

    for (let index = 0; index < 30; index += 1) {
      const date = dateKey(addDays(start, index));
      result.push({
        date,
        count: events.filter((event) => event.date === date).length,
      });
    }

    return result;
  }, [events]);

  const chartMax = Math.max(1, ...last30Days.map((item) => item.count));

  const chartPoints = last30Days
    .map((item, index) => {
      const x = 18 + (index / 29) * 584;
      const y = 130 - (item.count / chartMax) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const last30Map = new Map(
    last30Days.map((item) => [item.date, item.count]),
  );

  const weekdayStats = useMemo(() => {
    const rows = [
      { label: "Mon", day: 1 },
      { label: "Tue", day: 2 },
      { label: "Wed", day: 3 },
      { label: "Thu", day: 4 },
      { label: "Fri", day: 5 },
      { label: "Sat", day: 6 },
      { label: "Sun", day: 0 },
    ];

    return rows.map((row) => {
      const dates = last30Days.filter(
        (item) => dateFromKey(item.date).getDay() === row.day,
      );

      const active = dates.filter((item) => item.count > 0).length;

      return {
        label: row.label,
        active,
        total: dates.length,
        percent:
          dates.length > 0 ? Math.round((active / dates.length) * 100) : 0,
      };
    });
  }, [last30Days]);

  const activityMix = [
    {
      label: "My Day tasks",
      count: completedTasks,
      icon: <CheckCircle2 size={16} />,
      color: "#77c5ee",
    },
    {
      label: "Fitness exercises",
      count: completedExercises,
      icon: <Dumbbell size={16} />,
      color: "#749dd0",
    },
    {
      label: "Learning sessions",
      count: learningSessions.length,
      icon: <BookOpen size={16} />,
      color: "#92aad1",
    },
  ];

  const activityMixMax = Math.max(
    1,
    ...activityMix.map((item) => item.count),
  );

  const recentEvents = rangeEvents.slice(0, 8);

  if (loadError) {
    return (
      <section className="panel analytics-loading">
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
    <section className="analytics-workspace">
      <header className="analytics-heading">
        <div>
          <div className="panel-kicker">SIGNALS, NOT NOISE</div>
          <h1>See what is actually working.</h1>
          <p>
            Understand the patterns behind your actions, learning, and training.
            Every metric below comes from your recorded data.
          </p>
        </div>

        <label className="analytics-range-control">
          <CalendarDays size={15} />
          <span className="analytics-visually-hidden">Date range</span>
          <select
            value={range}
            onChange={(event) =>
              setRange(event.target.value as RangeKey)
            }
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </label>
      </header>

      <div className="analytics-summary-grid">
        <StatCard
          icon={<TrendingUp size={18} />}
          label="TASK COMPLETION"
          value={taskCompletionRate === null ? "—" : `${taskCompletionRate}%`}
          note={
            rangedTasks.length > 0
              ? `${completedTasks} of ${rangedTasks.length} tasks on their planned dates`
              : "No task records in this period"
          }
        />

        <StatCard
          icon={<CalendarDays size={18} />}
          label="ACTIVE DAYS"
          value={String(activeDates.size)}
          note={
            range === "all"
              ? "Days with recorded activity"
              : `Out of ${daysInRange} days`
          }
        />

        <StatCard
          icon={<Clock3 size={18} />}
          label="LEARNING TIME"
          value={formatMinutes(learningMinutes)}
          note={`${learningSessions.length} practice sessions recorded`}
        />

        <StatCard
          icon={<Dumbbell size={18} />}
          label="WORKOUT DAYS"
          value={String(completedWorkoutDays.length)}
          note={`${completedExercises} exercises checked off`}
        />
      </div>

      <div className="analytics-primary-grid">
        <section className="panel analytics-panel analytics-trend-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Activity over time</h2>
              <p>
                Completed tasks, exercises, and learning sessions per day.
              </p>
            </div>
            <span className="analytics-period-tag">LAST 30 DAYS</span>
          </div>

          {last30Days.some((item) => item.count > 0) ? (
            <>
              <div className="analytics-line-chart">
                <div className="analytics-chart-guides">
                  <span />
                  <span />
                  <span />
                </div>

                <svg
                  viewBox="0 0 620 150"
                  role="img"
                  aria-label="Daily recorded activity for the last 30 days"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={chartPoints}
                    fill="none"
                    stroke="#77c5ee"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {last30Days.map((item, index) => {
                    const x = 18 + (index / 29) * 584;
                    const y = 130 - (item.count / chartMax) * 100;

                    return item.count > 0 ? (
                      <circle
                        key={item.date}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="#77c5ee"
                      >
                        <title>
                          {formatDate(item.date)}: {item.count} recorded actions
                        </title>
                      </circle>
                    ) : null;
                  })}
                </svg>
              </div>

              <div className="analytics-chart-axis">
                <span>{formatDate(last30Days[0].date)}</span>
                <span>{formatDate(last30Days[14].date)}</span>
                <span>{formatDate(last30Days[29].date)}</span>
              </div>
            </>
          ) : (
            <div className="analytics-chart-empty">
              <Activity size={23} />
              <strong>No activity trend yet</strong>
              <span>
                Complete a task, check off an exercise, or log a practice
                session to start the chart.
              </span>
            </div>
          )}

          <div className="analytics-chart-footnote">
            The trend shows recorded actions, not a rating of the quality or
            difficulty of your work.
          </div>
        </section>

        <section className="panel analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Activity mix</h2>
              <p>Recorded activity in the selected period.</p>
            </div>
          </div>

          <div className="analytics-mix-list">
            {activityMix.map((item) => (
              <div className="analytics-mix-item" key={item.label}>
                <div className="analytics-mix-top">
                  <span className="analytics-mix-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="analytics-mix-track">
                  <span
                    style={{
                      width: `${(item.count / activityMixMax) * 100}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="analytics-insight-note">
            <Sparkles size={16} />
            <p>
              Use the date range to compare the kinds of activity you have
              actually recorded. Missing data is not treated as failure.
            </p>
          </div>
        </section>
      </div>

      <div className="analytics-secondary-grid">
        <section className="panel analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Consistency map</h2>
              <p>Each square represents a day in the last 30 days.</p>
            </div>
          </div>

          <div className="analytics-heatmap" role="list" aria-label="Last 30 days activity map">
            {last30Days.map((item) => {
              const count = item.count;
              const opacity = count === 0 ? 0.12 : Math.min(1, 0.32 + count * 0.16);

              return (
                <div
                  key={item.date}
                  role="listitem"
                  className="analytics-heat-cell"
                  title={`${formatDate(item.date)} · ${count} recorded actions`}
                  style={{
                    background: `rgba(119, 197, 238, ${opacity})`,
                  }}
                />
              );
            })}
          </div>

          <div className="analytics-heatmap-legend">
            <span>Less activity</span>
            <span className="analytics-legend-cells">
              <i style={{ opacity: 0.12 }} />
              <i style={{ opacity: 0.35 }} />
              <i style={{ opacity: 0.6 }} />
              <i style={{ opacity: 0.85 }} />
              <i style={{ opacity: 1 }} />
            </span>
            <span>More activity</span>
          </div>

          <div className="analytics-heatmap-total">
            <strong>{last30Days.filter((item) => item.count > 0).length} active days</strong>
            <span>in the last 30 days</span>
          </div>
        </section>

        <section className="panel analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Weekly rhythm</h2>
              <p>Share of each weekday with recorded activity.</p>
            </div>
          </div>

          <div className="analytics-weekday-chart">
            {weekdayStats.map((day) => (
              <div className="analytics-weekday-column" key={day.label}>
                <div className="analytics-weekday-bar-wrap">
                  <span
                    className={day.percent > 0 ? "active" : ""}
                    style={{ height: `${day.percent}%` }}
                    title={`${day.active} of ${day.total} ${day.label} days active`}
                  />
                </div>
                <strong>{day.label}</strong>
                <small>{day.percent}%</small>
              </div>
            ))}
          </div>

          <div className="analytics-weekday-note">
            A day is active when at least one recorded task, completed exercise,
            or practice session exists for it.
          </div>
        </section>
      </div>

      <div className="analytics-bottom-grid">
        <section className="panel analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Academic performance</h2>
              <p>
                Based on returned marks and your saved grading scale. This
                snapshot isn&apos;t limited by the date filter.
              </p>
            </div>
            <span className="analytics-feature-icon">
              <GraduationCap size={18} />
            </span>
          </div>

          <div className="analytics-academic-highlight">
            <div>
              <span>PROVISIONAL SEMESTER GPA</span>
              <strong>
                {semesterGpa === null ? "—" : semesterGpa.toFixed(2)}
              </strong>
            </div>
            <div>
              <span>GRADED COURSES</span>
              <strong>{gradedCourses.length}/{courses.length}</strong>
            </div>
          </div>

          {projectedCgpa !== null && (
            <div className="analytics-projected-cgpa">
              <span>Projected cumulative CGPA</span>
              <strong>{projectedCgpa.toFixed(2)}</strong>
            </div>
          )}

          {courseSummaries.length === 0 ? (
            <p className="analytics-empty-inline">
              Add courses and mark assessment results as received in Academics
              to see your grade trends here.
            </p>
          ) : (
            <div className="analytics-course-list">
              {courseSummaries.slice(0, 5).map((course) => (
                <div className="analytics-course-row" key={course.id}>
                  <div className="analytics-course-copy">
                    <strong>{course.name}</strong>
                    <span>
                      {course.code} · {course.credits} credits
                    </span>
                  </div>
                  <div className="analytics-course-grade">
                    {course.percentage === null ? (
                      <span className="analytics-no-grade">No result</span>
                    ) : (
                      <>
                        <strong>{course.percentage.toFixed(1)}%</strong>
                        <span>
                          {course.grade
                            ? `${course.grade.gradePoint.toFixed(2)} · ${course.grade.grade}`
                            : "No grade band"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="analytics-data-note">
            GPA and CGPA are estimates. The official result can differ if a
            course uses assessment weighting or grading rules not represented
            in the recorded data.
          </p>
        </section>

        <section className="panel analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Growth & goals</h2>
              <p>Your long-term progress snapshot.</p>
            </div>
            <span className="analytics-feature-icon">
              <Target size={18} />
            </span>
          </div>

          <div className="analytics-growth-item">
            <div className="analytics-growth-item-top">
              <span className="analytics-growth-icon">
                <BookOpen size={16} />
              </span>
              <div>
                <strong>Learning paths</strong>
                <span>{learningPaths.length} created</span>
              </div>
            </div>
            <div className="analytics-growth-bar">
              <span
                style={{
                  width: `${
                    totalMilestones > 0
                      ? (completedLearningMilestones / totalMilestones) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="analytics-growth-caption">
              {completedLearningMilestones} of {totalMilestones} learning
              milestones completed
            </div>
          </div>

          <div className="analytics-growth-item">
            <div className="analytics-growth-item-top">
              <span className="analytics-growth-icon">
                <Target size={16} />
              </span>
              <div>
                <strong>Goals</strong>
                <span>{goalStats.total} saved</span>
              </div>
            </div>
            <div className="analytics-growth-caption">
              {goalStats.milestoneCompleted} of {goalStats.milestoneTotal} goal
              milestones completed
            </div>
          </div>

          <div className="analytics-resource-strip">
            <FolderKanban size={16} />
            <span>Learning projects & resources</span>
            <strong>{learningLinkCount}</strong>
          </div>

          <div className="analytics-resource-strip">
            <Activity size={16} />
            <span>Trackers configured</span>
            <strong>{trackerCount}</strong>
          </div>

          <div className="analytics-resource-strip">
            <Clock3 size={16} />
            <span>Total learning practice</span>
            <strong>{formatMinutes(
              learningPaths.reduce(
                (sum, path) =>
                  sum +
                  path.sessions.reduce(
                    (sessionSum, session) => sessionSum + session.minutes,
                    0,
                  ),
                0,
              ),
            )}</strong>
          </div>

          <p className="analytics-data-note">
            Goal completion and learning milestones are current totals; these
            records don&apos;t store completion timestamps yet.
          </p>
        </section>
      </div>

      <section className="panel analytics-panel analytics-recent-panel">
        <div className="analytics-panel-heading">
          <div>
            <h2>Recent recorded activity</h2>
            <p>Latest completed actions from My Day, Fitness, and learning logs.</p>
          </div>
          <span className="analytics-period-tag">
            {range === "all" ? "ALL TIME" : `LAST ${range} DAYS`}
          </span>
        </div>

        {recentEvents.length === 0 ? (
          <div className="analytics-chart-empty analytics-recent-empty">
            <Activity size={22} />
            <strong>No completed activity in this period</strong>
            <span>
              Completed tasks, exercise check-offs, and logged practice sessions
              will appear here.
            </span>
          </div>
        ) : (
          <div className="analytics-recent-list">
            {recentEvents.map((event) => (
              <article className="analytics-recent-row" key={event.id}>
                <span
                  className={`analytics-recent-icon ${event.kind}`}
                >
                  {event.kind === "task" ? (
                    <CheckCircle2 size={16} />
                  ) : event.kind === "fitness" ? (
                    <Dumbbell size={16} />
                  ) : (
                    <BookOpen size={16} />
                  )}
                </span>

                <div className="analytics-recent-copy">
                  <strong>{event.title}</strong>
                  <span>{event.detail}</span>
                </div>

                <time dateTime={event.date}>{formatDate(event.date)}</time>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="analytics-footer-note">
        <Award size={15} />
        <span>
          Analytics uses records saved in this browser. Task activity is grouped
          by its planned date because tasks don&apos;t yet store a separate completed
          timestamp. No missing records are filled with sample values.
        </span>
      </div>
    </section>
  );
}