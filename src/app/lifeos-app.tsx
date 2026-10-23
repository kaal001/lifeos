"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { useConfirmDialog } from "./confirm-dialog-provider";
import { usePathname, useRouter } from "next/navigation";
import GoalsWorkspace from "./goals-workspace";
import FitnessWorkspace from "./fitness-workspace";
import PersonalGrowthWorkspace from "./personal-growth-workspace";
import AnalyticsWorkspace from "./analytics-workspace";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Droplets,
  Dumbbell,
  Flame,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  EyeOff,
  Target,
  Timer,
  TrendingUp,
  Trash2,
} from "lucide-react";
import TrackerWorkspace from "./tracker-workspace";
import AcademicsWorkspace from "./academics-workspace";
const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
type Theme = "dark" | "light";
type Priority = "Low" | "Medium" | "High";
type TaskFilter = "All" | "To do" | "Completed";
type TaskScope = "Today" | "Upcoming";

type Habit = {
  id: string;
  title: string;
  meta: string;
  iconKey: string;
  icon: ReactNode;
  done: boolean;
};

type Task = {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  date: string;
};

type NavigationItem = {
  label: string;
  icon: ReactNode;
  section: string;
};

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function calculateCurrentStreak(
  completedDateKeys: string[],
  currentDateKey: string,
) {
  const completedDates = new Set(completedDateKeys);
  const cursor = new Date(`${currentDateKey}T00:00:00`);

  if (Number.isNaN(cursor.getTime())) return 0;

  // If today has no completed habit yet, start from yesterday.
  if (!completedDates.has(currentDateKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;

  while (completedDates.has(getDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;

  const task = value as Record<string, unknown>;

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    task.title.length > 0 &&
    ["Low", "Medium", "High"].includes(task.priority as string) &&
    typeof task.completed === "boolean" &&
    typeof task.date === "string"
  );
}

const initialHabits: Habit[] = [
  {
    id: "starter-morning-workout",
    title: "Morning workout",
    meta: "30 min · Fitness",
    iconKey: "dumbbell",
    icon: <Dumbbell size={17} />,
    done: false,
  },
  {
    id: "starter-reading",
    title: "Read for 20 minutes",
    meta: "20 min · Learning",
    iconKey: "book-open",
    icon: <BookOpen size={17} />,
    done: false,
  },
  {
    id: "starter-programming",
    title: "Study programming",
    meta: "60 min · Academics",
    iconKey: "graduation-cap",
    icon: <GraduationCap size={17} />,
    done: false,
  },
  {
    id: "starter-water",
    title: "Drink enough water",
    meta: "8 glasses · Health",
    iconKey: "droplets",
    icon: <Droplets size={17} />,
    done: false,
  },
];
function getHabitIcon(iconKey: string): ReactNode {
  switch (iconKey) {
    case "dumbbell":
      return <Dumbbell size={17} />;

    case "book-open":
      return <BookOpen size={17} />;

    case "graduation-cap":
      return <GraduationCap size={17} />;

    case "droplets":
      return <Droplets size={17} />;

    default:
      return <CircleCheck size={17} />;
  }
}
const navigation: NavigationItem[] = [
  {
    label: "Overview",
    icon: <LayoutDashboard size={18} />,
    section: "WORKSPACE",
  },
  {
    label: "My Day",
    icon: <CalendarDays size={18} />,
    section: "WORKSPACE",
  },
  {
    label: "Trackers",
    icon: <Activity size={18} />,
    section: "WORKSPACE",
  },
  {
    label: "Goals",
    icon: <Target size={18} />,
    section: "WORKSPACE",
  },
  {
    label: "Academics",
    icon: <GraduationCap size={18} />,
    section: "LIFE AREAS",
  },
  {
    label: "Fitness",
    icon: <Dumbbell size={18} />,
    section: "LIFE AREAS",
  },
  {
    label: "Personal Growth",
    icon: <Sparkles size={18} />,
    section: "LIFE AREAS",
  },
  {
    label: "Analytics",
    icon: <BarChart3 size={18} />,
    section: "INSIGHTS",
  },
];

type WeeklyActivityDay = {
  day: string;
  count: number;
  value: number;
};

export default function Home() {
    const { requestConfirmation } = useConfirmDialog();
  const [theme, setTheme] = useState<Theme>("dark");
  const pathname = usePathname();
const router = useRouter();

const sectionPaths: Record<string, string> = {
  Overview: "/dashboard",
  "My Day": "/my-day",
  Trackers: "/trackers",
  Goals: "/goals",
  Academics: "/academics",
  Fitness: "/fitness",
  "Personal Growth": "/personal-growth",
  Analytics: "/analytics",
  Settings: "/settings",
};

const pathSections: Record<string, string> = {
  "/dashboard": "Overview",
  "/my-day": "My Day",
  "/trackers": "Trackers",
  "/goals": "Goals",
  "/academics": "Academics",
  "/fitness": "Fitness",
  "/personal-growth": "Personal Growth",
  "/analytics": "Analytics",
  "/settings": "Settings",
};
const isMounted = useSyncExternalStore(
  subscribeToNothing,
  getClientSnapshot,
  getServerSnapshot,
);

const activeSection = isMounted
  ? pathSections[pathname] ?? "Overview"
  : "Overview";
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [newHabit, setNewHabit] = useState("");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editHabitTitle, setEditHabitTitle] = useState("");
  const [editHabitMeta, setEditHabitMeta] = useState("");
  const [savingHabitEdit, setSavingHabitEdit] = useState(false);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [today, setToday] = useState("");
  const [todayKey, setTodayKey] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [weeklyCheckInCount, setWeeklyCheckInCount] =
    useState<number | null>(null);
  const [weeklyActivity, setWeeklyActivity] =
    useState<WeeklyActivityDay[]>([]);
  const [practiceMinutesToday, setPracticeMinutesToday] =
    useState<number | null>(null);
  const [completedCheckInDates, setCompletedCheckInDates] =
    useState<string[] | null>(null);
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("Your account");
  const [accountEmail, setAccountEmail] = useState("");
  const [dateOfBirthDraft, setDateOfBirthDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");
  const [profileSaveError, setProfileSaveError] = useState("");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("All");
  const [taskScope, setTaskScope] = useState<TaskScope>("Today");
  const [taskPriority, setTaskPriority] = useState<Priority>("Medium");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskPriority, setEditTaskPriority] =
    useState<Priority>("Medium");
  const [editTaskDate, setEditTaskDate] = useState("");
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
    
  const [showTaskForm, setShowTaskForm] = useState(false);
  const calculatedAge = (() => {
  if (!dateOfBirthDraft) return null;

  const [year, month, day] = dateOfBirthDraft.split("-").map(Number);

  if (!year || !month || !day) return null;

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isValidDate =
    birthDate.getFullYear() === year &&
    birthDate.getMonth() === month - 1 &&
    birthDate.getDate() === day;

  if (!isValidDate || birthDate > today) return null;

  let age = today.getFullYear() - year;

  const birthdayNotReached =
    today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day);

  if (birthdayNotReached) age--;

  return age;
  })();
  
useEffect(() => {
  let cancelled = false;

  async function loadCloudData() {
    try {
      const savedTheme = document.documentElement.dataset.theme;

      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }

      const now = new Date();
      const currentDateKey = getDateKey(now);

      setTodayKey(currentDateKey);
      setToday(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      );

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

if (!user) {
  if (!cancelled) {
    setCloudUserId(null);
    setAccountName("Your account");
    setDisplayNameDraft("Your account");
    setAccountEmail("");
    setTasks([]);
    setHabits([]);
    setWeeklyCheckInCount(null);
    setWeeklyActivity([]);
    setPracticeMinutesToday(null);
    setCompletedCheckInDates([]);
  }
  return;
}

const metadataName = user.user_metadata?.display_name;

const fallbackName =
  typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email?.split("@")[0] || "Your account";

  if (!cancelled) {
    setCloudUserId(user.id);
    setAccountName(fallbackName);
    setDisplayNameDraft(fallbackName);
    setAccountEmail(user.email ?? "");
  }

const { data: profileRow, error: profileError } = await supabase
  .from("profiles")
  .select("display_name, date_of_birth")
  .eq("id", user.id)
  .maybeSingle();

    if (profileError) {
      console.error("Could not load profile name:", profileError);
    } else if (
      !cancelled &&
      typeof profileRow?.display_name === "string" &&
      profileRow.display_name.trim()
    ) {
      const profileName = profileRow.display_name.trim();
      setAccountName(profileName);
      setDisplayNameDraft(profileName);
    }
    if (!cancelled && !profileError) {
  setDateOfBirthDraft(
    typeof profileRow?.date_of_birth === "string"
      ? profileRow.date_of_birth
      : "",
      );
    }
      const [taskResult, habitResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, priority, completed, task_date, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("habits")
          .select("id, title, meta, icon_key, sort_order")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (taskResult.error) {
        console.error("Could not load cloud tasks:", taskResult.error);
      } else if (!cancelled) {
        const cloudTasks: Task[] = (taskResult.data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          priority: row.priority as Priority,
          completed: row.completed,
          date: row.task_date,
        }));

        setTasks(cloudTasks.filter(isTask));
      }

      if (habitResult.error) {
        throw habitResult.error;
      }

      let habitRows = habitResult.data ?? [];

      // Seed the starter habits only when this account has none.
      if (habitRows.length === 0) {
        const starterRows = initialHabits.map((habit, index) => ({
          id: habit.id,
          user_id: user.id,
          title: habit.title,
          meta: habit.meta,
          icon_key: habit.iconKey,
          sort_order: index,
          is_active: true,
        }));

        const { error: seedError } = await supabase
          .from("habits")
          .upsert(starterRows, {
            onConflict: "user_id,id",
            ignoreDuplicates: true,
          });

        if (seedError) {
          throw seedError;
        }

        const { data: refreshedHabits, error: refreshError } = await supabase
          .from("habits")
          .select("id, title, meta, icon_key, sort_order")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (refreshError) throw refreshError;

        habitRows = refreshedHabits ?? [];
      }

      const { data: checkinRows, error: checkinError } = await supabase
        .from("habit_checkins")
        .select("habit_id, completed")
        .eq("user_id", user.id)
        .eq("checkin_date", currentDateKey);

      if (checkinError) throw checkinError;
      const weekStartDate = new Date(now);
weekStartDate.setDate(weekStartDate.getDate() - 6);

const weekStartKey = getDateKey(weekStartDate);

const {
  data: weeklyCheckinRows,
  error: weeklyCheckinError,
} = await supabase
  .from("habit_checkins")
  .select("habit_id, checkin_date")
  .eq("user_id", user.id)
  .eq("completed", true)
  .gte("checkin_date", weekStartKey)
  .lte("checkin_date", currentDateKey);

      if (weeklyCheckinError) {
        console.error(
          "Could not load weekly habit check-ins:",
          weeklyCheckinError,
        );

        if (!cancelled) {
          setWeeklyCheckInCount(null);
          setWeeklyActivity([]);
          
        }
      } else if (!cancelled) {
        const rows = weeklyCheckinRows ?? [];

        setWeeklyCheckInCount(rows.length);

        const dailyActivity = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(now);
          date.setDate(now.getDate() - 6 + index);

          const dateKey = getDateKey(date);

          const count = rows.filter(
            (row) => row.checkin_date === dateKey,
          ).length;

          return {
            day: date
              .toLocaleDateString("en-US", { weekday: "short" })
              .slice(0, 1),
            count,
            value: 0,
          };
        });

        const maxDailyCount = Math.max(
          ...dailyActivity.map((day) => day.count),
        );

        setWeeklyActivity(
          dailyActivity.map((day) => ({
            ...day,
            value:
              maxDailyCount === 0
                ? 0
                : Math.round((day.count / maxDailyCount) * 100),
          })),
        );
      }
          const {
        data: streakCheckinRows,
        error: streakCheckinError,
      } = await supabase
        .from("habit_checkins")
        .select("checkin_date")
        .eq("user_id", user.id)
        .eq("completed", true)
        .lte("checkin_date", currentDateKey)
        .order("checkin_date", { ascending: false });

      if (streakCheckinError) {
        console.error(
          "Could not load habit history for streak:",
          streakCheckinError,
        );

        if (!cancelled) {
          setCompletedCheckInDates(null);
        }
      } else if (!cancelled) {
        setCompletedCheckInDates([
          ...new Set(
            (streakCheckinRows ?? []).map((row) => row.checkin_date),
          ),
        ]);
      }
      const {
          data: practiceSessionRows,
          error: practiceSessionError,
        } = await supabase
          .from("practice_sessions")
          .select("minutes")
          .eq("user_id", user.id)
          .eq("practice_date", currentDateKey);

        if (practiceSessionError) {
          console.error(
            "Could not load today's practice time:",
            practiceSessionError,
          );

          if (!cancelled) {
            setPracticeMinutesToday(null);
          }
        } else if (!cancelled) {
          setPracticeMinutesToday(
            (practiceSessionRows ?? []).reduce(
              (total, row) =>
                total +
                (typeof row.minutes === "number" &&
                Number.isFinite(row.minutes)
                  ? row.minutes
                  : 0),
              0,
            ),
          );
        }
      // Restore today's saved habit check-ins after loading from Supabase.
      const checkins = checkinRows ?? [];

      if (!cancelled) {
        setHabits(
          habitRows.map((row) => ({
            id: row.id,
            title: row.title,
            meta: row.meta ?? "Personal habit",
            iconKey: row.icon_key ?? "circle-check",
            icon: getHabitIcon(row.icon_key ?? "circle-check"),
            done: checkins.some(
              (checkin) =>
                checkin.habit_id === row.id && checkin.completed,
            ),
          })),
        );
      }
        } catch (error) {
          console.error("Unable to load LifeOS cloud data:", error);

          if (!cancelled) {
            setTasks([]);
            setHabits([]);
            setWeeklyCheckInCount(null);
            setWeeklyActivity([]);
            setPracticeMinutesToday(null);
            setCompletedCheckInDates(null);
          }
        } finally {
          if (!cancelled) {
            setHabitsLoading(false);
          }
        }
      }

  void loadCloudData();
  return () => {
    cancelled = true;
  };
  }, []);
  const completedHabits = habits.filter((habit) => habit.done).length;
  const progress =
    habits.length > 0
      ? Math.round((completedHabits / habits.length) * 100)
      : 0;

  const todaysTasks = tasks.filter((task) => task.date === todayKey);
  const upcomingTasks = todayKey
  ? tasks
      .filter((task) => task.date > todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))
  : [];
  const completedTasks = todaysTasks.filter((task) => task.completed).length;
  const pendingTasks = todaysTasks.filter((task) => !task.completed).length;
  const weeklyTaskCompletion = (() => {
  if (!todayKey) return null;

  const endDate = new Date(`${todayKey}T00:00:00`);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const startKey = getDateKey(startDate);

  const weeklyTasks = tasks.filter(
      (task) => task.date >= startKey && task.date <= todayKey,
    );

    if (weeklyTasks.length === 0) return null;

    const completedWeeklyTasks = weeklyTasks.filter(
      (task) => task.completed,
    ).length;

    return Math.round(
      (completedWeeklyTasks / weeklyTasks.length) * 100,
    );
  })();
  const currentStreak =
  completedCheckInDates === null || !todayKey
    ? null
    : calculateCurrentStreak(completedCheckInDates, todayKey);
  const activeCheckInDays = weeklyActivity.filter(
    (day) => day.count > 0,
  ).length;

  const weeklyConsistency =
    weeklyActivity.length === 7
      ? Math.round((activeCheckInDays / 7) * 100)
      : null;

  const scopedTasks =
    taskScope === "Today" ? todaysTasks : upcomingTasks;

  const filteredTasks = scopedTasks.filter((task) => {
    if (taskFilter === "To do") return !task.completed;
    if (taskFilter === "Completed") return task.completed;
    return true;
  });

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;

    try {
      localStorage.setItem("lifeos-theme", nextTheme);
    } catch {
      // The theme still changes if browser storage is unavailable.
    }
  }
  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const name = displayNameDraft.trim();

  setProfileSaveMessage("");
  setProfileSaveError("");

  if (name.length < 2 || name.length > 80) {
    setProfileSaveError(
      "Display name must contain between 2 and 80 characters.",
    );
    return;
  }
  const dateOfBirth = dateOfBirthDraft.trim();

