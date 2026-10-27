"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useConfirmDialog } from "@/app/confirm-dialog-provider";

import { createClient } from "@/lib/supabase/client";
import {
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  ChevronDown,
  GraduationCap,
  Plus,
  Pencil,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

type AssessmentType =| "Assignment"| "Quiz"| "Viva"| "Presentation"| "Lab-Report"|"Attendance"| "Mid-term Exam"| "Final Exam"| "Project"| "Lab Final"| "Other";
type ResultStatus = "Pending" | "Received";

type Assessment = {
  id: string;
  title: string;
  type: AssessmentType;
  dueDate: string;
  completed: boolean;
  obtainedMarks: number;
  totalMarks: number;
  resultStatus: ResultStatus;
};

type Course = {
  id: string;
  name: string;
  code: string;
  credits: number;
  assessments: Assessment[];
};

type CourseDraft = { name: string; code: string; credits: string };
type AssessmentDraft = { title: string; type: AssessmentType; dueDate: string; totalMarks: string };
type GradeBand = { id: string; minMark: number; maxMark: number; gradePoint: number; grade: string };
type PreviousRecord = { cgpa: string; completedCredits: string };
type CourseGradeSummary = {
  course: Course;
  obtained: number;
  possible: number;
  percentage: number | null;
  receivedCount: number;
  pendingCount: number;
  gradeBand: GradeBand | null;
};


const assessmentTypes: AssessmentType[] = [
  "Assignment",
  "Quiz",
  "Viva",
  "Presentation",
  "Lab-Report",
  "Attendance",
  "Mid-term Exam",
  "Final Exam",
  "Project",
  "Lab Final",
  "Other",
];

// Starter scale uses the commonly published Southeast University undergraduate scale.
// Edit it from the Grading scale panel if your program's official rules differ.
const DEFAULT_GRADING_SCALE: GradeBand[] = [
  { id: "a-plus", minMark: 80, maxMark: 100, gradePoint: 4.0, grade: "A+" },
  { id: "a", minMark: 75, maxMark: 79, gradePoint: 3.75, grade: "A" },
  { id: "a-minus", minMark: 70, maxMark: 74, gradePoint: 3.5, grade: "A-" },
  { id: "b-plus", minMark: 65, maxMark: 69, gradePoint: 3.25, grade: "B+" },
  { id: "b", minMark: 60, maxMark: 64, gradePoint: 3.0, grade: "B" },
  { id: "b-minus", minMark: 55, maxMark: 59, gradePoint: 2.75, grade: "B-" },
  { id: "c-plus", minMark: 50, maxMark: 54, gradePoint: 2.5, grade: "C+" },
  { id: "c", minMark: 45, maxMark: 49, gradePoint: 2.25, grade: "C" },
  { id: "d", minMark: 40, maxMark: 44, gradePoint: 2.0, grade: "D" },
  { id: "f", minMark: 0, maxMark: 39, gradePoint: 0.0, grade: "F" },
];

const initialCourseDraft: CourseDraft = { name: "", code: "", credits: "3" };
const initialAssessmentDraft: AssessmentDraft = {
  title: "",
  type: "Assignment",
  dueDate: "",
  totalMarks: "10",
};
const initialPreviousRecord: PreviousRecord = { cgpa: "", completedCredits: "" };

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeAssessment(value: unknown): Assessment | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    !item.title.trim() ||
    !assessmentTypes.includes(item.type as AssessmentType)
  ) {
    return null;
  }

  const totalMarks = Math.max(0.01, toFiniteNumber(item.totalMarks, 10));
  const obtainedMarks = Math.min(
    totalMarks,
    Math.max(0, toFiniteNumber(item.obtainedMarks, 0)),
  );

  return {
    id: item.id,
    title: item.title,
    type: item.type as AssessmentType,
    dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
    completed: item.completed === true,
    obtainedMarks,
    totalMarks,
    // Older saved assessments migrate with their marks at 0, but are not assumed graded.
    resultStatus: item.resultStatus === "Received" ? "Received" : "Pending",
  };
}

function normalizeCourse(value: unknown): Course | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    typeof item.code !== "string" ||
    !Array.isArray(item.assessments)
  ) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    code: item.code,
    credits: Math.min(30, Math.max(0.5, toFiniteNumber(item.credits, 3))),
    assessments: item.assessments
      .map(normalizeAssessment)
      .filter((assessment): assessment is Assessment => assessment !== null),
  };
}

function normalizeGradeBand(value: unknown, index: number): GradeBand | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const minMark = toFiniteNumber(item.minMark, Number.NaN);
  const maxMark = toFiniteNumber(item.maxMark, Number.NaN);
  const gradePoint = toFiniteNumber(item.gradePoint, Number.NaN);
  if (
    !Number.isFinite(minMark) ||
    !Number.isFinite(maxMark) ||
    !Number.isFinite(gradePoint) ||
    minMark < 0 || maxMark > 100 || minMark > maxMark || gradePoint < 0 || gradePoint > 5
  ) {
    return null;
  }
  return {
    id: typeof item.id === "string" ? item.id : `grade-${index}-${crypto.randomUUID()}`,
    minMark,
    maxMark,
    gradePoint,
    grade: typeof item.grade === "string" ? item.grade.slice(0, 12) : "Grade",
  };
}

