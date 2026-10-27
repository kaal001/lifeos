"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useConfirmDialog } from "@/app/confirm-dialog-provider";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarDays,
  Check,
  CircleCheck,
  Flag,
  Plus,
  ArrowDown,
  ArrowUp,
  Pencil,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";

type Milestone = {
  id: string;
  title: string;
  completed: boolean;
  sortOrder: number;
};

type Goal = {
  id: string;
  title: string;
  description: string;
  category: string;
  targetDate: string;
  milestones: Milestone[];
  createdAt: string;
};

type GoalDraft = {
  title: string;
  description: string;
  category: string;
  targetDate: string;
};


const initialDraft: GoalDraft = {
  title: "",
  description: "",
  category: "Personal",
  targetDate: "",
};

  function isMilestone(value: unknown): value is Milestone {
    if (!value || typeof value !== "object") return false;

    const item = value as Record<string, unknown>;

    return (
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.completed === "boolean" &&
      typeof item.sortOrder === "number"
    );
  }

function isGoal(value: unknown): value is Goal {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.description === "string" &&
    typeof item.category === "string" &&
    typeof item.targetDate === "string" &&
    typeof item.createdAt === "string" &&
    Array.isArray(item.milestones) &&
    item.milestones.every(isMilestone)
  );
}

function getProgress(goal: Goal) {
  if (goal.milestones.length === 0) return 0;

  const completed = goal.milestones.filter(
    (milestone) => milestone.completed,
  ).length;

  return Math.round((completed / goal.milestones.length) * 100);
}