if (dateOfBirth) {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isValidDate =
    /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    birthDate.getFullYear() === year &&
    birthDate.getMonth() === month - 1 &&
    birthDate.getDate() === day;

  if (!isValidDate || birthDate > today) {
    setProfileSaveError(
      "Please enter a valid date of birth that is not in the future.",
    );
    return;
    }
  }
  if (!cloudUserId) {
    setProfileSaveError(
      "Your session could not be found. Please sign in again.",
    );
    return;
  }

  setIsSavingProfile(true);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("profiles")
      .update({display_name: name,date_of_birth: dateOfBirth || null,})
      .eq("id", cloudUserId)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "Your profile record was not found. Please refresh and try again.",
      );
    }

    setAccountName(name);
    setDateOfBirthDraft(dateOfBirth);
    setDisplayNameDraft(name);
    setProfileSaveMessage("Your profile has been updated.");
  } catch (error: unknown) {
    setProfileSaveError(
      error instanceof Error
        ? error.message
        : "Could not save your profile. Please try again.",
    );
  } finally {
    setIsSavingProfile(false);
  }
  }
async function handleSignOut() {
  if (isSigningOut) return;

  setIsSigningOut(true);

  try {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) throw error;

    setShowAccountMenu(false);
    setCloudUserId(null);
    setAccountName("Your account");
    setDisplayNameDraft("Your account");
    setAccountEmail("");
    setTasks([]);
    setHabits([]);
    setWeeklyCheckInCount(null);
    setWeeklyActivity([]);
    setPracticeMinutesToday(null);
    setCompletedCheckInDates([]);

    router.replace("/");
    router.refresh();
  } catch (error: unknown) {
    console.error("Could not sign out:", error);

    window.alert(
      error instanceof Error
        ? `Could not sign out. ${error.message}`
        : "Could not sign out. Please try again.",
    );
  } finally {
    setIsSigningOut(false);
  }
}  