function formatDueDate(value: string) {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function getDueStatus(dueDate: string, completed: boolean) {
  if (!dueDate || completed) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  if (due.getTime() < today.getTime()) return "Overdue";
  if (due.getTime() === today.getTime()) return "Due today";
  return null;
}

function getGradeBand(scale: GradeBand[], percentage: number): GradeBand | null {
  return (
    [...scale]
      .sort((a, b) => b.minMark - a.minMark)
      .find((band) => percentage >= band.minMark && (band.maxMark === 100 ? percentage <= 100 : percentage < band.maxMark + 1)) ?? null
  );
}

function validateGradeScale(scale: GradeBand[]) {
  if (scale.length === 0) return "Add at least one grading band.";
  for (const band of scale) {
    if (
      !band.grade.trim() ||
      !Number.isFinite(band.minMark) ||
      !Number.isFinite(band.maxMark) ||
      !Number.isFinite(band.gradePoint) ||
      band.minMark < 0 || band.maxMark > 100 || band.minMark > band.maxMark ||
      band.gradePoint < 0 || band.gradePoint > 5
    ) {
      return "Check each grade label, mark range, and grade point. Marks must be 0–100.";
    }
  }
  for (let i = 0; i < scale.length; i += 1) {
    for (let j = i + 1; j < scale.length; j += 1) {
      const a = scale[i];
      const b = scale[j];
      if (a.minMark <= b.maxMark && b.minMark <= a.maxMark) {
        return "Grading ranges cannot overlap. Adjust or remove one of the overlapping bands.";
      }
    }
  }
  return "";
}

export default function AcademicsWorkspace() {
  const { requestConfirmation } = useConfirmDialog();
  const [courses, setCourses] = useState<Course[]>([]);
  // Courses start collapsed to keep the Academics page compact, especially on phones.
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleCourseExpanded(courseId: string) {
    setExpandedCourseIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }
  const assessmentMarksSaveQueue = useRef<Map<string, Promise<void>>>(
    new Map(),);
  const assessmentMarksSaveVersions = useRef<Map<string, number>>(
    new Map(),
  );
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseDraft, setCourseDraft] = useState<CourseDraft>(initialCourseDraft);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseDraft, setEditCourseDraft] =
    useState<CourseDraft>(initialCourseDraft);
  const [savingCourseEdit, setSavingCourseEdit] = useState(false);
  const [addingAssessmentTo, setAddingAssessmentTo] = useState<string | null>(null);
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, AssessmentDraft>>({});
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [editingAssessmentCourseId, setEditingAssessmentCourseId] = useState<string | null>(null);
  const [editAssessmentDraft, setEditAssessmentDraft] =
    useState<AssessmentDraft>(initialAssessmentDraft);
  const [savingAssessmentEdit, setSavingAssessmentEdit] = useState(false);
  const [assessmentErrors, setAssessmentErrors] = useState<Record<string, string>>({});
  const [gradingScale, setGradingScale] = useState<GradeBand[]>(DEFAULT_GRADING_SCALE);
  const [gradingDraft, setGradingDraft] = useState<GradeBand[]>(DEFAULT_GRADING_SCALE);
  const [gradingLoaded, setGradingLoaded] = useState(false);
  const [showGradingPanel, setShowGradingPanel] = useState(false);
  const [gradingError, setGradingError] = useState("");
  const [previousRecord, setPreviousRecord] = useState<PreviousRecord>(initialPreviousRecord);
  const [previousRecordDraft, setPreviousRecordDraft] = useState<PreviousRecord>(initialPreviousRecord);
  const [previousRecordLoaded, setPreviousRecordLoaded] = useState(false);
  const [showCgpaSettings, setShowCgpaSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAcademicData() {
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
          data: courseRows,
          error: courseError,
        } = await supabase
          .from("academic_courses")
          .select("id, name, code, credits, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (courseError) throw courseError;

        const {
          data: assessmentRows,
          error: assessmentError,
        } = await supabase
          .from("academic_assessments")
          .select(
            "id, course_id, title, assessment_type, due_date, completed, obtained_marks, total_marks, result_status, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (assessmentError) throw assessmentError;

        const rawCourses = (courseRows ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          credits: Number(row.credits),
          assessments: (assessmentRows ?? [])
            .filter((item) => item.course_id === row.id)
            .map((item) => ({
              id: item.id,
              title: item.title,
              type: item.assessment_type,
              dueDate: item.due_date ?? "",
              completed: item.completed,
              obtainedMarks: Number(item.obtained_marks),
              totalMarks: Number(item.total_marks),
              resultStatus: item.result_status,
            })),
        }));

        const cloudCourses = rawCourses
          .map(normalizeCourse)
          .filter((course): course is Course => course !== null);

        if (!cancelled) {
          setCourses(cloudCourses);
          setLoadError(null);
        }
      } catch (error) {
        console.error("Could not load cloud courses:", error);

        if (!cancelled) {
          setCourses([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load your courses. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void loadAcademicData();

    return () => {
      cancelled = true;
    };
  }, []);

    
  useEffect(() => {
    let cancelled = false;

    async function loadGradingScale() {
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

        const { data, error } = await supabase
          .from("academic_grading_bands")
          .select("id, min_mark, max_mark, grade_point, grade, sort_order")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true });

        if (error) throw error;

        const normalized = (data ?? [])
          .map((row, index) =>
            normalizeGradeBand(
              {
                id: row.id,
                minMark: Number(row.min_mark),
                maxMark: Number(row.max_mark),
                gradePoint: Number(row.grade_point),
                grade: row.grade,
              },
              index,
            ),
          )
          .filter((band): band is GradeBand => band !== null);

        if (!cancelled) {
          if (normalized.length > 0 && !validateGradeScale(normalized)) {
            const ordered = [...normalized].sort(
              (a, b) => b.minMark - a.minMark,
            );

            setGradingScale(ordered);
            setGradingDraft(ordered);
          } else {
            const defaults = DEFAULT_GRADING_SCALE.map((band) => ({
              ...band,
            }));

            setGradingScale(defaults);
            setGradingDraft(defaults);
          }
        }
      } catch (error) {
        console.error("Could not load cloud grading scale:", error);

        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load your grading scale."
          );
        }
      } finally {
        if (!cancelled) {
          setGradingLoaded(true);
        }
      }
    }

    void loadGradingScale();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    let cancelled = false;

    async function loadPreviousRecord() {
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

        const { data, error } = await supabase
          .from("academic_settings")
          .select("previous_cgpa, completed_credits")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (!cancelled) {
          const normalized: PreviousRecord = data
            ? {
                cgpa:
                  data.previous_cgpa === null
                    ? ""
                    : String(data.previous_cgpa),
                completedCredits:
                  data.completed_credits === null
                    ? ""
                    : String(data.completed_credits),
              }
            : initialPreviousRecord;

          setPreviousRecord(normalized);
          setPreviousRecordDraft(normalized);
        }
      } catch (error) {
        console.error("Could not load previous CGPA settings:", error);

        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load your previous CGPA settings."
          );
        }
      } finally {
        if (!cancelled) {
          setPreviousRecordLoaded(true);
        }
      }
    }

    void loadPreviousRecord();

    return () => {
      cancelled = true;
    };
  }, []);


  const allAssessments = courses.flatMap((course) => course.assessments);
  const completedCount = allAssessments.filter((assessment) => assessment.completed).length;
  const pendingCount = allAssessments.length - completedCount;
  const resultsReceivedCount = allAssessments.filter((assessment) => assessment.resultStatus === "Received").length;
  const resultsPendingCount = allAssessments.length - resultsReceivedCount;
  const overallProgress = allAssessments.length > 0
    ? Math.round((completedCount / allAssessments.length) * 100)
    : 0;

  const courseSummaries: CourseGradeSummary[] = useMemo(() => courses.map((course) => {
    const received = course.assessments.filter((assessment) => assessment.resultStatus === "Received");
    const pending = course.assessments.filter((assessment) => assessment.resultStatus === "Pending");
    const obtained = received.reduce((sum, assessment) => sum + assessment.obtainedMarks, 0);
    const possible = received.reduce((sum, assessment) => sum + assessment.totalMarks, 0);
    const percentage = possible > 0 ? (obtained / possible) * 100 : null;
    return {
      course,
      obtained,
      possible,
      percentage,
      receivedCount: received.length,
      pendingCount: pending.length,
      gradeBand: percentage === null ? null : getGradeBand(gradingScale, percentage),
    };
  }), [courses, gradingScale]);

  const gradedCourseSummaries = courseSummaries.filter((summary) => summary.gradeBand !== null);
  const gradedCredits = gradedCourseSummaries.reduce((sum, summary) => sum + summary.course.credits, 0);
  const weightedGradePoints = gradedCourseSummaries.reduce(
    (sum, summary) => sum + (summary.gradeBand?.gradePoint ?? 0) * summary.course.credits,
    0,
  );
  const semesterGpa = gradedCredits > 0 ? weightedGradePoints / gradedCredits : null;
  const priorCgpaValue = previousRecord.cgpa.trim() === "" ? null : Number(previousRecord.cgpa);
  const priorCreditsValue = previousRecord.completedCredits.trim() === "" ? null : Number(previousRecord.completedCredits);
  const canProjectCgpa =
    priorCgpaValue !== null && Number.isFinite(priorCgpaValue) && priorCgpaValue >= 0 && priorCgpaValue <= 5 &&
    priorCreditsValue !== null && Number.isFinite(priorCreditsValue) && priorCreditsValue >= 0 &&
    semesterGpa !== null && (priorCreditsValue + gradedCredits) > 0;
  const projectedCgpa = canProjectCgpa
    ? (((priorCgpaValue as number) * (priorCreditsValue as number)) + weightedGradePoints) /
      ((priorCreditsValue as number) + gradedCredits)
    : null;

async function createCourse(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const name = courseDraft.name.trim();
  const code = courseDraft.code.trim();
  const credits = Number(courseDraft.credits);

  if (
    !name ||
    !code ||
    !Number.isFinite(credits) ||
    credits <= 0 ||
    credits > 30
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
      .from("academic_courses")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        name: name.slice(0, 100),
        code: code.slice(0, 30),
        credits,
      })
      .select("id, name, code, credits")
      .single();

    if (error) throw error;

    const course: Course = {
      id: data.id,
      name: data.name,
      code: data.code,
      credits: Number(data.credits),
      assessments: [],
    };

    setCourses((current) => [course, ...current]);
    setCourseDraft(initialCourseDraft);
    setShowCourseForm(false);
  } catch (error) {
    console.error("Could not create course:", error);
    alert("Could not create the course. Please try again.");
  }
}