function formatDate(value: string) {
  if (!value) return "No target date";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDateStatus(targetDate: string) {
  if (!targetDate) return "No deadline";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${targetDate}T12:00:00`);

  if (Number.isNaN(target.getTime())) return "Invalid date";

  target.setHours(0, 0, 0, 0);

  const difference = Math.ceil(
    (target.getTime() - today.getTime()) / 86400000,
  );

  if (difference < 0) return "Overdue";
  if (difference === 0) return "Due today";
  if (difference === 1) return "1 day left";

  return `${difference} days left`;
}


export default function GoalsWorkspace() {
  const { requestConfirmation } = useConfirmDialog();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<GoalDraft>(initialDraft);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<GoalDraft>(initialDraft);
  const [savingGoalEdit, setSavingGoalEdit] = useState(false);
  const [milestoneInputs, setMilestoneInputs] = useState<
    Record<string, string>
  >({});
  const [addingMilestoneTo, setAddingMilestoneTo] = useState<string | null>(
    null,
  );
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(
  null,
  );
  const [editMilestoneTitle, setEditMilestoneTitle] = useState("");
  const [savingMilestoneEdit, setSavingMilestoneEdit] = useState(false);
  const [savingMilestoneOrder, setSavingMilestoneOrder] = useState(false);


useEffect(() => {
  let cancelled = false;

  async function loadGoals() {
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

      const { data: goalRows, error: goalError } = await supabase
        .from("goals")
        .select("id, title, description, category, target_date, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (goalError) throw goalError;

      const { data: milestoneRows, error: milestoneError } = await supabase
        .from("goal_milestones")
        .select("id, goal_id, title, completed, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (milestoneError) throw milestoneError;

      const milestones = milestoneRows ?? [];

      const cloudGoals: Goal[] = (goalRows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? "",
        category: row.category,
        targetDate: row.target_date ?? "",
        createdAt: row.created_at,
        milestones: milestones
          .filter((item) => item.goal_id === row.id)
          .map((item) => ({
            id: item.id,
            title: item.title,
            completed: item.completed,
            sortOrder: item.sort_order,
          })),
        }));  

      if (!cancelled) {
        setGoals(cloudGoals);
        setLoadError(null);
      }
    } catch (error) {
      console.error("Could not load cloud goals:", error);

      if (!cancelled) {
        setGoals([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load your goals. Please try again.",
        );
      }
    } finally {
      if (!cancelled) {
        setLoaded(true);
      }
    }
  }

  void loadGoals();

  return () => {
    cancelled = true;
  };
}, []);


  const completedGoals = goals.filter(
    (goal) =>
      goal.milestones.length > 0 &&
      goal.milestones.every((milestone) => milestone.completed),
  ).length;

  const overallProgress =
    goals.length > 0
      ? Math.round(
          goals.reduce((sum, goal) => sum + getProgress(goal), 0) /
            goals.length,
        )
      : 0;

  function updateDraft<K extends keyof GoalDraft>(
    key: K,
    value: GoalDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }


async function createGoal(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const title = draft.title.trim();
  const description = draft.description.trim();
  const category = draft.category.trim();

  if (!title || !category) return;

  if (
    draft.targetDate &&
    Number.isNaN(
      new Date(`${draft.targetDate}T12:00:00`).getTime()
    )
  ) {
    return;
  }

  if (!userId) {
    alert("Your session was not found. Please sign in again.");
    return;
  }

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("goals")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        title: title.slice(0, 100),
        description: description.slice(0, 300),
        category: category.slice(0, 40),
        target_date: draft.targetDate || null,
      })
      .select(
        "id, title, description, category, target_date, created_at"
      )
      .single();

    if (error) throw error;

    const goal: Goal = {
      id: data.id,
      title: data.title,
      description: data.description ?? "",
      category: data.category,
      targetDate: data.target_date ?? "",
      createdAt: data.created_at,
      milestones: [],
    };

    setGoals((current) => [goal, ...current]);
    setDraft(initialDraft);
    setShowForm(false);
  } catch (error) {
    console.error("Could not create goal:", error);
    alert("Could not create the goal. Please try again.");
  }
}

function startGoalEdit(goal: Goal) {
  setEditingGoalId(goal.id);
  setEditDraft({
    title: goal.title,
    description: goal.description,
    category: goal.category,
    targetDate: goal.targetDate,
  });
  setShowForm(false);
  setDraft(initialDraft);
  setAddingMilestoneTo(null);
}

function cancelGoalEdit() {
  if (savingGoalEdit) return;

  setEditingGoalId(null);
  setEditDraft(initialDraft);
}

async function saveGoalEdit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const goalId = editingGoalId;
  const title = editDraft.title.trim();
  const description = editDraft.description.trim();
  const category = editDraft.category.trim();

  if (!goalId || !title || !category || savingGoalEdit) return;

  if (!userId) {
    window.alert("Your session was not found. Please sign in again.");
    return;
  }

  if (
    editDraft.targetDate &&
    Number.isNaN(
      new Date(`${editDraft.targetDate}T12:00:00`).getTime(),
    )
  ) {
    window.alert("Please enter a valid target date.");
    return;
  }

  const existingGoal = goals.find((goal) => goal.id === goalId);
  if (!existingGoal) return;

  setSavingGoalEdit(true);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("goals")
      .update({
        title: title.slice(0, 100),
        description: description.slice(0, 300),
        category: category.slice(0, 40),
        target_date: editDraft.targetDate || null,
      })
      .eq("user_id", userId)
      .eq("id", goalId)
      .select("id, title, description, category, target_date")
      .single();

    if (error) throw error;

    setGoals((current) =>
      current.map((goal) =>
        goal.id === goalId
          ? {
              ...goal,
              title: data.title,
              description: data.description ?? "",
              category: data.category,
              targetDate: data.target_date ?? "",
            }
          : goal,
      ),
    );

    setEditingGoalId(null);
    setEditDraft(initialDraft);
    setLoadError(null);
  } catch (error) {
    console.error("Could not update goal:", error);

    window.alert(
      `Could not update this goal. ${
        error instanceof Error ? error.message : "Please try again."
      }`,
    );
  } finally {
    setSavingGoalEdit(false);
  }
}
async function addMilestone(
  event: FormEvent<HTMLFormElement>,
  goalId: string
) {
  event.preventDefault();

  const title = (milestoneInputs[goalId] ?? "").trim();
  if (!title) return;

  if (!userId) {
    alert("Your session was not found. Please sign in again.");
    return;
  }

  const goal = goals.find((item) => item.id === goalId);
  if (!goal) return;

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("goal_milestones")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        goal_id: goalId,
        title: title.slice(0, 100),
        completed: false,
        sort_order: goal.milestones.length,
      })
      .select("id, title, completed, sort_order")
      .single();

    if (error) throw error;

    const milestone: Milestone = {
      id: data.id,
      title: data.title,
      completed: data.completed,
      sortOrder: data.sort_order,
    };

    setGoals((current) =>
      current.map((item) =>
        item.id === goalId
          ? {
              ...item,
              milestones: [...item.milestones, milestone],
            }
          : item
      )
    );

    setMilestoneInputs((current) => ({
      ...current,
      [goalId]: "",
    }));
    setAddingMilestoneTo(null);
  } catch (error) {
    console.error("Could not add milestone:", error);
    alert("Could not add the milestone. Please try again.");
  }
}

  async function toggleMilestone(
    goalId: string,
    milestoneId: string
  ) {
    if (!userId) {
      alert("Your session was not found. Please sign in again.");
      return;
    }

    const goal = goals.find((item) => item.id === goalId);
    const milestone = goal?.milestones.find(
      (item) => item.id === milestoneId
    );

    if (!milestone) return;

    const nextCompleted = !milestone.completed;

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("goal_milestones")
        .update({ completed: nextCompleted })
        .eq("user_id", userId)
        .eq("goal_id", goalId)
        .eq("id", milestoneId);

      if (error) throw error;

      setGoals((current) =>
        current.map((item) =>
          item.id === goalId
            ? {
                ...item,
                milestones: item.milestones.map((milestoneItem) =>
                  milestoneItem.id === milestoneId
                    ? { ...milestoneItem, completed: nextCompleted }
                    : milestoneItem
                ),
              }
            : item
        )
      );
    } catch (error) {
      console.error("Could not update milestone:", error);
      alert("Could not update the milestone. Please try again.");
    }
  }
  function startMilestoneEdit(milestone: Milestone) {
  setEditingMilestoneId(milestone.id);
  setEditMilestoneTitle(milestone.title);
  setAddingMilestoneTo(null);
}

  function cancelMilestoneEdit() {
    if (savingMilestoneEdit) return;

    setEditingMilestoneId(null);
    setEditMilestoneTitle("");
  }

  async function saveMilestoneEdit(
    event: FormEvent<HTMLFormElement>,
    goalId: string,
    milestoneId: string,
  ) {
    event.preventDefault();

    const title = editMilestoneTitle.trim();

    if (!title || !userId || savingMilestoneEdit) return;

    const goal = goals.find((item) => item.id === goalId);
    const milestone = goal?.milestones.find(
      (item) => item.id === milestoneId,
    );

    if (!milestone) return;

    setSavingMilestoneEdit(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("goal_milestones")
        .update({ title: title.slice(0, 100) })
        .eq("user_id", userId)
        .eq("goal_id", goalId)
        .eq("id", milestoneId)
        .select("id, title, completed")
        .single();

      if (error) throw error;

      setGoals((current) =>
        current.map((item) =>
          item.id === goalId
            ? {
                ...item,
                milestones: item.milestones.map((existing) =>
                  existing.id === milestoneId
                    ? { ...existing, title: data.title }
                    : existing,
                ),
              }
            : item,
        ),
      );

      setEditingMilestoneId(null);
      setEditMilestoneTitle("");
    } catch (error) {
      console.error("Could not update milestone:", error);

      window.alert(
        `Could not update this milestone. ${
          error instanceof Error ? error.message : "Please try again."
        }`,
      );
    } finally {
      setSavingMilestoneEdit(false);
    }
  }
  async function moveMilestone(
    goalId: string,
    milestoneId: string,
    direction: -1 | 1,
  ) {
    if (!userId || savingMilestoneOrder) return;

    const goal = goals.find((item) => item.id === goalId);
    if (!goal) return;

    const currentIndex = goal.milestones.findIndex(
      (item) => item.id === milestoneId,
    );
    const neighborIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      neighborIndex < 0 ||
      neighborIndex >= goal.milestones.length
    ) {
      return;
    }

    const current = goal.milestones[currentIndex];
    const neighbor = goal.milestones[neighborIndex];
    const temporaryOrder =
      Math.max(...goal.milestones.map((item) => item.sortOrder), -1) + 1;

    const supabase = createClient();
    let movedCurrentToTemporary = false;
    let movedNeighbor = false;

    setSavingMilestoneOrder(true);

    try {
      const { error: temporaryError } = await supabase
        .from("goal_milestones")
        .update({ sort_order: temporaryOrder })
        .eq("user_id", userId)
        .eq("goal_id", goalId)
        .eq("id", current.id);

      if (temporaryError) throw temporaryError;
      movedCurrentToTemporary = true;

      const { error: neighborError } = await supabase
        .from("goal_milestones")
        .update({ sort_order: current.sortOrder })
        .eq("user_id", userId)
        .eq("goal_id", goalId)
        .eq("id", neighbor.id);

      if (neighborError) throw neighborError;
      movedNeighbor = true;

      const { error: currentError } = await supabase
        .from("goal_milestones")
        .update({ sort_order: neighbor.sortOrder })
        .eq("user_id", userId)
        .eq("goal_id", goalId)
        .eq("id", current.id);

      if (currentError) throw currentError;

      setGoals((allGoals) =>
        allGoals.map((item) => {
          if (item.id !== goalId) return item;

          const updatedMilestones = item.milestones
            .map((milestone) =>
              milestone.id === current.id
                ? { ...milestone, sortOrder: neighbor.sortOrder }
                : milestone.id === neighbor.id
                  ? { ...milestone, sortOrder: current.sortOrder }
                  : milestone,
            )
            .sort((a, b) => a.sortOrder - b.sortOrder);

          return { ...item, milestones: updatedMilestones };
        }),
      );
    } catch (error) {
      console.error("Could not reorder milestones:", error);

      let rollbackFailed = false;

      if (movedNeighbor) {
        const { error: rollbackNeighborError } = await supabase
          .from("goal_milestones")
          .update({ sort_order: neighbor.sortOrder })
          .eq("user_id", userId)
          .eq("goal_id", goalId)
          .eq("id", neighbor.id);

        if (rollbackNeighborError) {
          rollbackFailed = true;
          console.error(
            "Could not restore milestone order:",
            rollbackNeighborError,
          );
        }
      }

      if (movedCurrentToTemporary && !rollbackFailed) {
        const { error: rollbackCurrentError } = await supabase
          .from("goal_milestones")
          .update({ sort_order: current.sortOrder })
          .eq("user_id", userId)
          .eq("goal_id", goalId)
          .eq("id", current.id);

        if (rollbackCurrentError) {
          rollbackFailed = true;
          console.error(
            "Could not restore milestone order:",
            rollbackCurrentError,
          );
        }
      }

      window.alert(
        rollbackFailed
          ? "Could not fully restore the milestone order. Please refresh and check it."
          : "Could not reorder milestones. Your previous order has been restored.",
      );
    } finally {
      setSavingMilestoneOrder(false);
    }
  }
  async function deleteMilestone(
    goalId: string,
    milestoneId: string,
  ) {
    if (!userId) {
      alert("Your session was not found. Please sign in again.");
      return;
    }

    const goal = goals.find((item) => item.id === goalId);
    const milestone = goal?.milestones.find(
      (item) => item.id === milestoneId,
    );

    if (!milestone) return;

  const confirmed = await requestConfirmation({
    title: "Delete this milestone?",
    message: `Are you sure you want to delete the milestone "${milestone.title}"? This action cannot be undone.`,
    confirmLabel: "Delete milestone",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("goal_milestones")
        .delete()
        .eq("user_id", userId)
        .eq("goal_id", goalId)
        .eq("id", milestoneId);

      if (error) throw error;

      setGoals((current) =>
        current.map((item) =>
          item.id === goalId
            ? {
                ...item,
                milestones: item.milestones.filter(
                  (item) => item.id !== milestoneId,
                ),
              }
            : item,
        ),
      );
    } catch (error) {
      console.error("Could not delete milestone:", error);
      alert("Could not delete the milestone. Please try again.");
    }
  }
  async function deleteGoal(goalId: string) {
    if (!userId) {
      alert("Your session was not found. Please sign in again.");
      return;
    }

    const goal = goals.find((item) => item.id === goalId);
    if (!goal) return;

  const confirmed = await requestConfirmation({
    title: "Delete this goal?",
    message: `Are you sure you want to delete "${goal.title}"? This action cannot be undone.`,
    confirmLabel: "Delete goal",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("user_id", userId)
        .eq("id", goalId);

      if (error) throw error;

      setGoals((current) =>
        current.filter((item) => item.id !== goalId),
      );

      setAddingMilestoneTo(null);
    } catch (error) {
      console.error("Could not delete goal:", error);
      alert("Could not delete the goal. Please try again.");
    }
  }

  if (!loaded) {
    return <section className="panel goals-loading">Loading your goals...</section>;
  }
  if (loadError) {
  return (
    <section className="panel goals-loading">
      <p>Could not load your cloud goals.</p>
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
    <section className="goals-workspace">
      <div className="goals-page-heading">
        <div>
          <div className="panel-kicker">TURN INTENTIONS INTO ACTION</div>
          <h1>Your goals</h1>
          <p>
            Break big ambitions into smaller milestones and make steady
            progress.
          </p>
        </div>

        <button
          className="text-button"
          type="button"
          onClick={() => setShowForm((current) => !current)}
        >
          <Plus size={15} />
          {showForm ? "Cancel" : "Create goal"}
        </button>
      </div>

      <div className="goals-summary">
        <article className="goals-summary-card">
          <span className="goals-summary-icon">
            <Target size={19} />
          </span>
          <div>
            <span className="goals-summary-label">TOTAL GOALS</span>
            <strong>{goals.length}</strong>
          </div>
        </article>

        <article className="goals-summary-card">
          <span className="goals-summary-icon">
            <Trophy size={19} />
          </span>
          <div>
            <span className="goals-summary-label">GOALS COMPLETED</span>
            <strong>{completedGoals}</strong>
          </div>
        </article>

        <article className="goals-summary-card">
          <span className="goals-summary-icon">
            <CircleCheck size={19} />
          </span>
          <div>
            <span className="goals-summary-label">AVERAGE PROGRESS</span>
            <strong>{overallProgress}%</strong>
          </div>
        </article>
      </div>

      {showForm && (
        <form className="panel goals-create-form" onSubmit={createGoal}>
          <div className="goals-form-heading">
            <div>
              <h2>Create a goal</h2>
              <p>Define what you want to achieve.</p>
            </div>
            <Flag size={20} />
          </div>

          <div className="goals-form-grid">
            <label className="goals-field goals-field-full">
              <span>Goal name</span>
              <input
                autoFocus
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder="e.g. Become job-ready in frontend development"
                maxLength={100}
                required
              />
            </label>

            <label className="goals-field">
              <span>Category</span>
              <select
                value={draft.category}
                onChange={(event) =>
                  updateDraft("category", event.target.value)
                }
              >
                <option value="Personal">Personal</option>
                <option value="Academics">Academics</option>
                <option value="Career">Career</option>
                <option value="Fitness">Fitness</option>
                <option value="Learning">Learning</option>
                <option value="Finance">Finance</option>
              </select>
            </label>

            <label className="goals-field">
              <span>Target date</span>
              <input
                type="date"
                value={draft.targetDate}
                onChange={(event) =>
                  updateDraft("targetDate", event.target.value)
                }
              />
            </label>

            <label className="goals-field goals-field-full">
              <span>Description (optional)</span>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  updateDraft("description", event.target.value)
                }
                placeholder="Why does this goal matter to you?"
                maxLength={300}
                rows={3}
              />
            </label>
          </div>

          <div className="goals-form-actions">
            <button
              className="text-button goals-cancel"
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
              Create goal
            </button>
          </div>
        </form>
      )}

      <div className="goals-list-heading">
        <div>
          <h2>Your active goals</h2>
          <p>Every completed milestone moves you forward.</p>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="panel goals-empty">
          <span className="goals-empty-icon">
            <Target size={26} />
          </span>
          <h3>Start with something that matters</h3>
          <p>
            Create your first goal, set a target date, and break it into
            achievable milestones.
          </p>
          <button
            className="text-button"
            type="button"
            onClick={() => setShowForm(true)}
          >
            <Plus size={15} />
            Create your first goal
          </button>
        </div>
      ) : (
        <div className="goals-grid">
          {goals.map((goal) => {
            const progress = getProgress(goal);
            const allComplete =
              goal.milestones.length > 0 && progress === 100;
            const dateStatus = getDateStatus(goal.targetDate);

            return (
              <article className="panel goal-card" key={goal.id}>
                <div className="goal-card-top">
                  <span className="goal-category">{goal.category}</span>
                  <button
                    className="goal-edit"
                    type="button"
                    onClick={() => startGoalEdit(goal)}
                    disabled={savingGoalEdit}
                    title="Edit goal"
                    aria-label={`Edit goal ${goal.title}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="goal-delete"
                    type="button"
                    onClick={() => deleteGoal(goal.id)}
                    title="Delete goal"
                    aria-label={`Delete goal ${goal.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {editingGoalId === goal.id && (
                  <form
                    className="goal-edit-form"
                    onSubmit={saveGoalEdit}
                  >
                    <div className="goals-form-heading">
                      <div>
                        <h2>Edit goal</h2>
                        <p>Update the details of your goal.</p>
                      </div>
                      <Flag size={20} />
                    </div>

                    <div className="goals-form-grid">
                      <label className="goals-field goals-field-full">
                        <span>Goal name</span>
                        <input
                          autoFocus
                          value={editDraft.title}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          maxLength={100}
                          required
                        />
                      </label>

                      <label className="goals-field">
                        <span>Category</span>
                        <select
                          value={editDraft.category}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                        >
                          <option value="Personal">Personal</option>
                          <option value="Academics">Academics</option>
                          <option value="Career">Career</option>
                          <option value="Fitness">Fitness</option>
                          <option value="Learning">Learning</option>
                          <option value="Finance">Finance</option>
                        </select>
                      </label>

                      <label className="goals-field">
                        <span>Target date</span>
                        <input
                          type="date"
                          value={editDraft.targetDate}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              targetDate: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="goals-field goals-field-full">
                        <span>Description (optional)</span>
                        <textarea
                          value={editDraft.description}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          maxLength={300}
                          rows={3}
                        />
                      </label>
                    </div>

                    <div className="goals-form-actions">
                      <button
                        className="text-button goals-cancel"
                        type="button"
                        onClick={cancelGoalEdit}
                        disabled={savingGoalEdit}
                      >
                        Cancel
                      </button>

                      <button
                        className="primary-button"
                        type="submit"
                        disabled={savingGoalEdit}
                      >
                        <Check size={15} />
                        {savingGoalEdit ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </form>
                )}

                <h3>{goal.title}</h3>

                {goal.description && <p className="goal-description">{goal.description}</p>}

                <div className="goal-date-row">
                  <CalendarDays size={14} />
                  <span>{formatDate(goal.targetDate)}</span>
                  {goal.targetDate && (
                    <span
                      className={`goal-date-status ${
                        dateStatus === "Overdue" ? "overdue" : ""
                      }`}
                    >
                      {dateStatus}
                    </span>
                  )}
                </div>

                <div className="goal-progress-heading">
                  <span>Overall progress</span>
                  <strong>{progress}%</strong>
                </div>

                <div
                  className="goal-progress-track"
                  role="progressbar"
                  aria-label={`${goal.title} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>

                <div className="goal-milestones-heading">
                  <strong>Milestones</strong>
                  <span>
                    {goal.milestones.filter((item) => item.completed).length} of{" "}
                    {goal.milestones.length}
                  </span>
                </div>

                {goal.milestones.length === 0 ? (
                  <p className="goal-no-milestones">
                    Add milestones to track this goal&apos;s progress.
                  </p>
                ) : (
                  <div className="goal-milestone-list">
                    {goal.milestones.map((milestone, milestoneIndex) => (
                      <div className="goal-milestone-row" key={milestone.id}>
                        <button
                          className={`goal-milestone-check ${
                            milestone.completed ? "checked" : ""
                          }`}
                          type="button"
                          onClick={() =>
                            toggleMilestone(goal.id, milestone.id)
                          }
                          aria-label={
                            milestone.completed
                              ? `Mark ${milestone.title} incomplete`
                              : `Complete ${milestone.title}`
                          }
                          aria-pressed={milestone.completed}
                        >
                          {milestone.completed && <Check size={12} />}
                        </button>

                        {editingMilestoneId === milestone.id ? (
                          <form
                            className="goal-milestone-edit-form"
                            onSubmit={(event) =>
                              saveMilestoneEdit(event, goal.id, milestone.id)
                            }
                          >
                            <input
                              autoFocus
                              aria-label={`Edit milestone ${milestone.title}`}
                              value={editMilestoneTitle}
                              onChange={(event) =>
                                setEditMilestoneTitle(event.target.value)
                              }
                              maxLength={100}
                              required
                            />

                            <button
                              className="goal-milestone-inline-save"
                              type="submit"
                              disabled={savingMilestoneEdit}
                              aria-label="Save milestone"
                              title="Save"
                            >
                              <Check size={13} />
                            </button>

                            <button
                              className="goal-milestone-inline-cancel"
                              type="button"
                              onClick={cancelMilestoneEdit}
                              disabled={savingMilestoneEdit}
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <>
                            <span
                              className={`goal-milestone-title ${
                                milestone.completed ? "completed" : ""
                              }`}
                            >
                              {milestone.title}
                            </span>

                            <button
                              className="goal-milestone-edit"
                              type="button"
                              onClick={() => startMilestoneEdit(milestone)}
                              disabled={savingMilestoneEdit}
                              title="Edit milestone"
                              aria-label={`Edit milestone ${milestone.title}`}
                            >
                              <Pencil size={13} />
                            </button>
                          </>
                        )}
                        <div className="goal-milestone-order-controls">
                          <button
                            className="goal-milestone-move"
                            type="button"
                            onClick={() => moveMilestone(goal.id, milestone.id, -1)}
                            disabled={
                              savingMilestoneOrder ||
                              savingMilestoneEdit ||
                              editingMilestoneId === milestone.id ||
                              milestoneIndex === 0
                            }
                            title="Move milestone up"
                            aria-label={`Move ${milestone.title} up`}
                          >
                            <ArrowUp size={13} />
                          </button>

                          <button
                            className="goal-milestone-move"
                            type="button"
                            onClick={() => moveMilestone(goal.id, milestone.id, 1)}
                            disabled={
                              savingMilestoneOrder ||
                              savingMilestoneEdit ||
                              editingMilestoneId === milestone.id ||
                              milestoneIndex === goal.milestones.length - 1
                            }
                            title="Move milestone down"
                            aria-label={`Move ${milestone.title} down`}
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        <button
                          className="goal-milestone-delete"
                          type="button"
                          onClick={() =>
                            deleteMilestone(goal.id, milestone.id)
                          }
                          title="Delete milestone"
                          aria-label={`Delete milestone ${milestone.title}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {addingMilestoneTo === goal.id ? (
                  <form
                    className="goal-milestone-form"
                    onSubmit={(event) => addMilestone(event, goal.id)}
                  >
                    <input
                      autoFocus
                      value={milestoneInputs[goal.id] ?? ""}
                      onChange={(event) =>
                        setMilestoneInputs((current) => ({
                          ...current,
                          [goal.id]: event.target.value,
                        }))
                      }
                      placeholder="Milestone name..."
                      maxLength={100}
                      required
                    />
                    <button className="primary-button" type="submit">
                      Add
                    </button>
                  </form>
                ) : (
                  <button
                    className="goal-add-milestone"
                    type="button"
                    onClick={() => setAddingMilestoneTo(goal.id)}
                  >
                    <Plus size={14} />
                    Add milestone
                  </button>
                )}

                {allComplete && (
                  <div className="goal-complete-note">
                    <Trophy size={15} />
                    Goal milestones completed!
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="goals-note">
        <CircleCheck size={16} />
        <span>
           Your goals and milestones sync securely with your account.
        </span>
      </div>
    </section>
  );
}