async function toggleHabit(id: string) {
  if (!cloudUserId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  const habit = habits.find((item) => item.id === id);
  if (!habit) return;

  const checkinDate = todayKey || getDateKey(new Date());
  const nextDone = !habit.done;

  try {
    const supabase = createClient();

    const { error } = await supabase.from("habit_checkins").upsert(
      {
        user_id: cloudUserId,
        habit_id: id,
        checkin_date: checkinDate,
        completed: nextDone,
      },
      {
        onConflict: "user_id,habit_id,checkin_date",
      },
    );

    if (error) throw error;

if (error) throw error;

setHabits((current) =>
  current.map((item) =>
    item.id === id ? { ...item, done: nextDone } : item,
  ),
);

setWeeklyCheckInCount((current) => {
  if (current === null) return current;

  return Math.max(0, current + (nextDone ? 1 : -1));
});

setWeeklyActivity((current) => {
  if (current.length === 0) return current;

  const updatedActivity = current.map((item, index) =>
    index === current.length - 1
      ? {
          ...item,
          count: Math.max(
            0,
            item.count + (nextDone ? 1 : -1),
          ),
        }
      : item,
  );
setCompletedCheckInDates((current) => {
  if (current === null) return current;

  const anotherHabitCompletedToday = habits.some(
    (item) => item.id !== id && item.done,
  );

  const shouldIncludeToday =
    nextDone || anotherHabitCompletedToday;

  const alreadyIncluded = current.includes(checkinDate);

  if (shouldIncludeToday && !alreadyIncluded) {
    return [...current, checkinDate];
  }

  if (!shouldIncludeToday && alreadyIncluded) {
    return current.filter((date) => date !== checkinDate);
  }

  return current;
});

  const maxDailyCount = Math.max(
    ...updatedActivity.map((item) => item.count),
  );

    return updatedActivity.map((item) => ({
      ...item,
      value:
        maxDailyCount === 0
          ? 0
          : Math.round((item.count / maxDailyCount) * 100),
    }));
  });
  } catch (error) {
    console.error("Could not save habit check-in:", error);

    window.alert(
      `Could not save this habit check-in. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  }
}

async function addHabit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const title = newHabit.trim();
  if (!title) return;

  if (!cloudUserId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  const id = crypto.randomUUID();
  const meta = "Personal habit";
  const iconKey = "circle-check";

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("habits")
      .insert({
        id,
        user_id: cloudUserId,
        title,
        meta,
        icon_key: iconKey,
        sort_order: habits.length,
        is_active: true,
      })
      .select("id, title, meta, icon_key")
      .single();

    if (error) throw error;

    setHabits((current) => [
      ...current,
      {
        id: data.id,
        title: data.title,
        meta: data.meta ?? meta,
        iconKey: data.icon_key ?? iconKey,
        icon: getHabitIcon(data.icon_key ?? iconKey),
        done: false,
      },
    ]);

    setNewHabit("");
    setShowHabitForm(false);
  } catch (error) {
    console.error("Could not create habit:", error);

    window.alert(
      `Could not create this habit. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  }
}

function startHabitEdit(habit: Habit) {
  setEditingHabitId(habit.id);
  setEditHabitTitle(habit.title);
  setEditHabitMeta(habit.meta);
  setShowHabitForm(false);
}

function cancelHabitEdit() {
  if (savingHabitEdit) return;

  setEditingHabitId(null);
  setEditHabitTitle("");
  setEditHabitMeta("");
}

async function saveHabitEdit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const habitId = editingHabitId;
  const title = editHabitTitle.trim();
  const meta = editHabitMeta.trim() || "Personal habit";

  if (!habitId || !title || savingHabitEdit) return;

  if (!cloudUserId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  setSavingHabitEdit(true);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("habits")
      .update({
        title,
        meta,
      })
      .eq("user_id", cloudUserId)
      .eq("id", habitId)
      .select("id, title, meta, icon_key")
      .single();

    if (error) throw error;

    const iconKey = data.icon_key ?? "circle-check";

    setHabits((current) =>
      current.map((habit) =>
        habit.id === habitId
          ? {
              ...habit,
              title: data.title,
              meta: data.meta ?? meta,
              iconKey,
              icon: getHabitIcon(iconKey),
            }
          : habit,
      ),
    );

    setEditingHabitId(null);
    setEditHabitTitle("");
    setEditHabitMeta("");
  } catch (error) {
    console.error("Could not update habit:", error);

    window.alert(
      `Could not update this habit. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  } finally {
    setSavingHabitEdit(false);
  }
}
async function stopTrackingHabit(id: string) {
  if (!cloudUserId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  const habit = habits.find((item) => item.id === id);
  if (!habit) return;

  const confirmed = await requestConfirmation({
    title: "Stop tracking this habit?",
    message: `"${habit.title}" will be removed from your active habits. All previous check-in history will be preserved.`,
    confirmLabel: "Stop tracking",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;


  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("habits")
      .update({ is_active: false })
      .eq("user_id", cloudUserId)
      .eq("id", id)
      .select("id")
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error("Habit not found. Please refresh and try again.");
    }

    setHabits((current) => current.filter((item) => item.id !== id));

    if (editingHabitId === id) {
      setEditingHabitId(null);
      setEditHabitTitle("");
      setEditHabitMeta("");
    }
  } catch (error) {
    console.error("Could not delete habit:", error);

    window.alert(
      `Could not delete this habit. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
    return;
  }

  const currentDateKey = todayKey || getDateKey(new Date());
  const weekStartDate = new Date(`${currentDateKey}T00:00:00`);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStartKey = getDateKey(weekStartDate);

  try {
    const [weeklyResult, streakResult] = await Promise.all([
      supabase
        .from("habit_checkins")
        .select("habit_id, checkin_date")
        .eq("user_id", cloudUserId)
        .eq("completed", true)
        .gte("checkin_date", weekStartKey)
        .lte("checkin_date", currentDateKey),

      supabase
        .from("habit_checkins")
        .select("checkin_date")
        .eq("user_id", cloudUserId)
        .eq("completed", true)
        .lte("checkin_date", currentDateKey)
        .order("checkin_date", { ascending: false }),
    ]);

    if (weeklyResult.error) throw weeklyResult.error;
    if (streakResult.error) throw streakResult.error;

    const rows = weeklyResult.data ?? [];
    setWeeklyCheckInCount(rows.length);

    const dailyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${currentDateKey}T00:00:00`);
      date.setDate(date.getDate() - 6 + index);

      const dateKey = getDateKey(date);
      const count = rows.filter(
        (row) => row.checkin_date === dateKey,
      ).length;

      return {
        day: date
          .toLocaleDateString("en-US", { weekday: "short" })
          .slice(0, 1),
        count,
        value: 0,
      };
    });

    const maxDailyCount = Math.max(
      ...dailyActivity.map((day) => day.count),
    );

    setWeeklyActivity(
      dailyActivity.map((day) => ({
        ...day,
        value:
          maxDailyCount === 0
            ? 0
            : Math.round((day.count / maxDailyCount) * 100),
      })),
    );

    setCompletedCheckInDates([
      ...new Set((streakResult.data ?? []).map((row) => row.checkin_date)),
    ]);
  } catch (error) {
    console.error("Habit deleted, but progress refresh failed:", error);

    setWeeklyCheckInCount(null);
    setWeeklyActivity([]);
    setCompletedCheckInDates(null);

    window.alert(
      "The habit was deleted, but progress could not be refreshed. Please reload the page.",
    );
  }
}
async function addTask(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const title = newTask.trim();
  if (!title) return;

  if (!cloudUserId) {
    window.alert("Your cloud session is still loading. Please try again.");
    return;
  }

  const id = crypto.randomUUID();
  const currentDateKey = todayKey || getDateKey(new Date());
  const taskDate = newTaskDate || currentDateKey;

  if (taskDate < currentDateKey) {
    window.alert("Please choose today or a future date.");
    return;
  }
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        id,
        user_id: cloudUserId,
        title,
        priority: taskPriority,
        completed: false,
        task_date: taskDate,
      })
      .select("id, title, priority, completed, task_date")
      .single();

    if (error) throw error;

    const savedTask: Task = {
      id: data.id,
      title: data.title,
      priority: data.priority as Priority,
      completed: data.completed,
      date: data.task_date,
    };

    setTasks((current) => [savedTask, ...current]);

    setNewTask("");
    setNewTaskDate("");
    setTaskPriority("Medium");
    setTaskFilter("All");
    setTaskScope(taskDate === currentDateKey ? "Today" : "Upcoming");
    setShowTaskForm(false);
  } catch (error) {
    console.error("Could not create task:", error);

    window.alert(
      `Could not create this task. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  }
}

  async function toggleTask(id: string) {
    if (!cloudUserId) {
      window.alert("Your cloud session is still loading. Please try again.");
      return;
    }

    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const nextCompleted = !task.completed;

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("tasks")
        .update({ completed: nextCompleted })
        .eq("user_id", cloudUserId)
        .eq("id", id);

      if (error) throw error;

      setTasks((current) =>
        current.map((item) =>
          item.id === id ? { ...item, completed: nextCompleted } : item,
        ),
      );
    } catch (error) {
      console.error("Could not update task:", error);

      window.alert(
        `Could not update this task. ${
          error instanceof Error ? error.message : "Please try again."
        }`,
      );
    }
  }

  function startTaskEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskPriority(task.priority);
    setEditTaskDate(task.date);
    setShowTaskForm(false);
  }

  function cancelTaskEdit() {
    if (savingTaskEdit) return;

    setEditingTaskId(null);
    setEditTaskTitle("");
    setEditTaskPriority("Medium");
    setEditTaskDate("");
  }

  async function saveTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const taskId = editingTaskId;
    const title = editTaskTitle.trim();
    const taskDate = editTaskDate;

    if (!taskId || !title || !taskDate || savingTaskEdit) return;

    if (todayKey && taskDate < todayKey) {
      window.alert("Please choose today or a future date.");
      return;
    }

    if (!cloudUserId) {
      window.alert("Your cloud session is still loading. Please try again.");
      return;
    }

    setSavingTaskEdit(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("tasks")
        .update({
          title,
          priority: editTaskPriority,
          task_date: taskDate,
        })
        .eq("user_id", cloudUserId)
        .eq("id", taskId)
        .select("id, title, priority, completed, task_date")
        .single();

      if (error) throw error;

      const updatedTask: Task = {
        id: data.id,
        title: data.title,
        priority: data.priority as Priority,
        completed: data.completed,
        date: data.task_date,
      };

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? updatedTask : task,
        ),
      );

      setEditingTaskId(null);
      setEditTaskTitle("");
      setEditTaskPriority("Medium");
      setEditTaskDate("");

      setTaskScope(taskDate === todayKey ? "Today" : "Upcoming");
    } catch (error) {
      console.error("Could not update task:", error);

      window.alert(
        `Could not update this task. ${
          error instanceof Error ? error.message : "Please try again."
        }`,
      );
    } finally {
      setSavingTaskEdit(false);
    }
  }
  async function deleteTask(id: string) {
    if (!cloudUserId) {
      window.alert("Your cloud session is still loading. Please try again.");
      return;
    }

    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const confirmed = await requestConfirmation({
      title: "Delete this task?",
      message: `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
      confirmLabel: "Delete task",
      cancelLabel: "Cancel",
    });

    if (!confirmed) return;

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("user_id", cloudUserId)
        .eq("id", id);

      if (error) throw error;

      setTasks((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Could not delete task:", error);

      window.alert(
        `Could not delete this task. ${
          error instanceof Error ? error.message : "Please try again."
        }`,
      );
    }
  }


  function changeSection(section: string) {
    setShowHabitForm(false);
    setShowTaskForm(false);
    router.push(sectionPaths[section] ?? "/");
  }

  return (
    <main className="lifeos">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          aria-label="LifeOS home"
          onClick={() => changeSection("Overview")}
        >
          <span className="brand-mark">
            L<span>.</span>
          </span>
          <span className="brand-copy">
            <strong>LifeOS</strong>
            <small>PERSONAL OPERATING SYSTEM</small>
          </span>
        </a>

        <div className="workspace-switcher">
        <span className="workspace-avatar" aria-hidden="true">
          Y
        </span>

        <span className="workspace-copy">
          <strong>Your workspace</strong>
          <small>Personal account</small>
        </span>
        </div>

        

        {["WORKSPACE", "LIFE AREAS", "INSIGHTS"].map((section) => (
          <div className="nav-group" key={section}>
            <div className="sidebar-label">{section}</div>

            {navigation
              .filter((item) => item.section === section)
              .map((item) => (
                <button
                  type="button"
                  className={`nav-item ${
                    activeSection === item.label ? "active" : ""
                  }`}
                  key={item.label}
                  onClick={() => changeSection(item.label)}
                  aria-current={
                    activeSection === item.label ? "page" : undefined
                  }
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>

                  {item.label === "My Day" && pendingTasks > 0 && (
                    <span className="nav-count">{pendingTasks}</span>
                  )}
                </button>
              ))}
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <span className="upgrade-spark">
              <Sparkles size={17} />
            </span>
            <strong>Your growth, your way.</strong>
            <p>Small steps today. Big changes tomorrow.</p>
            <div className="upgrade-decoration">
              <Sparkles size={27} />
            </div>
          </div>

          <div className="account-menu-container">
            <button
              className="profile account-menu-trigger"
              type="button"
              aria-label="Open account menu"
              aria-expanded={showAccountMenu}
              aria-controls="lifeos-account-menu"
              onClick={() => setShowAccountMenu((open) => !open)}
            >
              <span className="profile-avatar">
                {accountName.trim().charAt(0).toUpperCase() || "U"}
              </span>

              <span className="profile-copy">
                <strong>{accountName}</strong>
                <small>{accountEmail || "Signed in"}</small>
              </span>

              <span className="profile-menu">
                <MoreHorizontal size={20} />
              </span>
            </button>

            {showAccountMenu && (
              <div
                id="lifeos-account-menu"
                className="account-menu"
                aria-label="Account actions"
              >
                <div className="account-menu-heading">
                  <strong>{accountName}</strong>
                  <small>{accountEmail || "Signed in"}</small>
                </div>

                {/* Profile & Settings button */}
                <button
                  className="account-menu-item"
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    changeSection("Settings");
                  }}
                >
                  Profile & Settings
                </button>

                {/* Existing Sign out button */}
                <button
                  className="account-menu-item"
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{activeSection}</strong>
          </div>

          <div className="topbar-actions">
            <div className="date-chip">
              <span>
                <Clock3 size={15} />
              </span>
              <span>{today || "Your daily overview"}</span>
            </div>

            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              type="button"
              aria-label={`Switch to ${
                theme === "dark" ? "light" : "dark"
              } theme`}
              title={`Switch to ${
                theme === "dark" ? "light" : "dark"
              } theme`}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>


          </div>
        </header>

        <div className="dashboard-content">
            {activeSection === "Fitness" ? (
              <FitnessWorkspace />
            ) : activeSection === "Trackers" ? (
              <TrackerWorkspace />
            ) : activeSection === "Personal Growth" ? (
              <PersonalGrowthWorkspace />
            ) : activeSection === "Analytics" ? (
              <AnalyticsWorkspace />
) : activeSection === "Settings" ? (
  <div className="settings-page">
    <header className="settings-page-heading">
      <div>
        <div className="panel-kicker">ACCOUNT SETTINGS</div>
        <h1>Profile & Settings</h1>
        <p>
          Manage your personal information and account preferences.
        </p>
      </div>
    </header>

    <div className="settings-grid">
      <section className="panel settings-card">
        <div className="settings-card-heading">
          <div>
            <div className="panel-kicker">PERSONAL DETAILS</div>
            <h2>Personal information</h2>
            <p>Keep your profile information up to date.</p>
          </div>
        </div>

        <form className="settings-form" onSubmit={handleSaveProfile}>
          <label className="settings-field" htmlFor="settings-display-name">
            <span>Display name</span>
            <small>This name appears in your LifeOS workspace.</small>
            <input
              id="settings-display-name"
              name="displayName"
              type="text"
              autoComplete="name"
              maxLength={80}
              minLength={2}
              value={displayNameDraft}
              onChange={(event) => {
                setDisplayNameDraft(event.target.value);
                setProfileSaveMessage("");
                setProfileSaveError("");
              }}
              required
            />
          </label>
          <label
          className="settings-field"
          htmlFor="settings-date-of-birth"
        >
          <span>Date of birth (optional)</span>

          <small>
            Your age is calculated automatically from your date of birth.
          </small>

          <input
            id="settings-date-of-birth"
            name="dateOfBirth"
            type="date"
            autoComplete="bday"
            value={dateOfBirthDraft}
            onChange={(event) => {
              setDateOfBirthDraft(event.target.value);
              setProfileSaveMessage("");
              setProfileSaveError("");
            }}
          />

          {calculatedAge !== null && (
            <small aria-live="polite">
              Your age: {calculatedAge} years
            </small>
          )}
        </label>
          <label className="settings-field" htmlFor="settings-email">
            <span>Email address</span>
            <small>
              Your email is managed through your authentication account.
            </small>
            <input
              id="settings-email"
              name="email"
              type="email"
              value={accountEmail}
              readOnly
            />
          </label>

          {profileSaveError && (
            <p className="settings-feedback settings-feedback-error" role="alert">
              {profileSaveError}
            </p>
          )}

          {profileSaveMessage && (
            <p
              className="settings-feedback settings-feedback-success"
              role="status"
            >
              {profileSaveMessage}
            </p>
          )}

          <div className="settings-form-footer">
            <span>Changes apply to your personal account.</span>
            <button
              className="primary-button"
              type="submit"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>

              <aside className="settings-side-column">
                <section className="panel settings-card">
                  <div className="settings-card-heading">
                    <div>
                      <div className="panel-kicker">YOUR ACCOUNT</div>
                      <h2>Account overview</h2>
                      <p>Your current LifeOS identity.</p>
                    </div>
                  </div>

                  <div className="settings-identity">
                    <div className="settings-avatar">
                      {accountName.trim().charAt(0).toUpperCase() || "U"}
                    </div>

                    <div className="settings-identity-copy">
                      <strong>{accountName}</strong>
                      <span>{accountEmail || "Email unavailable"}</span>
                    </div>
                  </div>

                  <div className="settings-status">
                    <span className="settings-status-dot" />
                    Authenticated account
                  </div>

                  <p className="settings-privacy-note">
                    Your profile information belongs to your account. LifeOS
                    uses database access controls to restrict access to your
                    own profile.
                  </p>
                </section>

                <section className="panel settings-card settings-next-card">
                  <div className="panel-kicker">COMING NEXT</div>
                  <h2>Personal details &amp; security</h2>
                  <p>
                    Date of birth with automatic age calculation, password
                    management, and verified email-change settings will be
                    added in the next steps.
                  </p>
                </section>
              </aside>
            </div>
          </div>
            ) : activeSection === "Overview" ? (
  
            
            <>
              <section className="welcome-section">
                <div>
                  <div className="eyebrow">
                    <span className="status-dot" />
                    YOUR PERSONAL SPACE
                  </div>
                  <h1>
                    Make today <span>count.</span>
                  </h1>
                  <p>
                    Build better routines, stay focused, and make progress on
                    what matters.
                  </p>
                </div>

                <div className="welcome-decoration" aria-hidden="true">
                  <div className="decoration-ring ring-one" />
                  <div className="decoration-ring ring-two" />
                  <div className="decoration-core">
                    <Sparkles size={27} />
                  </div>
                </div>
              </section>

              <section className="stats-grid" aria-label="Your progress">
                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon streak-icon">
                      <Flame size={19} />
                    </span>
                    <span className="stat-neutral">Consecutive days</span>
                  </div>
                  <div className="stat-label">CURRENT STREAK</div>
                  <div className="stat-value">
                    {currentStreak === null ? (
                      "—"
                    ) : (
                      <>
                        {currentStreak} <span>days</span>
                      </>
                    )}
                  </div>

                  <div className="stat-note">
                    {currentStreak === null
                      ? "Streak history is unavailable."
                      : currentStreak > 0
                        ? "You are building consistency."
                        : "Complete a habit to start your streak."}
                  </div>

                  <div className="stat-progress">
                    <span
                      style={{
                        width: `${(Math.min(currentStreak ?? 0, 7) / 7) * 100}%`,
                      }}
                    />
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon focus-icon">
                      <Timer size={19} />
                    </span>
                    <span className="stat-neutral">Today&apos;s total</span>
                  </div>
                  <div className="stat-label">PRACTICE TIME</div>

                  <div className="stat-value">
                    {practiceMinutesToday === null ? (
                      "—"
                    ) : practiceMinutesToday >= 60 ? (
                      <>
                        {Math.floor(practiceMinutesToday / 60)}
                        <span>h</span> {practiceMinutesToday % 60}
                        <span>m</span>
                      </>
                    ) : (
                      <>
                        {practiceMinutesToday}<span>m</span>
                      </>
                    )}
                  </div>

                  <div className="stat-note">
                    Today's recorded Personal Growth practice time.
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon goal-icon">
                      <Target size={19} />
                    </span>
                    <span className="stat-trend">This week</span>
                  </div>
                  <div className="stat-label">WEEKLY CONSISTENCY</div>
                  <div className="stat-value">
                    {weeklyConsistency === null ? (
                      "—"
                    ) : (
                      <>
                        {weeklyConsistency}<span>%</span>
                      </>
                    )}
                  </div>
                  <div className="stat-note">
                    {weeklyConsistency === null
                      ? "Weekly activity is not available yet."
                      : `You checked in on ${activeCheckInDays} of the last 7 days.`}
                  </div>
                  <div className="stat-progress">
                    <span style={{ width: `${weeklyConsistency ?? 0}%` }} />
                  </div>
                </article>
              </section>

              <section className="dashboard-grid">
                <article className="panel habits-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="panel-kicker">YOUR DAILY ROUTINE</div>
                      <h2>Today&apos;s habits</h2>
                      <p>Every small action moves you forward.</p>
                    </div>

                    <button
                      className="text-button"
                      type="button"
                      onClick={() =>
                        setShowHabitForm((visible) => !visible)
                      }
                    >
                      {showHabitForm ? (
                        "Cancel"
                      ) : (
                        <>
                          <Plus size={14} /> Add habit
                        </>
                      )}
                    </button>
                  </div>

                  <div className="habit-progress">
                    <div className="habit-progress-copy">
                      <strong>
                        {completedHabits} of {habits.length} completed
                      </strong>
                      <span>{progress}%</span>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label="Today's habit completion"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {showHabitForm && (
                    <form
                      className="add-habit-form"
                      onSubmit={addHabit}
                    >
                      <input
                        autoFocus
                        value={newHabit}
                        onChange={(event) => setNewHabit(event.target.value)}
                        placeholder="Enter a habit name..."
                        aria-label="New habit name"
                        maxLength={80}
                        required
                      />
                      <button className="primary-button" type="submit">
                        Add
                      </button>
                    </form>
                  )}

                  <div className="habit-list">
                    {habits.map((habit) => (
                    <div
                      className={`habit-row ${habit.done ? "completed" : ""}`}
                      key={habit.id}
                    >
                      {editingHabitId === habit.id ? (
                        <form className="habit-edit-form" onSubmit={saveHabitEdit}>
                          <label className="habit-edit-field">
                            <span>Habit name</span>
                            <input
                              className="planner-input"
                              autoFocus
                              value={editHabitTitle}
                              onChange={(event) => setEditHabitTitle(event.target.value)}
                              maxLength={80}
                              required
                            />
                          </label>

                          <label className="habit-edit-field">
                            <span>Details</span>
                            <input
                              className="planner-input"
                              value={editHabitMeta}
                              onChange={(event) => setEditHabitMeta(event.target.value)}
                              maxLength={120}
                              placeholder="e.g. 30 minutes daily"
                            />
                          </label>

                          <div className="habit-edit-actions">
                            <button
                              className="primary-button"
                              type="submit"
                              disabled={savingHabitEdit}
                            >
                              {savingHabitEdit ? "Saving..." : "Save"}
                            </button>

                            <button
                              className="text-button"
                              type="button"
                              onClick={cancelHabitEdit}
                              disabled={savingHabitEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <button
                            className="habit-check-in-button"
                            type="button"
                            onClick={() => toggleHabit(habit.id)}
                            aria-pressed={habit.done}
                            aria-label={
                              habit.done
                                ? `Mark ${habit.title} as incomplete`
                                : `Complete ${habit.title}`
                            }
                          >
                            <span
                              className={`habit-check ${habit.done ? "checked" : ""}`}
                            >
                              {habit.done && <Check size={13} />}
                            </span>

                            <span className="habit-symbol">{habit.icon}</span>

                            <span className="habit-copy">
                              <strong>{habit.title}</strong>
                              <small>{habit.meta}</small>
                            </span>

                            <span className="habit-status">
                              {habit.done ? "Completed" : "Check in"}
                            </span>
                          </button>

                          <button
                            className="habit-edit-action"
                            type="button"
                            onClick={() => startHabitEdit(habit)}
                            disabled={savingHabitEdit}
                            aria-label={`Edit ${habit.title}`}
                            title="Edit habit"
                          >
                            <Pencil size={15} />
                          </button>
                                                    <button
                            className="habit-edit-action habit-stop-action"
                            type="button"
                            onClick={() => stopTrackingHabit(habit.id)}
                            disabled={savingHabitEdit}
                            aria-label={`Stop tracking ${habit.title}`}
                            title="Stop tracking habit"
                          >
                            <EyeOff size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  </div>

                  <div className="panel-footer">
                    <span>
                      Your consistency matters more than perfection.
                    </span>
                    <span className="footer-spark">
                      <Sparkles size={15} />
                    </span>
                  </div>
                </article>

                <article className="panel weekly-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="panel-kicker">YOUR MOMENTUM</div>
                      <h2>Weekly activity</h2>
                      <p>A snapshot of your recent progress.</p>
                    </div>
                    <span className="mini-badge">7 days</span>
                  </div>

                  <div className="weekly-summary">
                    <div>
                      <strong>{weeklyCheckInCount ?? "—"}</strong>
                      <span>check-ins</span>
                    </div>
                    <div className="weekly-summary-divider" />
                    <div>
                      <strong>
                        {weeklyTaskCompletion === null
                          ? "—"
                          : `${weeklyTaskCompletion}%`}
                      </strong>
                      <span>task completion</span>
                    </div>
                  </div>

                  <div
                    className="activity-chart"
                    role="img"
                    aria-label="Weekly activity chart"
                  >
                    {weeklyActivity.map((item, index) => (
                      <div
                        className="chart-column"
                        key={`${item.day}-${index}`}
                      >
                        <div className="chart-bar-track">
                          <div
                            className={`chart-bar ${
                              index === weeklyActivity.length - 1 ? "highlight" : ""
                            }`}
                            style={{
                              height: `${item.value}%`,
                              minHeight: item.count === 0 ? 0 : 8,
                            }}
                          />
                        </div>
                        <span>{item.day}</span>
                      </div>
                    ))}
                  </div>

                  <div className="weekly-insight">
                    <span className="insight-icon">
                      <TrendingUp size={17} />
                    </span>
                    <div>
                      <strong>Keep your momentum</strong>
                      <p>
                        Consistent daily actions help turn your goals into
                        habits.
                      </p>
                    </div>
                  </div>
                </article>
              </section>

              <footer className="dashboard-footer">
                <span>Made for the life you&apos;re building.</span>
                <span>
                  <span className="footer-status-dot" />
                  All progress starts somewhere.
                </span>
              </footer>
            </>
          ) : activeSection === "My Day" ? (
            <section className="panel planner-panel">
              <div className="planner-heading">
                <div>
                  <div className="panel-kicker">YOUR DAILY PLAN</div>
                  <h1>My Day</h1>
                  <p>
                    Focus on what matters today. One task at a time.
                  </p>
                  <div className="planner-date">
                    <CalendarDays size={15} />
                    {today || "Your daily plan"}
                  </div>
                </div>

                <button
                  className="text-button"
                  type="button"
                  onClick={() => {  setTaskScope("Today");setShowTaskForm((visible) => !visible);}}
                >
                  <Plus size={14} />
                  {showTaskForm ? "Cancel" : "Add task"}
                </button>
              </div>

              <div className="planner-stats">
                <article className="planner-stat">
                  <span className="planner-stat-icon">
                    <ListTodo size={18} />
                  </span>
                  <span className="planner-stat-label">TOTAL TASKS</span>
                  <strong>{todaysTasks.length}</strong>
                </article>

                <article className="planner-stat">
                  <span className="planner-stat-icon">
                    <Clock3 size={18} />
                  </span>
                  <span className="planner-stat-label">TO DO</span>
                  <strong>{pendingTasks}</strong>
                </article>

                <article className="planner-stat">
                  <span className="planner-stat-icon completed-icon">
                    <CircleCheck size={18} />
                  </span>
                  <span className="planner-stat-label">COMPLETED</span>
                  <strong>{completedTasks}</strong>
                </article>
              </div>

              <div className="planner-progress">
                <div className="habit-progress-copy">
                  <strong>Daily task progress</strong>
                  <span>
                    {todaysTasks.length > 0
                      ? Math.round(
                          (completedTasks / todaysTasks.length) * 100,
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Daily task completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    todaysTasks.length > 0
                      ? Math.round(
                          (completedTasks / todaysTasks.length) * 100,
                        )
                      : 0
                  }
                >
                  <span
                    style={{
                      width: `${
                        todaysTasks.length > 0
                          ? (completedTasks / todaysTasks.length) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {showTaskForm && (
                <form className="planner-form" onSubmit={addTask}>
                  <label className="planner-field">
                    <span>Task name</span>
                    <input
                      className="planner-input"
                      autoFocus
                      value={newTask}
                      onChange={(event) => setNewTask(event.target.value)}
                      placeholder="e.g. Study Java for one hour"
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="planner-field">
                    <span>Date</span>
                    <input
                      className="planner-input"
                      type="date"
                      value={newTaskDate || todayKey || getDateKey(new Date())}
                      min={todayKey || getDateKey(new Date())}
                      onChange={(event) => setNewTaskDate(event.target.value)}
                      required
                    />
                  </label>

                  <label className="planner-field planner-priority-field">
                    <span>Priority</span>
                    <select
                      className="planner-select"
                      value={taskPriority}
                      onChange={(event) =>
                        setTaskPriority(event.target.value as Priority)
                      }
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>

                  <button
                    className="primary-button planner-submit"
                    type="submit"
                  >
                    <Plus size={16} />
                    Add task
                  </button>
                </form>
              )}

              <div className="task-toolbar">
                <div>
                  <h2>{taskScope === "Today" ? "Today's tasks" : "Upcoming tasks"}</h2>
                  <p>
                  {taskScope === "Today"
                    ? "Keep your plan realistic and manageable."
                    : "Your future-dated tasks, ordered by date."}
                </p>

                <div className="task-scope-tabs" aria-label="Task schedule">
                  <button
                    className={`task-filter ${taskScope === "Today" ? "active" : ""}`}
                    type="button"
                    onClick={() => setTaskScope("Today")}
                    aria-pressed={taskScope === "Today"}
                  >
                    Today <span>{todaysTasks.length}</span>
                  </button>

                  <button
                    className={`task-filter ${taskScope === "Upcoming" ? "active" : ""}`}
                    type="button"
                    onClick={() => setTaskScope("Upcoming")}
                    aria-pressed={taskScope === "Upcoming"}
                  >
                    Upcoming <span>{upcomingTasks.length}</span>
                  </button>
                </div>
                </div>

                <div className="task-filters" aria-label="Filter tasks">
                  {(["All", "To do", "Completed"] as TaskFilter[]).map(
                    (filter) => (
                      <button
                        className={`task-filter ${
                          taskFilter === filter ? "active" : ""
                        }`}
                        key={filter}
                        type="button"
                        onClick={() => setTaskFilter(filter)}
                        aria-pressed={taskFilter === filter}
                      >
                        {filter}
                        {filter === "All" && (
                          <span>{todaysTasks.length}</span>
                        )}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="task-list">
                {scopedTasks.length === 0 || filteredTasks.length === 0 ? (
                  <div className="task-empty">
                    <span className="task-empty-icon">
                      {taskFilter === "Completed" ? (
                        <CircleCheck size={25} />
                      ) : (
                        <ListTodo size={25} />
                      )}
                    </span>
                    <h3>
                      {scopedTasks.length === 0
                        ? taskScope === "Today"
                          ? "Start with one small task"
                          : "No upcoming tasks"
                        : taskFilter === "Completed"
                          ? "No completed tasks yet"
                          : "All caught up"}
                    </h3>

                    <p>
                      {scopedTasks.length === 0
                        ? taskScope === "Today"
                          ? "Add a task to turn your plan into action."
                          : "Tasks scheduled for future dates will appear here."
                        : taskFilter === "Completed"
                          ? "Completed tasks will appear here."
                          : "There are no pending tasks in this filter."}
                    </p>

                    {taskScope === "Today" && scopedTasks.length === 0 && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setShowTaskForm(true)}
                      >
                        <Plus size={14} />
                        Create your first task
                      </button>
                    )}
                  </div>
                ) : (
                filteredTasks.map((task) => (
                  <article
                    className={`task-row ${task.completed ? "completed" : ""}`}
                    key={task.id}
                  >
                    {editingTaskId === task.id ? (
                      <form className="task-edit-form" onSubmit={saveTaskEdit}>
                        <label className="task-edit-field task-edit-title">
                          <span>Task name</span>
                          <input
                            className="planner-input"
                            autoFocus
                            value={editTaskTitle}
                            onChange={(event) => setEditTaskTitle(event.target.value)}
                            maxLength={120}
                            required
                          />
                        </label>
                        <label className="task-edit-field task-edit-date">
                        <span>Date</span>
                        <input
                          className="planner-input"
                          type="date"
                          value={editTaskDate}
                          min={todayKey || undefined}
                          onChange={(event) => setEditTaskDate(event.target.value)}
                          required
                        />
                      </label>

                        <label className="task-edit-field task-edit-priority">
                          <span>Priority</span>
                          <select
                            className="planner-select"
                            value={editTaskPriority}
                            onChange={(event) =>
                              setEditTaskPriority(event.target.value as Priority)
                            }
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </label>

                        <div className="task-edit-actions">
                          <button
                            className="primary-button planner-submit"
                            type="submit"
                            disabled={savingTaskEdit}
                          >
                            <Check size={15} />
                            {savingTaskEdit ? "Saving..." : "Save"}
                          </button>

                          <button
                            className="text-button"
                            type="button"
                            onClick={cancelTaskEdit}
                            disabled={savingTaskEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <button
                          className={`task-check ${task.completed ? "checked" : ""}`}
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          aria-label={
                            task.completed
                              ? `Mark ${task.title} as incomplete`
                              : `Complete ${task.title}`
                          }
                          aria-pressed={task.completed}
                        >
                          {task.completed && <Check size={14} />}
                        </button>

                        <div className="task-copy">
                          <strong>{task.title}</strong>
                          <span>
                          <CalendarDays size={12} />
                          {task.date === todayKey
                            ? "Today"
                            : new Date(`${task.date}T00:00:00`).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                          </span>
                        </div>

                        <span
                          className={`task-priority priority-${task.priority.toLowerCase()}`}
                        >
                          {task.priority}
                        </span>

                        <button
                          className="task-edit-button"
                          type="button"
                          onClick={() => startTaskEdit(task)}
                          disabled={savingTaskEdit}
                          aria-label={`Edit ${task.title}`}
                          title="Edit task"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          className="task-delete"
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          aria-label={`Delete ${task.title}`}
                          title="Delete task"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </article>
                ))
                )}
              </div>

              <div className="planner-footer">
                <Sparkles size={15} />
                <span>
                  Progress, not perfection. You can always adjust your plan.
                </span>
              </div>
            </section>
          ) : activeSection === "Goals" ? (
            <GoalsWorkspace />
          ) : activeSection === "Academics" ? (
            <AcademicsWorkspace />
          ) : (
            <section className="panel section-placeholder">
              <div className="panel-kicker">YOUR LIFEOS WORKSPACE</div>
              <h1>{activeSection}</h1>
              <p>
                Your {activeSection.toLowerCase()} workspace is ready for the
                next stage of development.
              </p>
              <button
                className="text-button"
                type="button"
                onClick={() => changeSection("Overview")}
              >
                Back to overview
              </button>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}