function startCourseEdit(course: Course) {
  setEditingCourseId(course.id);
  setEditCourseDraft({
    name: course.name,
    code: course.code,
    credits: String(course.credits),
  });

  setShowCourseForm(false);
  setCourseDraft(initialCourseDraft);
}

function cancelCourseEdit() {
  if (savingCourseEdit) return;

  setEditingCourseId(null);
  setEditCourseDraft(initialCourseDraft);
}

  async function saveCourseEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const courseId = editingCourseId;
    const name = editCourseDraft.name.trim();
    const code = editCourseDraft.code.trim();
    const credits = Number(editCourseDraft.credits);

    if (
      !courseId ||
      !name ||
      !code ||
      !Number.isFinite(credits) ||
      credits <= 0 ||
      credits > 30 ||
      savingCourseEdit
    ) {
      return;
    }

    if (!userId) {
      window.alert("Your session was not found. Please sign in again.");
      return;
    }

    const existingCourse = courses.find(
      (course) => course.id === courseId,
    );

    if (!existingCourse) return;

    setSavingCourseEdit(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("academic_courses")
        .update({
          name: name.slice(0, 100),
          code: code.slice(0, 30),
          credits,
        })
        .eq("user_id", userId)
        .eq("id", courseId)
        .select("id, name, code, credits")
        .single();

      if (error) throw error;

      setCourses((current) =>
        current.map((course) =>
          course.id === courseId
            ? {
                ...course,
                name: data.name,
                code: data.code,
                credits: Number(data.credits),
              }
            : course,
        ),
      );

      setEditingCourseId(null);
      setEditCourseDraft(initialCourseDraft);
      setLoadError(null);
    } catch (error) {
      console.error("Could not update course:", error);

      window.alert(
        `Could not update this course. ${
          error instanceof Error ? error.message : "Please try again."
        }`,
      );
    } finally {
      setSavingCourseEdit(false);
    }
  }
  async function createAssessment(
    event: FormEvent<HTMLFormElement>,
    courseId: string,
  ) {
    event.preventDefault();

    const draft = assessmentDrafts[courseId] ?? initialAssessmentDraft;
    const title = draft.title.trim();
    const totalMarks = Number(draft.totalMarks);

    const course = courses.find((item) => item.id === courseId);
    if (!course) return;

    if (!title) {
      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: "Please enter an assessment name.",
      }));
      return;
    }

    if (
      !draft.totalMarks.trim() ||
      !Number.isFinite(totalMarks) ||
      totalMarks <= 0
    ) {
      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: "Total marks must be greater than 0.",
      }));
      return;
    }

    const alreadyAllocated = course.assessments.reduce(
      (sum, assessment) => sum + assessment.totalMarks,
      0,
    );

    const remainingMarks = Math.max(0, 100 - alreadyAllocated);

    if (totalMarks > remainingMarks + 0.000001) {
      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: `This course already has ${alreadyAllocated.toLocaleString(
          undefined,
          { maximumFractionDigits: 2 },
        )}/100 marks allocated. You can add at most ${remainingMarks.toLocaleString(
          undefined,
          { maximumFractionDigits: 2 },
        )} more marks.`,
      }));
      return;
    }

    if (!userId) {
      alert("Your session was not found. Please sign in again.");
      return;
    }

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("academic_assessments")
        .insert({
          id: crypto.randomUUID(),
          user_id: userId,
          course_id: courseId,
          title: title.slice(0, 100),
          assessment_type: draft.type,
          due_date: draft.dueDate || null,
          completed: false,
          obtained_marks: 0,
          total_marks: totalMarks,
          result_status: "Pending",
        })
        .select(
          "id, title, assessment_type, due_date, completed, obtained_marks, total_marks, result_status",
        )
        .single();

      if (error) throw error;

      const assessment: Assessment = {
        id: data.id,
        title: data.title,
        type: data.assessment_type,
        dueDate: data.due_date ?? "",
        completed: data.completed,
        obtainedMarks: Number(data.obtained_marks),
        totalMarks: Number(data.total_marks),
        resultStatus: data.result_status,
      };

      setCourses((current) =>
        current.map((item) =>
          item.id === courseId
            ? {
                ...item,
                assessments: [...item.assessments, assessment],
              }
            : item,
        ),
      );

      setAssessmentDrafts((current) => ({
        ...current,
        [courseId]: initialAssessmentDraft,
      }));

      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: "",
      }));

      setAddingAssessmentTo(null);
    } catch (error) {
      console.error("Could not create assessment:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Could not create the assessment. Please try again.";

      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: message,
      }));
    }
  }
function startAssessmentEdit(courseId: string, assessment: Assessment) {
  setEditingAssessmentCourseId(courseId);
  setEditingAssessmentId(assessment.id);

  setEditAssessmentDraft({
    title: assessment.title,
    type: assessment.type,
    dueDate: assessment.dueDate,
    totalMarks: String(assessment.totalMarks),
  });

  setAddingAssessmentTo(null);
  setAssessmentErrors((current) => ({
    ...current,
    [courseId]: "",
  }));
}

function cancelAssessmentEdit() {
  if (savingAssessmentEdit) return;

  setEditingAssessmentId(null);
  setEditingAssessmentCourseId(null);
  setEditAssessmentDraft(initialAssessmentDraft);
}

  async function saveAssessmentEdit(
    event: FormEvent<HTMLFormElement>,
    courseId: string,
    assessmentId: string,
  ) {
    event.preventDefault();

    const title = editAssessmentDraft.title.trim();

    if (
      !title ||
      savingAssessmentEdit ||
      editingAssessmentId !== assessmentId ||
      editingAssessmentCourseId !== courseId
    ) {
      return;
    }

    if (!userId) {
      window.alert("Your session was not found. Please sign in again.");
      return;
    }

    if (
      editAssessmentDraft.dueDate &&
      Number.isNaN(
        new Date(`${editAssessmentDraft.dueDate}T12:00:00`).getTime(),
      )
    ) {
      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: "Please enter a valid due date.",
      }));
      return;
    }

    const course = courses.find((item) => item.id === courseId);
    const assessment = course?.assessments.find(
      (item) => item.id === assessmentId,
    );

    if (!assessment) return;

    setSavingAssessmentEdit(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("academic_assessments")
        .update({
          title: title.slice(0, 100),
          assessment_type: editAssessmentDraft.type,
          due_date: editAssessmentDraft.dueDate || null,
        })
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .eq("id", assessmentId)
        .select("id, title, assessment_type, due_date")
        .single();

      if (error) throw error;

      setCourses((current) =>
        current.map((item) =>
          item.id !== courseId
            ? item
            : {
                ...item,
                assessments: item.assessments.map((entry) =>
                  entry.id === assessmentId
                    ? {
                        ...entry,
                        title: data.title,
                        type: data.assessment_type,
                        dueDate: data.due_date ?? "",
                      }
                    : entry,
                ),
              },
        ),
      );

      setEditingAssessmentId(null);
      setEditingAssessmentCourseId(null);
      setEditAssessmentDraft(initialAssessmentDraft);

      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: "",
      }));
    } catch (error) {
      console.error("Could not update assessment details:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Could not update assessment details. Please try again.";

      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: message,
      }));
    } finally {
      setSavingAssessmentEdit(false);
    }
  }
  function updateAssessmentDraft<K extends keyof AssessmentDraft>(
    courseId: string,
    key: K,
    value: AssessmentDraft[K],
  ) {
    setAssessmentDrafts((current) => ({
      ...current,
      [courseId]: { ...(current[courseId] ?? initialAssessmentDraft), [key]: value },
    }));
  }


