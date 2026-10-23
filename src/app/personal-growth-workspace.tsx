"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useConfirmDialog } from "./confirm-dialog-provider";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  FolderKanban,
  Link2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
  Pencil,
} from "lucide-react";

type Milestone = {
  id: string;
  title: string;
  completed: boolean;
};

type PracticeSession = {
  id: string;
  date: string;
  minutes: number;
  note: string;
};

type LearningLink = {
  id: string;
  title: string;
  kind: "Project" | "Resource" | "Certificate";
  url: string;
};

type LearningPath = {
  id: string;
  title: string;
  category: string;
  description: string;
  targetDate: string;
  milestones: Milestone[];
  sessions: PracticeSession[];
  links: LearningLink[];
};

type PathDraft = {
  title: string;
  category: string;
  description: string;
  targetDate: string;
};

type SessionDraft = {
  date: string;
  minutes: string;
  note: string;
};

type LinkDraft = {
  title: string;
  kind: LearningLink["kind"];
  url: string;
};


const initialPathDraft: PathDraft = {
  title: "",
  category: "Programming",
  description: "",
  targetDate: "",
};

const initialSessionDraft: SessionDraft = {
  date: "",
  minutes: "30",
  note: "",
};

const initialLinkDraft: LinkDraft = {
  title: "",
  kind: "Project",
  url: "",
};

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return "No target date";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours === 0) return `${remaining} min`;
  if (remaining === 0) return `${hours}h`;

  return `${hours}h ${remaining}m`;
}

function getHttpUrl(value: string): string | null {
  if (!value.trim()) return "";

  try {
    const parsed = new URL(value.trim());

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function normalizePath(value: unknown): LearningPath | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    !item.title.trim()
  ) {
    return null;
  }

  const milestones: Milestone[] = Array.isArray(item.milestones)
    ? item.milestones
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
        .filter(
          (entry) =>
            typeof entry.id === "string" &&
            typeof entry.title === "string" &&
            entry.title.trim().length > 0,
        )
        .map((entry) => ({
          id: entry.id as string,
          title: entry.title as string,
          completed: entry.completed === true,
        }))
    : [];

  const sessions: PracticeSession[] = Array.isArray(item.sessions)
    ? item.sessions
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
        .filter(
          (entry) =>
            typeof entry.id === "string" &&
            typeof entry.date === "string" &&
            typeof entry.minutes === "number" &&
            Number.isFinite(entry.minutes) &&
            entry.minutes > 0,
        )
        .map((entry) => ({
          id: entry.id as string,
          date: entry.date as string,
          minutes: entry.minutes as number,
          note: typeof entry.note === "string" ? entry.note : "",
        }))
    : [];

  const links: LearningLink[] = Array.isArray(item.links)
    ? item.links
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
        .filter(
          (entry) =>
            typeof entry.id === "string" &&
            typeof entry.title === "string" &&
            ["Project", "Resource", "Certificate"].includes(
              String(entry.kind),
            ),
        )
        .map((entry) => ({
          id: entry.id as string,
          title: entry.title as string,
          kind: entry.kind as LearningLink["kind"],
          url:typeof entry.url === "string"? getHttpUrl(entry.url) ?? "": "",
        })): [];

  return {
    id: item.id,
    title: item.title,
    category: typeof item.category === "string" ? item.category : "General",
    description:
      typeof item.description === "string" ? item.description : "",
    targetDate: typeof item.targetDate === "string" ? item.targetDate : "",
    milestones,
    sessions,
    links,
  };
}

export default function PersonalGrowthWorkspace() {
    const { requestConfirmation } = useConfirmDialog();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPathForm, setShowPathForm] = useState(false);
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  const [pathDraft, setPathDraft] = useState<PathDraft>(initialPathDraft);

  const [expandedPathId, setExpandedPathId] = useState<string | null>(null);

  const [milestoneDrafts, setMilestoneDrafts] = useState<
    Record<string, string>
  >({});
  const [editingMilestoneId, setEditingMilestoneId] =
  useState<string | null>(null);
  const [editingMilestonePathId, setEditingMilestonePathId] =
    useState<string | null>(null);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState("");
  const [savingMilestoneEdit, setSavingMilestoneEdit] = useState(false);
  const [sessionDrafts, setSessionDrafts] = useState<
    Record<string, SessionDraft>
  >({});
  const [linkDrafts, setLinkDrafts] = useState<Record<string, LinkDraft>>({});
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkPathId, setEditingLinkPathId] = useState<string | null>(null);
  const [editLinkDraft, setEditLinkDraft] =
    useState<LinkDraft>(initialLinkDraft);
  const [savingLinkEdit, setSavingLinkEdit] = useState(false);

  const [activeMilestoneForm, setActiveMilestoneForm] = useState<string | null>(
    null,
  );
  const [activeSessionForm, setActiveSessionForm] = useState<string | null>(
    null,
  );
  const [activeLinkForm, setActiveLinkForm] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});


  useEffect(() => {
    let cancelled = false;

    async function loadPersonalGrowthData() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          throw new Error(
            "Your session was not found. Please sign in again.",
          );
        }

        if (!cancelled) {
          setUserId(user.id);
        }

        const [
          { data: pathRows, error: pathError },
          { data: milestoneRows, error: milestoneError },
          { data: sessionRows, error: sessionError },
          { data: linkRows, error: linkError },
        ] = await Promise.all([
          supabase
            .from("learning_paths")
            .select("id, title, category, description, target_date, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("learning_milestones")
            .select("id, learning_path_id, title, completed, sort_order")
            .eq("user_id", user.id)
            .order("sort_order", { ascending: true }),

          supabase
            .from("practice_sessions")
            .select("id, learning_path_id, practice_date, minutes, note, created_at")
            .eq("user_id", user.id)
            .order("practice_date", { ascending: false }),

          supabase
            .from("learning_links")
            .select("id, learning_path_id, title, link_kind, url, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
        ]);

        if (pathError) throw pathError;
        if (milestoneError) throw milestoneError;
        if (sessionError) throw sessionError;
        if (linkError) throw linkError;

        const cloudPaths: LearningPath[] = (pathRows ?? [])
          .map((path) =>
            normalizePath({
              id: path.id,
              title: path.title,
              category: path.category,
              description: path.description,
              targetDate: path.target_date ?? "",
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
                  url: item.url ?? "",
                })),
            }),
          )
          .filter((path): path is LearningPath => path !== null);

        if (!cancelled) {
          setPaths(cloudPaths);
          setLoadError(null);
        }
      } catch (error) {
        console.error("Could not load cloud learning data:", error);

        if (!cancelled) {
          setPaths([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load your learning data. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void loadPersonalGrowthData();

    return () => {
      cancelled = true;
    };
  }, []);


  const totalMilestones = paths.reduce(
    (sum, path) => sum + path.milestones.length,
    0,
  );

  const completedMilestones = paths.reduce(
    (sum, path) =>
      sum + path.milestones.filter((milestone) => milestone.completed).length,
    0,
  );

  const totalPracticeMinutes = paths.reduce(
    (sum, path) =>
      sum + path.sessions.reduce((sessionSum, session) => sessionSum + session.minutes, 0),
    0,
  );

  const projectCount = paths.reduce(
    (sum, path) =>
      sum + path.links.filter((link) => link.kind === "Project").length,
    0,
  );

  function openNewPathForm() {
    setEditingPathId(null);
    setPathDraft(initialPathDraft);
    setFormErrors((current) => ({ ...current, path: "" }));
    setShowPathForm(true);
  }

  function openEditPathForm(path: LearningPath) {
    setEditingPathId(path.id);
    setPathDraft({
      title: path.title,
      category: path.category,
      description: path.description,
      targetDate: path.targetDate,
    });
    setFormErrors((current) => ({ ...current, path: "" }));
    setShowPathForm(true);
  }


  async function savePath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = pathDraft.title.trim();
    const category = pathDraft.category.trim() || "General";
    const description = pathDraft.description.trim().slice(0, 500);
    const targetDate = pathDraft.targetDate;

    if (!title) {
      setFormErrors((current) => ({
        ...current,
        path: "Enter a learning path name.",
      }));
      return;
    }

    if (!userId) {
      setFormErrors((current) => ({
        ...current,
        path: "Your session was not found. Please sign in again.",
      }));
      return;
    }

    const savedFields = {
      title: title.slice(0, 100),
      category: category.slice(0, 50),
      description,
      target_date: targetDate || null,
    };

    try {
      const supabase = createClient();

      if (editingPathId) {
        const { error } = await supabase
          .from("learning_paths")
          .update(savedFields)
          .eq("user_id", userId)
          .eq("id", editingPathId);

        if (error) throw error;

        setPaths((current) =>
          current.map((path) =>
            path.id === editingPathId
              ? {
                  ...path,
                  title: savedFields.title,
                  category: savedFields.category,
                  description: savedFields.description,
                  targetDate,
                }
              : path,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("learning_paths")
          .insert({
            id: crypto.randomUUID(),
            user_id: userId,
            ...savedFields,
          })
          .select("id, title, category, description, target_date")
          .single();

        if (error) throw error;

        const newPath: LearningPath = {
          id: data.id,
          title: data.title,
          category: data.category,
          description: data.description,
          targetDate: data.target_date ?? "",
          milestones: [],
          sessions: [],
          links: [],
        };

        setPaths((current) => [newPath, ...current]);
        setExpandedPathId(newPath.id);
      }

      setShowPathForm(false);
      setEditingPathId(null);
      setPathDraft(initialPathDraft);
      setFormErrors((current) => ({
        ...current,
        path: "",
      }));
    } catch (error) {
      console.error("Could not save learning path:", error);

      setFormErrors((current) => ({
        ...current,
        path:
          error instanceof Error
            ? error.message
            : "Could not save the learning path. Please try again.",
      }));
    }
  }


  async function deletePath(pathId: string) {
    const path = paths.find((item) => item.id === pathId);
    if (!path) return;

    const confirmed = await requestConfirmation({
      title: "Delete this learning path?",
      message: `Are you sure you want to delete "${path.title}" and all its learning records? This action cannot be undone.`,
      confirmLabel: "Delete learning path",
      cancelLabel: "Cancel",
    });

    if (!confirmed) return;

    if (!userId) {
      setLoadError("Your session was not found. Please sign in again.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("learning_paths")
        .delete()
        .eq("user_id", userId)
        .eq("id", pathId);

      if (error) throw error;

      setPaths((current) =>
        current.filter((item) => item.id !== pathId),
      );

      if (expandedPathId === pathId) {
        setExpandedPathId(null);
      }

      if (editingPathId === pathId) {
        setShowPathForm(false);
        setEditingPathId(null);
      }

      setActiveMilestoneForm(null);
      setActiveSessionForm(null);
      setActiveLinkForm(null);
      setLoadError(null);
    } catch (error) {
      console.error("Could not delete learning path:", error);

      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not delete the learning path. Please try again.",
      );
    }
  }

  async function toggleMilestone(pathId: string, milestoneId: string) {
    const path = paths.find((item) => item.id === pathId);
    const milestone = path?.milestones.find(
      (item) => item.id === milestoneId,
    );

    if (!path || !milestone) return;

    if (!userId) {
      window.alert("Your session was not found. Please sign in again.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("learning_milestones")
        .update({ completed: !milestone.completed })
        .eq("user_id", userId)
        .eq("learning_path_id", pathId)
        .eq("id", milestoneId);

      if (error) throw error;

      setPaths((current) =>
        current.map((item) =>
          item.id !== pathId
            ? item
            : {
                ...item,
                milestones: item.milestones.map((entry) =>
                  entry.id === milestoneId
                    ? { ...entry, completed: !milestone.completed }
                    : entry,
                ),
              },
        ),
      );
    } catch (error) {
      console.error("Could not update milestone:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Could not update the milestone. Please try again.",
      );
    }
  }
function startMilestoneEdit(pathId: string, milestone: Milestone) {
  setEditingMilestoneId(milestone.id);
  setEditingMilestonePathId(pathId);
  setEditMilestoneTitle(milestone.title);

  setActiveMilestoneForm(null);
  setActiveSessionForm(null);
  setActiveLinkForm(null);

  setFormErrors((current) => ({
    ...current,
    [`milestone-edit-${pathId}`]: "",
  }));
}

function cancelMilestoneEdit() {
  if (savingMilestoneEdit) return;

  const pathId = editingMilestonePathId;

  setEditingMilestoneId(null);
  setEditingMilestonePathId(null);
  setEditMilestoneTitle("");

  if (pathId) {
    setFormErrors((current) => ({
      ...current,
      [`milestone-edit-${pathId}`]: "",
    }));
  }
}

  async function saveMilestoneEdit(
    event: FormEvent<HTMLFormElement>,
    pathId: string,
    milestoneId: string,
  ) {
    event.preventDefault();

    const title = editMilestoneTitle.trim();
    const errorKey = `milestone-edit-${pathId}`;

    if (
      savingMilestoneEdit ||
      editingMilestoneId !== milestoneId ||
      editingMilestonePathId !== pathId
    ) {
      return;
    }

    if (!title) {
      setFormErrors((current) => ({
        ...current,
        [errorKey]: "Enter a milestone name.",
      }));
      return;
    }

    if (!userId) {
      setFormErrors((current) => ({
        ...current,
        [errorKey]: "Your session was not found. Please sign in again.",
      }));
      return;
    }

    const path = paths.find((item) => item.id === pathId);
    const milestone = path?.milestones.find(
      (item) => item.id === milestoneId,
    );

    if (!milestone) {
      setFormErrors((current) => ({
        ...current,
      [errorKey]: "Could not find this milestone. Please refresh and try again.",
    }));
    return;
  }

  setSavingMilestoneEdit(true);
  setFormErrors((current) => ({
    ...current,
    [errorKey]: "",
  }));

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("learning_milestones")
      .update({ title: title.slice(0, 100) })
      .eq("user_id", userId)
      .eq("learning_path_id", pathId)
      .eq("id", milestoneId)
      .select("id, title, completed")
      .single();

    if (error) throw error;

    setPaths((current) =>
      current.map((item) =>
        item.id !== pathId
          ? item
          : {
              ...item,
              milestones: item.milestones.map((entry) =>
                entry.id !== milestoneId
                  ? entry
                  : {
                      ...entry,
                      title: data.title,
                      completed: data.completed,
                    },
              ),
            },
      ),
    );

    setEditingMilestoneId(null);
    setEditingMilestonePathId(null);
    setEditMilestoneTitle("");

    setFormErrors((current) => ({
      ...current,
      [errorKey]: "",
    }));
  } catch (error) {
    console.error("Could not update milestone:", error);

    setFormErrors((current) => ({
      ...current,
      [errorKey]:
        error instanceof Error
          ? error.message
          : "Could not update the milestone. Please try again.",
    }));
  } finally {
    setSavingMilestoneEdit(false);
  }
}
  async function addMilestone(
    event: FormEvent<HTMLFormElement>,
    pathId: string,
  ) {
    event.preventDefault();

    const title = (milestoneDrafts[pathId] ?? "").trim();

    if (!title) {
      setFormErrors((current) => ({
        ...current,
        [`milestone-${pathId}`]: "Enter a milestone name.",
      }));
      return;
    }

    if (!userId) {
      setFormErrors((current) => ({
        ...current,
        [`milestone-${pathId}`]:
          "Your session was not found. Please sign in again.",
      }));
      return;
    }

    const path = paths.find((item) => item.id === pathId);

    if (!path) return;

    const milestoneId = crypto.randomUUID();
    const milestoneTitle = title.slice(0, 100);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("learning_milestones")
        .insert({
          id: milestoneId,
          user_id: userId,
          learning_path_id: pathId,
          title: milestoneTitle,
          completed: false,
          sort_order: path.milestones.length,
        })
        .select("id, title, completed")
        .single();

      if (error) throw error;

      const milestone: Milestone = {
        id: data.id,
        title: data.title,
        completed: data.completed,
      };

      setPaths((current) =>
        current.map((item) =>
          item.id === pathId
            ? {
                ...item,
                milestones: [...item.milestones, milestone],
              }
            : item,
        ),
      );

      setMilestoneDrafts((current) => ({
        ...current,
        [pathId]: "",
      }));

      setFormErrors((current) => ({
        ...current,
        [`milestone-${pathId}`]: "",
      }));

      setActiveMilestoneForm(null);
    } catch (error) {
      console.error("Could not add milestone:", error);

      setFormErrors((current) => ({
        ...current,
        [`milestone-${pathId}`]:
          error instanceof Error
            ? error.message
            : "Could not add the milestone. Please try again.",
      }));
    }
  }

async function deleteMilestone(pathId: string, milestoneId: string) {
  if (!userId) {
    window.alert("Your session was not found. Please sign in again.");
    return;
  }

  const path = paths.find((item) => item.id === pathId);
  const milestone = path?.milestones.find(
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
      .from("learning_milestones")
      .delete()
      .eq("user_id", userId)
      .eq("learning_path_id", pathId)
      .eq("id", milestoneId);

    if (error) throw error;

    setPaths((current) =>
      current.map((path) =>
        path.id !== pathId
          ? path
          : {
              ...path,
              milestones: path.milestones.filter(
                (item) => item.id !== milestoneId,
              ),
            },
      ),
    );
  } catch (error) {
    console.error("Could not delete milestone:", error);

    window.alert(
      error instanceof Error
        ? error.message
        : "Could not delete the milestone. Please try again.",
    );
  }
}
  function openSessionForm(pathId: string) {
    setSessionDrafts((current) => ({
      ...current,
      [pathId]: current[pathId] ?? {
        ...initialSessionDraft,
        date: getDateKey(new Date()),
      },
    }));
    setFormErrors((current) => ({
      ...current,
      [`session-${pathId}`]: "",
    }));
    setActiveSessionForm(pathId);
    setActiveMilestoneForm(null);
    setActiveLinkForm(null);
  }

  async function addPracticeSession(
    event: FormEvent<HTMLFormElement>,
    pathId: string,
  ) {
    event.preventDefault();

    const draft = sessionDrafts[pathId] ?? initialSessionDraft;
    const minutes = Number(draft.minutes);

    if (
      !draft.date ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 1440
    ) {
      setFormErrors((current) => ({
        ...current,
        [`session-${pathId}`]:
          "Choose a date and enter a duration from 1 to 1440 minutes.",
      }));
      return;
    }

    if (!userId) {
      setFormErrors((current) => ({
        ...current,
        [`session-${pathId}`]:
          "Your session was not found. Please sign in again.",
      }));
      return;
    }

    const path = paths.find((item) => item.id === pathId);

    if (!path) return;

    const sessionId = crypto.randomUUID();
    const note = draft.note.trim().slice(0, 300);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("practice_sessions")
        .insert({
          id: sessionId,
          user_id: userId,
          learning_path_id: pathId,
          practice_date: draft.date,
          minutes,
          note,
        })
        .select("id, practice_date, minutes, note")
        .single();

      if (error) throw error;

      const session: PracticeSession = {
        id: data.id,
        date: data.practice_date,
        minutes: Number(data.minutes),
        note: data.note ?? "",
      };

      setPaths((current) =>
        current.map((item) =>
          item.id === pathId
            ? {
                ...item,
                sessions: [session, ...item.sessions],
              }
            : item,
        ),
      );

      setSessionDrafts((current) => ({
        ...current,
        [pathId]: {
          ...initialSessionDraft,
          date: getDateKey(new Date()),
        },
      }));

      setFormErrors((current) => ({
        ...current,
        [`session-${pathId}`]: "",
      }));

      setActiveSessionForm(null);
    } catch (error) {
      console.error("Could not save practice session:", error);

      setFormErrors((current) => ({
        ...current,
        [`session-${pathId}`]:
          error instanceof Error
            ? error.message
            : "Could not save the practice session. Please try again.",
      }));
    }
  }

  async function deletePracticeSession(pathId: string, sessionId: string) {
    if (!userId) {
      window.alert("Your session was not found. Please sign in again.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("practice_sessions")
        .delete()
        .eq("user_id", userId)
        .eq("learning_path_id", pathId)
        .eq("id", sessionId);

      if (error) throw error;

      setPaths((current) =>
        current.map((path) =>
          path.id !== pathId
            ? path
            : {
                ...path,
                sessions: path.sessions.filter(
                  (session) => session.id !== sessionId,
                ),
              },
        ),
      );
    } catch (error) {
      console.error("Could not delete practice session:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Could not delete the practice session. Please try again.",
      );
    }
  }

  function openLinkForm(pathId: string) {
    setLinkDrafts((current) => ({
      ...current,
      [pathId]: current[pathId] ?? initialLinkDraft,
    }));
    setFormErrors((current) => ({ ...current, [`link-${pathId}`]: "" }));
    setActiveLinkForm(pathId);
    setActiveMilestoneForm(null);
    setActiveSessionForm(null);
  }

  async function addLearningLink(
    event: FormEvent<HTMLFormElement>,
    pathId: string,
  ) {
    event.preventDefault();

    const draft = linkDrafts[pathId] ?? initialLinkDraft;
    const title = draft.title.trim();
    const url = getHttpUrl(draft.url);

    if (!title) {
      setFormErrors((current) => ({
        ...current,
        [`link-${pathId}`]: "Enter a project or resource title.",
      }));
      return;
    }

    if (url === null) {
      setFormErrors((current) => ({
        ...current,
        [`link-${pathId}`]:
          "Enter a valid link starting with https:// or http://, or leave it blank.",
      }));
      return;
    }

    if (!userId) {
      setFormErrors((current) => ({
        ...current,
        [`link-${pathId}`]:
          "Your session was not found. Please sign in again.",
      }));
      return;
    }

    const path = paths.find((item) => item.id === pathId);

    if (!path) return;

    const link: LearningLink = {
      id: crypto.randomUUID(),
      title: title.slice(0, 100),
      kind: draft.kind,
      url,
    };

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("learning_links")
        .insert({
          id: link.id,
          user_id: userId,
          learning_path_id: pathId,
          title: link.title,
          link_kind: link.kind,
          url: link.url,
        });

      if (error) throw error;

      setPaths((current) =>
        current.map((item) =>
          item.id === pathId
            ? { ...item, links: [link, ...item.links] }
            : item,
        ),
      );

      setLinkDrafts((current) => ({
        ...current,
        [pathId]: initialLinkDraft,
      }));

      setFormErrors((current) => ({
        ...current,
        [`link-${pathId}`]: "",
      }));

      setActiveLinkForm(null);
    } catch (error) {
      console.error("Could not save learning link:", error);

      setFormErrors((current) => ({
        ...current,
        [`link-${pathId}`]:
          error instanceof Error
            ? error.message
            : "Could not save the link. Please try again.",
      }));
    }
  }
function startLinkEdit(pathId: string, link: LearningLink) {
  setEditingLinkId(link.id);
  setEditingLinkPathId(pathId);
  setEditLinkDraft({
    title: link.title,
    kind: link.kind,
    url: link.url,
  });

  setActiveLinkForm(null);
  setFormErrors((current) => ({
    ...current,
    [`link-edit-${pathId}`]: "",
  }));
}

function cancelLinkEdit() {
  if (savingLinkEdit) return;

  const pathId = editingLinkPathId;

  setEditingLinkId(null);
  setEditingLinkPathId(null);
  setEditLinkDraft(initialLinkDraft);

  if (pathId) {
    setFormErrors((current) => ({
      ...current,
      [`link-edit-${pathId}`]: "",
    }));
  }
}

async function saveLearningLinkEdit(
  event: FormEvent<HTMLFormElement>,
  pathId: string,
  linkId: string,
) {
  event.preventDefault();

  if (
    savingLinkEdit ||
    editingLinkId !== linkId ||
    editingLinkPathId !== pathId
  ) {
    return;
  }

  const title = editLinkDraft.title.trim();
  const url = getHttpUrl(editLinkDraft.url);
  const errorKey = `link-edit-${pathId}`;

  if (!title) {
    setFormErrors((current) => ({
      ...current,
      [errorKey]: "Enter a project or resource title.",
    }));
    return;
  }

  if (url === null) {
    setFormErrors((current) => ({
      ...current,
      [errorKey]:
        "Enter a valid link starting with https:// or http://, or leave it blank.",
    }));
    return;
  }

  if (!userId) {
    setFormErrors((current) => ({
      ...current,
      [errorKey]: "Your session was not found. Please sign in again.",
    }));
    return;
  }

  const existingLink = paths
    .find((path) => path.id === pathId)
    ?.links.find((link) => link.id === linkId);

  if (!existingLink) {
    setFormErrors((current) => ({
      ...current,
      [errorKey]: "Could not find this link. Please refresh and try again.",
    }));
    return;
  }

  setSavingLinkEdit(true);
  setFormErrors((current) => ({
    ...current,
    [errorKey]: "",
  }));

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("learning_links")
      .update({
        title: title.slice(0, 100),
        link_kind: editLinkDraft.kind,
        url,
      })
      .eq("user_id", userId)
      .eq("learning_path_id", pathId)
      .eq("id", linkId)
      .select("id, title, link_kind, url")
      .single();

    if (error) throw error;

    setPaths((current) =>
      current.map((path) =>
        path.id !== pathId
          ? path
          : {
              ...path,
              links: path.links.map((link) =>
                link.id !== linkId
                  ? link
                  : {
                      ...link,
                      title: data.title,
                      kind: data.link_kind as LearningLink["kind"],
                      url: data.url ?? "",
                    },
              ),
            },
      ),
    );

    setEditingLinkId(null);
    setEditingLinkPathId(null);
    setEditLinkDraft(initialLinkDraft);

    setFormErrors((current) => ({
      ...current,
      [errorKey]: "",
    }));
  } catch (error) {
    console.error("Could not update learning link:", error);

    setFormErrors((current) => ({
      ...current,
      [errorKey]:
        error instanceof Error
          ? error.message
          : "Could not update the link. Please try again.",
    }));
  } finally {
    setSavingLinkEdit(false);
  }
}
  async function deleteLearningLink(pathId: string, linkId: string) {
    if (!userId) {
      window.alert("Your session was not found. Please sign in again.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("learning_links")
        .delete()
        .eq("user_id", userId)
        .eq("learning_path_id", pathId)
        .eq("id", linkId);

      if (error) throw error;

      setPaths((current) =>
        current.map((path) =>
          path.id !== pathId
            ? path
            : {
                ...path,
                links: path.links.filter((link) => link.id !== linkId),
              },
        ),
      );
    } catch (error) {
      console.error("Could not delete learning link:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Could not delete the link. Please try again.",
      );
    }
  }

  if (!loaded) {
    return (
      <section className="panel personal-growth-loading">
        Loading your learning paths...
      </section>
    );
  }
  if (loadError) {
  return (
    <section className="panel">
      <p>Could not load your cloud learning data.</p>
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
    <section className="personal-growth-workspace">
      <div className="personal-growth-heading">
        <div>
          <div className="panel-kicker">YOUR LEARNING WORKSPACE</div>
          <h1>Personal Growth</h1>
          <p>
            Build useful skills, practise deliberately, and turn learning into
            real projects.
          </p>
        </div>

        <button
          className="primary-button personal-growth-create-button"
          type="button"
          onClick={openNewPathForm}
        >
          <Plus size={16} />
          New learning path
        </button>
      </div>

      <div className="personal-growth-summary">
        <article className="personal-growth-summary-card">
          <span className="personal-growth-summary-icon">
            <BookOpen size={19} />
          </span>
          <div>
            <span>LEARNING PATHS</span>
            <strong>{paths.length}</strong>
          </div>
        </article>

        <article className="personal-growth-summary-card">
          <span className="personal-growth-summary-icon">
            <Target size={19} />
          </span>
          <div>
            <span>MILESTONES DONE</span>
            <strong>
              {completedMilestones}/{totalMilestones}
            </strong>
          </div>
        </article>

        <article className="personal-growth-summary-card">
          <span className="personal-growth-summary-icon">
            <Clock3 size={19} />
          </span>
          <div>
            <span>PRACTICE TIME</span>
            <strong>{formatMinutes(totalPracticeMinutes)}</strong>
          </div>
        </article>

        <article className="personal-growth-summary-card">
          <span className="personal-growth-summary-icon">
            <FolderKanban size={19} />
          </span>
          <div>
            <span>PROJECTS</span>
            <strong>{projectCount}</strong>
          </div>
        </article>
      </div>

      {showPathForm && (
        <form className="panel personal-growth-form" onSubmit={savePath}>
          <div className="personal-growth-form-heading">
            <div>
              <h2>{editingPathId ? "Edit learning path" : "Create a learning path"}</h2>
              <p>
                Keep one path focused on a skill or subject you want to develop.
              </p>
            </div>

            <button
              className="personal-growth-icon-button"
              type="button"
              aria-label="Close learning path form"
              onClick={() => {
                setShowPathForm(false);
                setEditingPathId(null);
                setPathDraft(initialPathDraft);
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="personal-growth-form-grid">
            <label className="academics-field">
              <span>Learning path name</span>
              <input
                autoFocus
                value={pathDraft.title}
                onChange={(event) =>
                  setPathDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="e.g. Python for Cybersecurity"
                maxLength={100}
                required
              />
            </label>

            <label className="academics-field">
              <span>Category</span>
              <input
                value={pathDraft.category}
                onChange={(event) =>
                  setPathDraft((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                placeholder="e.g. Programming, AI/ML, Language"
                maxLength={50}
              />
            </label>

            <label className="academics-field personal-growth-full-field">
              <span>Description (optional)</span>
              <textarea
                value={pathDraft.description}
                onChange={(event) =>
                  setPathDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="What do you want to learn or build?"
                maxLength={500}
                rows={3}
              />
            </label>

            <label className="academics-field">
              <span>Target date (optional)</span>
              <input
                type="date"
                value={pathDraft.targetDate}
                onChange={(event) =>
                  setPathDraft((current) => ({
                    ...current,
                    targetDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          {formErrors.path && (
            <p className="personal-growth-error" role="alert">
              {formErrors.path}
            </p>
          )}

          <div className="academics-form-actions">
            <button
              type="button"
              className="text-button academics-cancel"
              onClick={() => {
                setShowPathForm(false);
                setEditingPathId(null);
                setPathDraft(initialPathDraft);
              }}
            >
              Cancel
            </button>

            <button type="submit" className="primary-button">
              <Check size={15} />
              {editingPathId ? "Save changes" : "Create learning path"}
            </button>
          </div>
        </form>
      )}

      <div className="personal-growth-list-heading">
        <div>
          <h2>Your learning paths</h2>
          <p>
            Each path combines milestones, practice history, projects, and
            useful resources.
          </p>
        </div>
      </div>

      {paths.length === 0 ? (
        <section className="panel personal-growth-empty">
          <span className="personal-growth-empty-icon">
            <Sparkles size={26} />
          </span>
          <h3>Start building a skill</h3>
          <p>
            Create your first learning path, then break it into milestones and
            log your practice sessions as you go.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={openNewPathForm}
          >
            <Plus size={15} />
            Create your first path
          </button>
        </section>
      ) : (
        <div className="personal-growth-path-grid">
          {paths.map((path) => {
            const completed = path.milestones.filter(
              (milestone) => milestone.completed,
            ).length;

            const total = path.milestones.length;

            const progress =
              total > 0 ? Math.round((completed / total) * 100) : 0;

            const minutes = path.sessions.reduce(
              (sum, session) => sum + session.minutes,
              0,
            );

            const isExpanded = expandedPathId === path.id;
            const sessionDraft = sessionDrafts[path.id] ?? initialSessionDraft;
            const linkDraft = linkDrafts[path.id] ?? initialLinkDraft;

            return (
              <article
                className="panel personal-growth-path-card"
                key={path.id}
              >
                <div className="personal-growth-path-header">
                  <span className="personal-growth-path-icon">
                    <BookOpen size={20} />
                  </span>

                  <div className="personal-growth-path-actions">
                    <button
                      className="personal-growth-icon-button"
                      type="button"
                      title="Edit learning path"
                      aria-label={`Edit ${path.title}`}
                      onClick={() => openEditPathForm(path)}
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      className="personal-growth-icon-button"
                      type="button"
                      title="Delete learning path"
                      aria-label={`Delete ${path.title}`}
                      onClick={() => deletePath(path.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="personal-growth-category">{path.category}</div>
                <h3>{path.title}</h3>

                {path.description && (
                  <p className="personal-growth-description">
                    {path.description}
                  </p>
                )}

                <div className="personal-growth-path-meta">
                  <span>
                    <CalendarDays size={13} />
                    Target: {formatDate(path.targetDate)}
                  </span>
                  <span>
                    <Clock3 size={13} />
                    {formatMinutes(minutes)} practised
                  </span>
                </div>

                <div className="personal-growth-progress-heading">
                  <span>
                    {completed}/{total} milestones complete
                  </span>
                  <strong>{progress}%</strong>
                </div>

                <div
                  className="personal-growth-progress-track"
                  role="progressbar"
                  aria-label={`${path.title} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>

                <button
                  className="personal-growth-expand-button"
                  type="button"
                  onClick={() =>
                    setExpandedPathId(isExpanded ? null : path.id)
                  }
                >
                  {isExpanded ? "Close learning workspace" : "Open learning workspace"}
                  <ArrowUpRight
                    size={15}
                    className={isExpanded ? "personal-growth-arrow-open" : ""}
                  />
                </button>

                {isExpanded && (
                  <div className="personal-growth-details">
                    <section className="personal-growth-detail-section">
                      <div className="personal-growth-detail-heading">
                        <div>
                          <h4>Milestones</h4>
                          <p>Break your learning into achievable steps.</p>
                        </div>

                        <button
                          className="text-button personal-growth-small-button"
                          type="button"
                          onClick={() => {
                            setActiveMilestoneForm(
                              activeMilestoneForm === path.id ? null : path.id,
                            );
                            setActiveSessionForm(null);
                            setActiveLinkForm(null);
                            setFormErrors((current) => ({
                              ...current,
                              [`milestone-${path.id}`]: "",
                            }));
                          }}
                        >
                          <Plus size={14} />
                          Add
                        </button>
                      </div>

                      {path.milestones.length === 0 ? (
                        <p className="personal-growth-muted">
                          No milestones yet. Add the first concept, topic, or
                          practical skill you want to complete.
                        </p>
                      ) : (
                        <div className="personal-growth-milestone-list">
                          {path.milestones.map((milestone) => (
                            <div
                              className="personal-growth-milestone"
                              key={milestone.id}
                            >
                          <button
                            type="button"
                            className={`personal-growth-milestone-check ${
                              milestone.completed ? "checked" : ""
                            }`}
                            aria-label={
                              milestone.completed
                                ? `Mark ${milestone.title} incomplete`
                                : `Complete ${milestone.title}`
                            }
                            aria-pressed={milestone.completed}
                            onClick={() => toggleMilestone(path.id, milestone.id)}
                          >
                            {milestone.completed && <Check size={12} />}
                          </button>

                          {editingMilestoneId === milestone.id &&
                          editingMilestonePathId === path.id ? (
                            <form
                              className="personal-growth-milestone-edit-form"
                              onSubmit={(event) =>
                                saveMilestoneEdit(event, path.id, milestone.id)
                              }
                            >
                              <input
                                autoFocus
                                value={editMilestoneTitle}
                                onChange={(event) => setEditMilestoneTitle(event.target.value)}
                                maxLength={100}
                                required
                                aria-label="Milestone title"
                              />

                              {formErrors[`milestone-edit-${path.id}`] && (
                                <p className="personal-growth-form-error" role="alert">
                                  {formErrors[`milestone-edit-${path.id}`]}
                                </p>
                              )}

                              <div className="personal-growth-milestone-edit-actions">
                                <button
                                  className="personal-growth-icon-button"
                                  type="button"
                                  onClick={cancelMilestoneEdit}
                                  disabled={savingMilestoneEdit}
                                  aria-label="Cancel milestone edit"
                                  title="Cancel"
                                >
                                  <X size={13} />
                                </button>

                                <button
                                  className="personal-growth-icon-button"
                                  type="submit"
                                  disabled={savingMilestoneEdit}
                                  aria-label="Save milestone"
                                  title="Save"
                                >
                                  <Check size={13} />
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <span
                                className={
                                  milestone.completed ? "completed" : undefined
                                }
                              >
                                {milestone.title}
                              </span>

                              <button
                                className="personal-growth-icon-button"
                                type="button"
                                aria-label={`Edit milestone ${milestone.title}`}
                                title="Edit milestone"
                                onClick={() => startMilestoneEdit(path.id, milestone)}
                              >
                                <Pencil size={13} />
                              </button>

                              <button
                                className="personal-growth-icon-button"
                                type="button"
                                aria-label={`Delete milestone ${milestone.title}`}
                                title="Delete milestone"
                                onClick={() => deleteMilestone(path.id, milestone.id)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                              </div>
                            ))}
                          </div>
                        )}

                      {activeMilestoneForm === path.id && (
                        <form
                          className="personal-growth-inline-form"
                          onSubmit={(event) => addMilestone(event, path.id)}
                        >
                          <input
                            autoFocus
                            value={milestoneDrafts[path.id] ?? ""}
                            onChange={(event) =>
                              setMilestoneDrafts((current) => ({
                                ...current,
                                [path.id]: event.target.value,
                              }))
                            }
                            placeholder="e.g. Learn Python functions"
                            maxLength={100}
                            required
                          />

                          {formErrors[`milestone-${path.id}`] && (
                            <p className="personal-growth-error" role="alert">
                              {formErrors[`milestone-${path.id}`]}
                            </p>
                          )}

                          <div className="personal-growth-inline-actions">
                            <button
                              className="text-button academics-cancel"
                              type="button"
                              onClick={() => setActiveMilestoneForm(null)}
                            >
                              Cancel
                            </button>
                            <button className="primary-button" type="submit">
                              Add milestone
                            </button>
                          </div>
                        </form>
                      )}
                    </section>

                    <section className="personal-growth-detail-section">
                      <div className="personal-growth-detail-heading">
                        <div>
                          <h4>Practice log</h4>
                          <p>Record focused learning time and what you did.</p>
                        </div>

                        <button
                          className="text-button personal-growth-small-button"
                          type="button"
                          onClick={() => openSessionForm(path.id)}
                        >
                          <Plus size={14} />
                          Log practice
                        </button>
                      </div>

                      {activeSessionForm === path.id && (
                        <form
                          className="personal-growth-inline-form"
                          onSubmit={(event) =>
                            addPracticeSession(event, path.id)
                          }
                        >
                          <div className="personal-growth-form-grid">
                            <label className="academics-field">
                              <span>Date</span>
                              <input
                                type="date"
                                value={sessionDraft.date}
                                onChange={(event) =>
                                  setSessionDrafts((current) => ({
                                    ...current,
                                    [path.id]: {
                                      ...sessionDraft,
                                      date: event.target.value,
                                    },
                                  }))
                                }
                                required
                              />
                            </label>

                            <label className="academics-field">
                              <span>Duration (minutes)</span>
                              <input
                                type="number"
                                min="1"
                                max="1440"
                                step="1"
                                value={sessionDraft.minutes}
                                onChange={(event) =>
                                  setSessionDrafts((current) => ({
                                    ...current,
                                    [path.id]: {
                                      ...sessionDraft,
                                      minutes: event.target.value,
                                    },
                                  }))
                                }
                                required
                              />
                            </label>

                            <label className="academics-field personal-growth-full-field">
                              <span>What did you practise? (optional)</span>
                              <textarea
                                rows={2}
                                value={sessionDraft.note}
                                onChange={(event) =>
                                  setSessionDrafts((current) => ({
                                    ...current,
                                    [path.id]: {
                                      ...sessionDraft,
                                      note: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="e.g. Practised file handling and exception handling"
                                maxLength={300}
                              />
                            </label>
                          </div>

                          {formErrors[`session-${path.id}`] && (
                            <p className="personal-growth-error" role="alert">
                              {formErrors[`session-${path.id}`]}
                            </p>
                          )}

                          <div className="personal-growth-inline-actions">
                            <button
                              className="text-button academics-cancel"
                              type="button"
                              onClick={() => setActiveSessionForm(null)}
                            >
                              Cancel
                            </button>
                            <button className="primary-button" type="submit">
                              <Check size={14} />
                              Save practice
                            </button>
                          </div>
                        </form>
                      )}

                      {path.sessions.length === 0 ? (
                        <p className="personal-growth-muted">
                          Your recorded practice sessions will appear here.
                        </p>
                      ) : (
                        <div className="personal-growth-session-list">
                          {path.sessions.map((session) => (
                            <div
                              className="personal-growth-session"
                              key={session.id}
                            >
                              <div className="personal-growth-session-icon">
                                <Clock3 size={16} />
                              </div>
                              <div className="personal-growth-session-copy">
                                <strong>
                                  {formatMinutes(session.minutes)} ·{" "}
                                  {formatDate(session.date)}
                                </strong>
                                {session.note && <p>{session.note}</p>}
                              </div>
                              <button
                                className="personal-growth-icon-button"
                                type="button"
                                title="Delete practice entry"
                                aria-label="Delete practice entry"
                                onClick={() =>
                                  deletePracticeSession(path.id, session.id)
                                }
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="personal-growth-detail-section">
                      <div className="personal-growth-detail-heading">
                        <div>
                          <h4>Projects & resources</h4>
                          <p>
                            Keep useful links, portfolio work, and certificates
                            with the skill they belong to.
                          </p>
                        </div>

                        <button
                          className="text-button personal-growth-small-button"
                          type="button"
                          onClick={() => openLinkForm(path.id)}
                        >
                          <Plus size={14} />
                          Add link
                        </button>
                      </div>

                      {activeLinkForm === path.id && (
                        <form
                          className="personal-growth-inline-form"
                          onSubmit={(event) => addLearningLink(event, path.id)}
                        >
                          <label className="academics-field">
                            <span>Title</span>
                            <input
                              autoFocus
                              value={linkDraft.title}
                              onChange={(event) =>
                                setLinkDrafts((current) => ({
                                  ...current,
                                  [path.id]: {
                                    ...linkDraft,
                                    title: event.target.value,
                                  },
                                }))
                              }
                              placeholder="e.g. Python security scanner"
                              maxLength={100}
                              required
                            />
                          </label>

                          <div className="personal-growth-form-grid">
                            <label className="academics-field">
                              <span>Type</span>
                              <select
                                value={linkDraft.kind}
                                onChange={(event) =>
                                  setLinkDrafts((current) => ({
                                    ...current,
                                    [path.id]: {
                                      ...linkDraft,
                                      kind: event.target.value as LearningLink["kind"],
                                    },
                                  }))
                                }
                              >
                                <option value="Project">Project</option>
                                <option value="Resource">Resource</option>
                                <option value="Certificate">Certificate</option>
                              </select>
                            </label>

                            <label className="academics-field">
                              <span>URL (optional)</span>
                              <input
                                type="url"
                                value={linkDraft.url}
                                onChange={(event) =>
                                  setLinkDrafts((current) => ({
                                    ...current,
                                    [path.id]: {
                                      ...linkDraft,
                                      url: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="https://..."
                              />
                            </label>
                          </div>

                          {formErrors[`link-${path.id}`] && (
                            <p className="personal-growth-error" role="alert">
                              {formErrors[`link-${path.id}`]}
                            </p>
                          )}

                          <div className="personal-growth-inline-actions">
                            <button
                              className="text-button academics-cancel"
                              type="button"
                              onClick={() => setActiveLinkForm(null)}
                            >
                              Cancel
                            </button>
                            <button className="primary-button" type="submit">
                              <Plus size={14} />
                              Add link
                            </button>
                          </div>
                        </form>
                      )}

                      {path.links.length === 0 ? (
                        <p className="personal-growth-muted">
                          Add a project, learning resource, or certificate when
                          you have one to save.
                        </p>
                      ) : (
                        <div className="personal-growth-link-list">
                          {path.links.map((link) => (
                            <div
                              className="personal-growth-link-row"
                              key={link.id}
                            >
                              {editingLinkId === link.id &&
                              editingLinkPathId === path.id ? (
                                <>
                                  <span className="personal-growth-link-icon">
                                    {link.kind === "Project" ? (
                                      <FolderKanban size={16} />
                                    ) : link.kind === "Resource" ? (
                                      <Link2 size={16} />
                                    ) : (
                                      <Sparkles size={16} />
                                    )}
                                  </span>

                                  <form
                                    className="personal-growth-inline-form personal-growth-link-edit-form"
                                    onSubmit={(event) =>
                                      saveLearningLinkEdit(event, path.id, link.id)
                                    }
                                  >
                                    <label className="academics-field">
                                      <span>Title</span>
                                      <input
                                        autoFocus
                                        value={editLinkDraft.title}
                                        onChange={(event) =>
                                          setEditLinkDraft((current) => ({
                                            ...current,
                                            title: event.target.value,
                                          }))
                                        }
                                        maxLength={100}
                                        required
                                      />
                                    </label>

                                    <div className="personal-growth-form-grid">
                                      <label className="academics-field">
                                        <span>Type</span>
                                        <select
                                          value={editLinkDraft.kind}
                                          onChange={(event) =>
                                            setEditLinkDraft((current) => ({
                                              ...current,
                                              kind: event.target.value as LearningLink["kind"],
                                            }))
                                          }
                                        >
                                          <option value="Project">Project</option>
                                          <option value="Resource">Resource</option>
                                          <option value="Certificate">Certificate</option>
                                        </select>
                                      </label>

                                      <label className="academics-field">
                                        <span>URL (optional)</span>
                                        <input
                                          type="url"
                                          value={editLinkDraft.url}
                                          onChange={(event) =>
                                            setEditLinkDraft((current) => ({
                                              ...current,
                                              url: event.target.value,
                                            }))
                                          }
                                          placeholder="https://..."
                                        />
                                      </label>
                                    </div>

                                    {formErrors[`link-edit-${path.id}`] && (
                                      <p className="personal-growth-error" role="alert">
                                        {formErrors[`link-edit-${path.id}`]}
                                      </p>
                                    )}

                                    <div className="personal-growth-inline-actions">
                                      <button
                                        className="text-button academics-cancel"
                                        type="button"
                                        onClick={cancelLinkEdit}
                                        disabled={savingLinkEdit}
                                      >
                                        Cancel
                                      </button>

                                      <button
                                        className="primary-button"
                                        type="submit"
                                        disabled={savingLinkEdit}
                                      >
                                        <Check size={14} />
                                        {savingLinkEdit ? "Saving..." : "Save changes"}
                                      </button>
                                    </div>
                                  </form>
                                </>
                              ) : (
                                <>
                                  <span className="personal-growth-link-icon">
                                    {link.kind === "Project" ? (
                                      <FolderKanban size={16} />
                                    ) : link.kind === "Resource" ? (
                                      <Link2 size={16} />
                                    ) : (
                                      <Sparkles size={16} />
                                    )}
                                  </span>

                                  <div className="personal-growth-link-copy">
                                    <span>{link.kind}</span>
                                    <strong>{link.title}</strong>
                                    {link.url && (
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Open link <ExternalLink size={12} />
                                      </a>
                                    )}
                                  </div>

                                  <div className="personal-growth-link-actions">
                                    <button
                                      className="personal-growth-icon-button"
                                      type="button"
                                      title="Edit link"
                                      aria-label={`Edit ${link.title}`}
                                      onClick={() => startLinkEdit(path.id, link)}
                                    >
                                      <Pencil size={13} />
                                    </button>

                                    <button
                                      className="personal-growth-icon-button"
                                      type="button"
                                      title="Remove link"
                                      aria-label={`Remove ${link.title}`}
                                      onClick={() => deleteLearningLink(path.id, link.id)}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="personal-growth-storage-note">
        <Sparkles size={15} />
        <span>
          Learning paths, milestones, practice sessions and links are securely saved to your account and sync across sessions.
        </span>
      </div>
    </section>
  );
}