async function toggleAssessment(
  courseId: string,
  assessmentId: string,
) {
  if (!userId) {
    alert("Your session was not found. Please sign in again.");
    return;
  }

  const course = courses.find((item) => item.id === courseId);
  const assessment = course?.assessments.find(
    (item) => item.id === assessmentId,
  );

  if (!assessment) return;

  const nextCompleted = !assessment.completed;

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("academic_assessments")
      .update({ completed: nextCompleted })
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("id", assessmentId);

    if (error) throw error;

    setCourses((current) =>
      current.map((item) =>
        item.id !== courseId
          ? item
          : {
              ...item,
              assessments: item.assessments.map((entry) =>
                entry.id === assessmentId
                  ? { ...entry, completed: nextCompleted }
                  : entry,
              ),
            },
      ),
    );
  } catch (error) {
    console.error("Could not update assessment completion:", error);
    alert("Could not update assessment completion. Please try again.");
  }
}


function updateAssessmentMarks(
  courseId: string,
  assessmentId: string,
  field: "obtainedMarks" | "totalMarks",
  rawValue: string,
) {
  if (rawValue.trim() === "") return;

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return;
  }

  const value = Math.min(10000, parsedValue);

  const course = courses.find((item) => item.id === courseId);

  const assessment = course?.assessments.find(
    (item) => item.id === assessmentId,
  );

  if (!course || !assessment) return;

  if (field === "totalMarks") {
    if (value <= 0) {
      setAssessmentErrors((current) => ({
        ...current,
        [courseId]: "Total marks must be greater than 0.",
      }));
      return;
    }

    // Exclude the current assessment when calculating the allowed maximum.
    const otherAllocated = course.assessments.reduce(
      (sum, item) =>
        sum + (item.id === assessmentId ? 0 : item.totalMarks),
      0,
    );

    const maxAllowed = Math.max(0, 100 - otherAllocated);

    if (value > maxAllowed + 0.000001) {
      setAssessmentErrors((current) => ({
        ...current,
        [courseId]:
          `This change would allocate ${(otherAllocated + value).toLocaleString(
            undefined,
            { maximumFractionDigits: 2 },
          )}/100 marks. This assessment can be worth at most ${maxAllowed.toLocaleString(
            undefined,
            { maximumFractionDigits: 2 },
          )} marks unless another assessment's total is reduced.`,
      }));
      return;
    }
  }

  setAssessmentErrors((current) => ({
    ...current,
    [courseId]: "",
  }));

  setCourses((current) =>
    current.map((item) =>
      item.id !== courseId
        ? item
        : {
            ...item,
            assessments: item.assessments.map((currentAssessment) => {
              if (currentAssessment.id !== assessmentId) {
                return currentAssessment;
              }

              if (field === "totalMarks") {
                return {
                  ...currentAssessment,
                  totalMarks: value,
                  obtainedMarks: Math.min(
                    currentAssessment.obtainedMarks,
                    value,
                  ),
                };
              }

              return {
                ...currentAssessment,
                obtainedMarks: Math.min(value,currentAssessment.totalMarks,),
              };
            }),
          },
    ),
  );
}

  async function saveAssessmentMarks(
    courseId: string,
    assessmentId: string,
  ): Promise<boolean> {
    if (!userId) {
      window.alert("Your session was not found. Please sign in again.");
      return false;
    }

    const course = courses.find((item) => item.id === courseId);
    const assessment = course?.assessments.find(
      (item) => item.id === assessmentId,
    );

    if (!assessment) return false;

    const key = `${courseId}:${assessmentId}`;
    const requestVersion =
      (assessmentMarksSaveVersions.current.get(key) ?? 0) + 1;

    assessmentMarksSaveVersions.current.set(key, requestVersion);

    const marksToSave = {
      obtainedMarks: assessment.obtainedMarks,
      totalMarks: assessment.totalMarks,
    };

    // Queue saves for the same assessment so they cannot race each other.
    const previousSave =
      assessmentMarksSaveQueue.current.get(key) ?? Promise.resolve();

    const saveOperation = previousSave
      .catch(() => undefined)
      .then(async (): Promise<boolean> => {
        try {
          const supabase = createClient();

          const { data, error } = await supabase
            .from("academic_assessments")
            .update({
              obtained_marks: marksToSave.obtainedMarks,
              total_marks: marksToSave.totalMarks,
            })
            .eq("user_id", userId)
            .eq("course_id", courseId)
            .eq("id", assessmentId)
            .select("id, obtained_marks, total_marks")
            .single();

          if (error) throw error;

          // An older request must not overwrite newer UI values.
          if (
            assessmentMarksSaveVersions.current.get(key) === requestVersion
          ) {
            setCourses((current) =>
              current.map((item) =>
                item.id !== courseId
                  ? item
                  : {
                      ...item,
                      assessments: item.assessments.map((entry) =>
                        entry.id !== assessmentId
                          ? entry
                          : {
                              ...entry,
                              obtainedMarks: Number(data.obtained_marks),
                              totalMarks: Number(data.total_marks),
                            },
                      ),
                    },
              ),
            );
          }

          return true;
        } catch (error) {
          console.error("Could not save assessment marks:", error);

          // If a newer save is queued, let that request handle the final state.
          if (
            assessmentMarksSaveVersions.current.get(key) !== requestVersion
          ) {
            return false;
          }

          try {
            const supabase = createClient();

            const {
              data: savedMarks,
              error: restoreError,
            } = await supabase
              .from("academic_assessments")
              .select("obtained_marks, total_marks")
              .eq("user_id", userId)
              .eq("course_id", courseId)
              .eq("id", assessmentId)
              .single();

            if (restoreError) throw restoreError;

            // Recheck after the read in case another save was requested meanwhile.
            if (
              assessmentMarksSaveVersions.current.get(key) === requestVersion
            ) {
              setCourses((current) =>
                current.map((item) =>
                  item.id !== courseId
                    ? item
                    : {
                        ...item,
                        assessments: item.assessments.map((entry) =>
                          entry.id !== assessmentId
                            ? entry
                            : {
                                ...entry,
                                obtainedMarks: Number(savedMarks.obtained_marks),
                                totalMarks: Number(savedMarks.total_marks),
                              },
                        ),
                      },
                ),
              );

              window.alert(
                "Could not save the marks. Your last saved values have been restored.",
              );
            }
          } catch (restoreError) {
            console.error(
              "Could not restore saved assessment marks:",
              restoreError,
            );

            if (
              assessmentMarksSaveVersions.current.get(key) === requestVersion
            ) {
              window.alert(
                "Could not save or verify the marks. Please refresh Academics before editing again.",
              );
            }
          }

          return false;
        }
      });

    const queueEntry = saveOperation.then(
      () => undefined,
      () => undefined,
    );

    assessmentMarksSaveQueue.current.set(key, queueEntry);

    try {
      return await saveOperation;
    } finally {
      if (assessmentMarksSaveQueue.current.get(key) === queueEntry) {
        assessmentMarksSaveQueue.current.delete(key);
      }
    }
  }
  async function toggleResultStatus(
    courseId: string,
    assessmentId: string,
  ) {
    if (!userId) {
      alert("Your session was not found. Please sign in again.");
      return;
    }

    const course = courses.find((item) => item.id === courseId);
    const assessment = course?.assessments.find(
      (item) => item.id === assessmentId,
    );

    if (!assessment) return;

    const nextStatus =
      assessment.resultStatus === "Received" ? "Pending" : "Received";

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("academic_assessments")
        .update({ result_status: nextStatus })
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .eq("id", assessmentId);

      if (error) throw error;

      setCourses((current) =>
        current.map((item) =>
          item.id !== courseId
            ? item
            : {
                ...item,
                assessments: item.assessments.map((entry) =>
                  entry.id === assessmentId
                    ? { ...entry, resultStatus: nextStatus }
                    : entry,
                ),
              },
        ),
      );
    } catch (error) {
      console.error("Could not update result status:", error);
      alert("Could not update the result status. Please try again.");
    }
  }



async function deleteAssessment(
  courseId: string,
  assessmentId: string,
) {
  if (!userId) {
    alert("Your session was not found. Please sign in again.");
    return;
  }

  const assessment = courses
    .find((course) => course.id === courseId)
    ?.assessments.find((item) => item.id === assessmentId);

  if (!assessment) return;

  const confirmed = await requestConfirmation({
    title: "Delete this assessment?",
    message: `Are you sure you want to delete "${assessment.title}"? This action cannot be undone.`,
    confirmLabel: "Delete assessment",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("academic_assessments")
      .delete()
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("id", assessmentId);

    if (error) throw error;

    setCourses((current) =>
      current.map((course) =>
        course.id === courseId
          ? {
              ...course,
              assessments: course.assessments.filter(
                (item) => item.id !== assessmentId,
              ),
            }
          : course,
      ),
    );
  } catch (error) {
    console.error("Could not delete assessment:", error);
    alert("Could not delete the assessment. Please try again.");
  }
}


async function deleteCourse(courseId: string) {
  if (!userId) {
    alert("Your session was not found. Please sign in again.");
    return;
  }

  const course = courses.find((item) => item.id === courseId);
  if (!course) return;

  const confirmed = await requestConfirmation({
    title: "Delete this course?",
    message: `Are you sure you want to delete "${course.name}" and its academic records? This action cannot be undone.`,
    confirmLabel: "Delete course",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("academic_courses")
      .delete()
      .eq("user_id", userId)
      .eq("id", courseId);

    if (error) throw error;

    setCourses((current) =>
      current.filter((item) => item.id !== courseId),
    );

    setAddingAssessmentTo(null);
  } catch (error) {
    console.error("Could not delete course:", error);
    alert("Could not delete the course. Please try again.");
  }
}

  function updateGradingDraft<K extends keyof GradeBand>(id: string, key: K, value: GradeBand[K]) {
    setGradingDraft((current) => current.map((band) => band.id === id ? { ...band, [key]: value } : band));
  }

  function addGradeBand() {
    setGradingDraft((current) => [
      ...current,
      { id: crypto.randomUUID(), minMark: 0, maxMark: 0, gradePoint: 0, grade: "New grade" },
    ]);
    setGradingError("Adjust the new mark range so it does not overlap another band, then save.");
  }


  async function persistGradingScale(scale: GradeBand[]) {
    if (!userId) {
      throw new Error(
        "Your session was not found. Please sign in again."
      );
    }

    const supabase = createClient();

    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from("academic_grading_bands")
      .select("id")
      .eq("user_id", userId);

    if (existingError) throw existingError;

    const rows = scale.map((band, index) => ({
      id: band.id,
      user_id: userId,
      min_mark: band.minMark,
      max_mark: band.maxMark,
      grade_point: band.gradePoint,
      grade: band.grade.trim(),
      sort_order: index,
    }));

    const { error: saveError } = await supabase
      .from("academic_grading_bands")
      .upsert(rows, {
        onConflict: "user_id,id",
      });

    if (saveError) throw saveError;

    const retainedIds = new Set(scale.map((band) => band.id));

    for (const row of existingRows ?? []) {
      if (retainedIds.has(row.id)) continue;

      const { error: deleteError } = await supabase
        .from("academic_grading_bands")
        .delete()
        .eq("user_id", userId)
        .eq("id", row.id);

      if (deleteError) throw deleteError;
    }
  }

  async function saveGradingScale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateGradeScale(gradingDraft);

    if (validationError) {
      setGradingError(validationError);
      return;
    }

    const ordered = [...gradingDraft].sort(
      (a, b) => b.minMark - a.minMark,
    );

    try {
      await persistGradingScale(ordered);

      setGradingScale(ordered);
      setGradingDraft(ordered);
      setGradingError("");
      setShowGradingPanel(false);
    } catch (error) {
      console.error("Could not save grading scale:", error);

      setGradingError(
        error instanceof Error
          ? error.message
          : "Could not save the grading scale. Please try again.",
      );
    }
  }



  async function resetGradingScale() {
    const defaults = DEFAULT_GRADING_SCALE.map((band) => ({
      ...band,
    }));

    try {
      await persistGradingScale(defaults);

      setGradingDraft(defaults);
      setGradingScale(defaults);
      setGradingError("");
    } catch (error) {
      console.error("Could not reset grading scale:", error);

      setGradingError(
        error instanceof Error
          ? error.message
          : "Could not reset the grading scale. Please try again.",
      );
    }
  }



  async function savePreviousRecord(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cgpaText = previousRecordDraft.cgpa.trim();
    const creditsText = previousRecordDraft.completedCredits.trim();

    const cgpa = Number(cgpaText);
    const credits = Number(creditsText);

    if (
      cgpaText === "" ||
      creditsText === "" ||
      !Number.isFinite(cgpa) ||
      !Number.isFinite(credits) ||
      cgpa < 0 ||
      cgpa > 5 ||
      credits < 0 ||
      credits > 1000
    ) {
      return;
    }

    if (!userId) {
      alert("Your session was not found. Please sign in again.");
      return;
    }

    const normalized: PreviousRecord = {
      cgpa: String(cgpa),
      completedCredits: String(credits),
    };

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("academic_settings")
        .upsert(
          {
            user_id: userId,
            previous_cgpa: cgpa,
            completed_credits: credits,
          },
          { onConflict: "user_id" },
        );

      if (error) throw error;

      setPreviousRecord(normalized);
      setPreviousRecordDraft(normalized);
      setShowCgpaSettings(false);
    } catch (error) {
      console.error("Could not save previous CGPA settings:", error);
      alert("Could not save your CGPA settings. Please try again.");
    }
  }

  if (!loaded || !gradingLoaded || !previousRecordLoaded) {
    return <section className="panel academics-loading">Loading your courses...</section>;
  }
  if (loadError) {
  return (
    <section className="panel academics-loading">
      <p>Could not load your cloud courses.</p>
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
    <section className="academics-workspace">
      <div className="academics-page-heading">
        <div>
          <div className="panel-kicker">YOUR LEARNING WORKSPACE</div>
          <h1>Academics</h1>
          <p>Organize your courses, track assessment marks, and estimate your GPA.</p>
        </div>
        <div className="academics-heading-actions">
          <button className="text-button academics-secondary-button" type="button" onClick={() => {
            setShowGradingPanel((current) => !current);
            setGradingDraft(gradingScale.map((band) => ({ ...band })));
            setGradingError("");
          }}>
            <Settings2 size={15} /> {showGradingPanel ? "Close grading scale" : "Grading scale"}
          </button>
          <button className="text-button" type="button" onClick={() => setShowCourseForm((current) => !current)}>
            <Plus size={15} /> {showCourseForm ? "Cancel" : "Add course"}
          </button>
        </div>
      </div>

      <div className="academics-summary">
        <article className="academics-summary-card">
          <span className="academics-summary-icon"><BookOpen size={19} /></span>
          <div><span className="academics-summary-label">YOUR COURSES</span><strong>{courses.length}</strong></div>
        </article>
        <article className="academics-summary-card">
          <span className="academics-summary-icon"><ClipboardList size={19} /></span>
          <div><span className="academics-summary-label">ASSESSMENTS TO DO</span><strong>{pendingCount}</strong></div>
        </article>
        <article className="academics-summary-card">
          <span className="academics-summary-icon"><Check size={19} /></span>
          <div><span className="academics-summary-label">CHECKLIST PROGRESS</span><strong>{overallProgress}%</strong></div>
        </article>
      </div>

      <section className="academics-grade-overview">
        <div className="academics-grade-overview-top">
          <div>
            <div className="academics-grade-overview-kicker"><Award size={15} /> MARKS &amp; GPA OVERVIEW</div>
            <h2>{semesterGpa === null ? "Your grade picture will appear here" : `Provisional semester GPA · ${semesterGpa.toFixed(2)}`}</h2>
            <p>
              {gradedCourseSummaries.length === 0
                ? "Mark an assessment result as received to begin estimating your GPA. Pending results are excluded."
                : `Based on returned marks in ${gradedCourseSummaries.length} course${gradedCourseSummaries.length === 1 ? "" : "s"}; ${resultsPendingCount} assessment result${resultsPendingCount === 1 ? " is" : "s are"} still pending.`}
            </p>
          </div>
          <div className="academics-grade-overview-actions">
            <button className="academics-outline-button" type="button" onClick={() => {
              setPreviousRecordDraft(previousRecord);
              setShowCgpaSettings((current) => !current);
            }}>
              <Settings2 size={14} /> {showCgpaSettings ? "Close CGPA settings" : "CGPA settings"}
            </button>
            {projectedCgpa !== null && (
              <div className="academics-projected-cgpa">
                <span>PROJECTED CGPA</span><strong>{projectedCgpa.toFixed(2)}</strong>
              </div>
            )}
          </div>
        </div>
        <div className="academics-grade-overview-stats">
          <div><span>Results received</span><strong>{resultsReceivedCount}</strong></div>
          <div><span>Results pending</span><strong>{resultsPendingCount}</strong></div>
          <div><span>Credits with a grade</span><strong>{gradedCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
        </div>
        {showCgpaSettings && (
          <form className="academics-cgpa-settings" onSubmit={savePreviousRecord}>
            <div className="academics-grade-panel-heading">
              <div><h3>Previous academic record</h3><p>Enter your existing CGPA and credits already completed to estimate a cumulative CGPA.</p></div>
              <button className="academics-icon-button" type="button" aria-label="Close CGPA settings" onClick={() => setShowCgpaSettings(false)}><X size={16} /></button>
            </div>
            <div className="academics-cgpa-settings-grid">
              <label className="academics-field"><span>Previous CGPA (your university scale)</span><input type="number" min="0" max="5" step="0.01" value={previousRecordDraft.cgpa} onChange={(event) => setPreviousRecordDraft((current) => ({ ...current, cgpa: event.target.value }))} placeholder="e.g. 3.34" required /></label>
              <label className="academics-field"><span>Credits already completed</span><input type="number" min="0" max="1000" step="0.5" value={previousRecordDraft.completedCredits} onChange={(event) => setPreviousRecordDraft((current) => ({ ...current, completedCredits: event.target.value }))} placeholder="e.g. 70" required /></label>
            </div>
            <p className="academics-inline-note">Projection uses only courses that currently have a valid grade from returned assessment marks. It is an estimate, not an official transcript result.</p>
            <div className="academics-form-actions"><button className="primary-button" type="submit"><Save size={14} /> Save CGPA settings</button></div>
          </form>
        )}
      </section>

      {showGradingPanel && (
        <form className="panel academics-grade-panel" onSubmit={saveGradingScale}>
          <div className="academics-grade-panel-heading">
            <div><h2>Custom grading scale</h2><p>Define which percentage range maps to each grade point. Each assessment&apos;s received marks contribute to its course&apos;s current percentage.</p></div>
            <button className="academics-icon-button" type="button" aria-label="Close grading scale" onClick={() => setShowGradingPanel(false)}><X size={16} /></button>
          </div>
          <div className="academics-grade-scale-note">Starter scale: Southeast University-style 4.00 grading. Confirm it against your programme&apos;s current handbook and edit any differences.</div>
          <div className="academics-grade-table-wrap">
            <div className="academics-grade-row academics-grade-row-header"><span>Grade</span><span>Minimum %</span><span>Maximum %</span><span>Grade point</span><span aria-hidden="true" /></div>
            {gradingDraft.map((band) => (
              <div className="academics-grade-row" key={band.id}>
                <label className="academics-grade-input"><span className="academics-visually-hidden">Grade label</span><input aria-label="Grade label" value={band.grade} maxLength={12} onChange={(event) => updateGradingDraft(band.id, "grade", event.target.value)} required /></label>
                <label className="academics-grade-input"><span className="academics-visually-hidden">Minimum mark</span><input aria-label="Minimum mark" type="number" min="0" max="100" step="1" value={band.minMark} onChange={(event) => updateGradingDraft(band.id, "minMark", Number(event.target.value))} required /></label>
                <label className="academics-grade-input"><span className="academics-visually-hidden">Maximum mark</span><input aria-label="Maximum mark" type="number" min="0" max="100" step="1" value={band.maxMark} onChange={(event) => updateGradingDraft(band.id, "maxMark", Number(event.target.value))} required /></label>
                <label className="academics-grade-input"><span className="academics-visually-hidden">Grade point</span><input aria-label="Grade point" type="number" min="0" max="5" step="0.01" value={band.gradePoint} onChange={(event) => updateGradingDraft(band.id, "gradePoint", Number(event.target.value))} required /></label>
                <button className="academics-icon-button academics-remove-grade" type="button" aria-label={`Remove ${band.grade} grading band`} title="Remove grading band" onClick={() => setGradingDraft((current) => current.filter((item) => item.id !== band.id))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          {gradingError && <p className="academics-grading-error" role="alert">{gradingError}</p>}
          <div className="academics-form-actions academics-grade-actions">
            <button className="text-button academics-cancel" type="button" onClick={addGradeBand}><Plus size={14} /> Add grade band</button>
            <button className="text-button academics-cancel" type="button" onClick={resetGradingScale}>Reset default</button>
            <button className="primary-button" type="submit"><Save size={14} /> Save grading scale</button>
          </div>
        </form>
      )}

      {showCourseForm && (
        <form className="panel academics-create-form" onSubmit={createCourse}>
          <div className="academics-form-heading">
            <div><h2>Add a course</h2><p>Enter the course name, code, and credit hours.</p></div>
            <BookOpen size={20} />
          </div>
          <div className="academics-form-grid academics-course-form-grid">
            <label className="academics-field"><span>Course name</span><input autoFocus value={courseDraft.name} onChange={(event) => setCourseDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Computer Architecture" maxLength={100} required /></label>
            <label className="academics-field"><span>Course code</span><input value={courseDraft.code} onChange={(event) => setCourseDraft((current) => ({ ...current, code: event.target.value }))} placeholder="e.g. CSE343.1" maxLength={30} required /></label>
            <label className="academics-field"><span>Credits</span><input type="number" min="0.5" max="30" step="0.5" value={courseDraft.credits} onChange={(event) => setCourseDraft((current) => ({ ...current, credits: event.target.value }))} required /></label>
          </div>
          <div className="academics-form-actions">
            <button className="text-button academics-cancel" type="button" onClick={() => { setShowCourseForm(false); setCourseDraft(initialCourseDraft); }}>Cancel</button>
            <button className="primary-button" type="submit"><Plus size={15} /> Create course</button>
          </div>
        </form>
      )}

      <div className="academics-list-heading">
        <div><h2>Your courses</h2><p>Each course has its own assessment checklist, marks, and provisional grade.</p></div>
      </div>

      {courses.length === 0 ? (
        <div className="panel academics-empty">
          <span className="academics-empty-icon"><GraduationCap size={27} /></span>
          <h3>Your courses will appear here</h3>
          <p>Add a course first, then include its quizzes, assignments, viva exams, presentations, and lab reports.</p>
          <button className="text-button" type="button" onClick={() => setShowCourseForm(true)}><Plus size={15} /> Add your first course</button>
        </div>
      ) : (
        <div className="academics-course-grid">
          {courses.map((course) => {
            const completed = course.assessments.filter((assessment) => assessment.completed).length;
            const total = course.assessments.length;
            const courseProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
            const draft = assessmentDrafts[course.id] ?? initialAssessmentDraft;
            const summary = courseSummaries.find((item) => item.course.id === course.id);

            return (
              <article className="panel academics-course-card" key={course.id}>
                <div className="academics-course-accordion-header">
                  <button
                    className="academics-course-accordion-trigger"
                    type="button"
                    aria-expanded={expandedCourseIds.has(course.id)}
                    aria-controls={`academics-course-details-${course.id}`}
                    onClick={() => toggleCourseExpanded(course.id)}
                  >
                    <span className="academics-course-icon" aria-hidden="true">
                      <BookOpen size={20} />
                    </span>
                    <span className="academics-course-accordion-copy">
                      <strong>{course.name}</strong>
                      <span className="academics-course-accordion-code">
                        {course.code} <span>· {course.credits} credits</span>
                      </span>
                      <span className="academics-course-accordion-progress">
                        {total} {total === 1 ? "assessment" : "assessments"} · {completed}/{total} done
                      </span>
                    </span>
                    <ChevronDown
                      className={`academics-course-accordion-chevron ${expandedCourseIds.has(course.id) ? "is-expanded" : ""}`}
                      size={19}
                      aria-hidden="true"
                    />
                  </button>

                  <div className="academics-course-actions">
                    <button
                      className="academics-edit"
                      type="button"
                      onClick={() => {
                        setExpandedCourseIds((current) => new Set(current).add(course.id));
                        startCourseEdit(course);
                      }}
                      disabled={savingCourseEdit}
                      title="Edit course"
                      aria-label={`Edit course ${course.name}`}
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      className="academics-delete"
                      type="button"
                      onClick={() => deleteCourse(course.id)}
                      title="Delete course"
                      aria-label={`Delete course ${course.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {editingCourseId === course.id && (
  <form
    className="academics-course-edit-form"
    onSubmit={saveCourseEdit}
  >
    <div className="academics-form-heading">
      <div>
        <h2>Edit course</h2>
        <p>Update your course details.</p>
      </div>
      <BookOpen size={20} />
    </div>

    <div className="academics-form-grid academics-course-form-grid">
      <label className="academics-field">
        <span>Course name</span>
        <input
          autoFocus
          value={editCourseDraft.name}
          onChange={(event) =>
            setEditCourseDraft((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          maxLength={100}
          required
        />
      </label>

      <label className="academics-field">
        <span>Course code</span>
        <input
          value={editCourseDraft.code}
          onChange={(event) =>
            setEditCourseDraft((current) => ({
              ...current,
              code: event.target.value,
            }))
          }
          maxLength={30}
          required
        />
      </label>

      <label className="academics-field">
        <span>Credits</span>
        <input
          type="number"
          min="0.5"
          max="30"
          step="0.5"
          value={editCourseDraft.credits}
          onChange={(event) =>
            setEditCourseDraft((current) => ({
              ...current,
              credits: event.target.value,
            }))
          }
          required
        />
      </label>
    </div>

    <div className="academics-form-actions">
      <button
        className="text-button academics-cancel"
        type="button"
        onClick={cancelCourseEdit}
        disabled={savingCourseEdit}
      >
        Cancel
      </button>

      <button
        className="primary-button"
        type="submit"
        disabled={savingCourseEdit}
      >
        <Save size={14} />
        {savingCourseEdit ? "Saving..." : "Save changes"}
      </button>
    </div>
  </form>
)}
                {expandedCourseIds.has(course.id) && (
                  <div
                    id={`academics-course-details-${course.id}`}
                    className="academics-course-details"
                  >
                <div className="academics-course-progress-heading"><span>Assessment checklist</span><strong>{courseProgress}%</strong></div>
                <div className="academics-progress-track" role="progressbar" aria-label={`${course.name} assessment completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={courseProgress}><span style={{ width: `${courseProgress}%` }} /></div>
                <div className="academics-assessment-heading">
                    <strong>Assessments</strong>
                    <span>{completed}/{total} done</span>
                    </div>

                    <div className="academics-course-marks-allocation">
                    {(() => {
                        const allocated = course.assessments.reduce(
                        (sum, assessment) => sum + assessment.totalMarks,
                        0,
                        );

                        const remaining = Math.max(0, 100 - allocated);

                        return (
                        <>
                            <span>Course marks allocated</span>
                            <strong>
                            {allocated.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                            })} / 100
                            </strong>
                            <span className="academics-marks-remaining">
                            {allocated > 100.000001
                                ? "Over limit"
                                : `${remaining.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })} marks remaining`}
                            </span>
                        </>
                        );
                    })()}
                    </div>

                    {assessmentErrors[course.id] && (
                    <p className="academics-assessment-error" role="alert">
                        {assessmentErrors[course.id]}
                    </p>
                    )}

                {total === 0 ? (
                  <p className="academics-no-assessments">No assessments yet. Add your first assessment below.</p>
                ) : (
                  <div className="academics-assessment-list">
                    {course.assessments.map((assessment) => {
                      const dueStatus = getDueStatus(assessment.dueDate, assessment.completed);
                      return (
                        <div
                            className={`academics-assessment-row ${
                                assessment.completed ? "completed" : ""
                            }`}
                            key={assessment.id}
                            >
                            {/* Left: checklist, title, type, date and result status */}
                            <div className="academics-assessment-main-row">
                                <button
                                className={`academics-assessment-check ${
                                    assessment.completed ? "checked" : ""
                                }`}
                                type="button"
                                onClick={() => toggleAssessment(course.id, assessment.id)}
                                aria-label={
                                    assessment.completed
                                    ? `Mark ${assessment.title} incomplete`
                                    : `Complete ${assessment.title}`
                                }
                                aria-pressed={assessment.completed}
                                >
                                {assessment.completed && <Check size={12} />}
                                </button>

                                {editingAssessmentId === assessment.id &&
                                editingAssessmentCourseId === course.id ? (
                                    <form
                                        className="academics-assessment-edit-form"
                                        onSubmit={(event) =>
                                            saveAssessmentEdit(event, course.id, assessment.id)
                                        }
                                    >
                                        <label className="academics-assessment-edit-field">
                                            <span>Assessment name</span>
                                            <input
                                                autoFocus
                                                value={editAssessmentDraft.title}
                                                onChange={(event) =>
                                                    setEditAssessmentDraft((current) => ({
                                                        ...current,
                                                        title: event.target.value,
                                                    }))
                                                }
                                                maxLength={100}
                                                required
                                            />
                                        </label>

                                        <div className="academics-assessment-edit-grid">
                                            <label className="academics-assessment-edit-field">
                                                <span>Assessment type</span>
                                                <select
                                                    value={editAssessmentDraft.type}
                                                    onChange={(event) =>
                                                        setEditAssessmentDraft((current) => ({
                                                            ...current,
                                                            type: event.target.value as AssessmentType,
                                                        }))
                                                    }
                                                >
                                                    {assessmentTypes.map((type) => (
                                                        <option key={type} value={type}>
                                                            {type}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="academics-assessment-edit-field">
                                                <span>Due date</span>
                                                <input
                                                    type="date"
                                                    value={editAssessmentDraft.dueDate}
                                                    onChange={(event) =>
                                                        setEditAssessmentDraft((current) => ({
                                                            ...current,
                                                            dueDate: event.target.value,
                                                        }))
                                                    }
                                                />
                                            </label>
                                        </div>

                                        <div className="academics-assessment-edit-actions">
                                            <button
                                                className="text-button academics-cancel"
                                                type="button"
                                                onClick={cancelAssessmentEdit}
                                                disabled={savingAssessmentEdit}
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                className="primary-button"
                                                type="submit"
                                                disabled={savingAssessmentEdit}
                                            >
                                                <Save size={14} />
                                                {savingAssessmentEdit ? "Saving..." : "Save details"}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="academics-assessment-copy">
                                        <strong>{assessment.title}</strong>

                                        <div className="academics-assessment-meta">
                                            <span
                                                className={`assessment-type type-${assessment.type
                                                    .toLowerCase()
                                                    .replace("-", "")}`}
                                            >
                                                {assessment.type}
                                            </span>

                                            {assessment.dueDate && (
                                                <span className="assessment-due">
                                                    <CalendarDays size={11} />
                                                    {formatDueDate(assessment.dueDate)}
                                                </span>
                                            )}

                                            {dueStatus && (
                                                <span
                                                    className={`assessment-due-status ${
                                                        dueStatus === "Overdue" ? "overdue" : ""
                                                    }`}
                                                >
                                                    {dueStatus}
                                                </span>
                                            )}

                                            <button
                                                className={`academics-result-button ${
                                                    assessment.resultStatus === "Received"
                                                        ? "received"
                                                        : "pending"
                                                }`}
                                                type="button"
                                                onClick={() =>
                                                    toggleResultStatus(course.id, assessment.id)
                                                }
                                                title="Toggle result status"
                                            >
                                                <span className="academics-result-dot" />
                                                {assessment.resultStatus === "Received"
                                                    ? "Received"
                                                    : "Pending"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Middle: compact marks fields */}
                            <div className="academics-assessment-marks">
                              <label className="academics-mark-field">
                                    <span>Obtained</span>
                                    <input
                                        aria-label={`${assessment.title} obtained marks`}
                                        type="number"
                                        min="0"
                                        max={assessment.totalMarks}
                                        step="any"
                                        value={assessment.obtainedMarks}
                                        onChange={(event) =>
                                          updateAssessmentMarks(
                                            course.id,
                                            assessment.id,
                                            "obtainedMarks",
                                            event.target.value,
                                          )
                                        }
                                        onBlur={() => saveAssessmentMarks(course.id, assessment.id)}
                                        onKeyDown={(event) => {
                                        if (event.key !== "Enter") return;

                                        event.preventDefault();

                                        void (async () => {
                                          const saved = await saveAssessmentMarks(
                                            course.id,
                                            assessment.id,
                                          );

                                          if (!saved) return;

                                          if (assessment.resultStatus === "Pending") {
                                            await toggleResultStatus(course.id, assessment.id);
                                          }
                                        })();
                                      }}
                                    />
                              </label>

                                <span className="academics-mark-divider">/</span>

                                <label className="academics-mark-field">
                                <span>Total</span>
                                <input
                                      aria-label={`${assessment.title} total marks`}
                                      type="number"
                                      min="0.01"
                                      max="100"
                                      step="any"
                                      value={assessment.totalMarks}
                                      onChange={(event) =>
                                        updateAssessmentMarks(
                                          course.id,
                                          assessment.id,
                                          "totalMarks",
                                          event.target.value,
                                        )
                                      }
                                      onBlur={() => saveAssessmentMarks(course.id, assessment.id)}
                                />
                                </label>
                            </div>

                            {/* Right: edit and delete actions */}
                            <div className="academics-assessment-actions">
                                {!(
                                    editingAssessmentId === assessment.id &&
                                    editingAssessmentCourseId === course.id
                                ) && (
                                    <button
                                        className="academics-edit-assessment"
                                        type="button"
                                        onClick={() =>
                                            startAssessmentEdit(course.id, assessment)
                                        }
                                        disabled={savingAssessmentEdit}
                                        title="Edit assessment details"
                                        aria-label={`Edit assessment ${assessment.title}`}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                )}

                                <button
                                    className="academics-delete-assessment"
                                    type="button"
                                    onClick={() =>
                                        deleteAssessment(course.id, assessment.id)
                                    }
                                    title="Delete assessment"
                                    aria-label={`Delete assessment ${assessment.title}`}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            </div>
                      );
                    })}
                  </div>
                )}

                <div className="academics-course-grade-summary">
                  <div><span>Returned marks</span><strong>{summary && summary.possible > 0 ? `${summary.obtained.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${summary.possible.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</strong></div>
                  <div><span>Current average</span><strong>{summary?.percentage !== null && summary?.percentage !== undefined ? `${summary.percentage.toFixed(2)}%` : "—"}</strong></div>
                  <div><span>Grade point</span><strong>{summary?.gradeBand ? `${summary.gradeBand.gradePoint.toFixed(2)} · ${summary.gradeBand.grade}` : "—"}</strong></div>
                </div>
                <p className="academics-grade-footnote">Current grade uses results marked as received only. It can change when more marks are returned.</p>

                {addingAssessmentTo === course.id ? (
                    <form
                        className="academics-assessment-form"
                        noValidate
                        onSubmit={(event) => createAssessment(event, course.id)}
                    >
                        <label className="academics-field">
                        <span>Assessment name</span>
                        <input
                            autoFocus
                            value={draft.title}
                            onChange={(event) =>
                            updateAssessmentDraft(
                                course.id,
                                "title",
                                event.target.value,
                            )
                            }
                            placeholder="e.g. Quiz 1"
                            maxLength={100}
                            required
                        />
                        </label>

                        <div className="academics-form-grid academics-assessment-form-grid">
                        <label className="academics-field">
                            <span>Assessment type</span>
                            <select
                            value={draft.type}
                            onChange={(event) =>
                                updateAssessmentDraft(
                                course.id,
                                "type",
                                event.target.value as AssessmentType,
                                )
                            }
                            >
                            {assessmentTypes.map((type) => (
                                <option key={type} value={type}>
                                {type}
                                </option>
                            ))}
                            </select>
                        </label>

                        <label className="academics-field">
                            <span>Total marks</span>
                            <input
                            type="number"
                            min="0.01"
                            max="100"
                            step="any"
                            value={draft.totalMarks}
                            onChange={(event) =>
                                updateAssessmentDraft(
                                course.id,
                                "totalMarks",
                                event.target.value,
                                )
                            }
                            required
                            />
                        </label>

                        <label className="academics-field">
                            <span>Due date (optional)</span>
                            <input
                            type="date"
                            value={draft.dueDate}
                            onChange={(event) =>
                                updateAssessmentDraft(
                                course.id,
                                "dueDate",
                                event.target.value,
                                )
                            }
                            />
                        </label>
                        </div>

                        {assessmentErrors[course.id] && (
                        <p className="academics-assessment-error" role="alert">
                            {assessmentErrors[course.id]}
                        </p>
                        )}

                        <p className="academics-inline-note">
                        Obtained marks will start at <strong>0</strong>.
                        You can update them later when your result is available.
                        New assessments are marked <strong>Result pending</strong>
                        and are excluded from GPA until the result is received.
                        </p>

                        <div className="academics-form-actions">
                        <button
                            className="text-button academics-cancel"
                            type="button"
                            onClick={() => {
                            setAddingAssessmentTo(null);
                            setAssessmentErrors((current) => ({
                                ...current,
                                [course.id]: "",
                            }));
                            }}
                        >
                            Cancel
                        </button>

                        <button className="primary-button" type="submit">
                            <Plus size={14} />
                            Add assessment
                        </button>
                        </div>
                    </form>
                    ) : (
                    <button
                        className="academics-add-assessment"
                        type="button"
                        onClick={() => setAddingAssessmentTo(course.id)}
                    >
                        <Plus size={14} />
                        Add assessment
                    </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="academics-note"><GraduationCap size={16} /><span>Your courses and assessments are saved to your LifeOS account. CGPA estimates are based on returned assessment marks and your configured grading scale.</span></div>
    </section>
  );
}
