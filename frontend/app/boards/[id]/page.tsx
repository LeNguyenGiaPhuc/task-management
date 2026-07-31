"use client";

import { FormEvent, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { API_BASE_URL, apiFetch, type AuthUser } from "../../api";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type TaskType = "TASK" | "BUG" | "STORY" | "EPIC";
type PriorityFilter = "ALL" | Priority;
type BoardRole = "OWNER" | "ADMIN" | "MEMBER";
type EditableBoardRole = "ADMIN" | "MEMBER";
type AssigneeFilter = "ALL" | "UNASSIGNED" | string;
type DueFilter = "ALL" | "OVERDUE" | "DUE_SOON" | "NO_DUE";
type BoardView = "BOARD" | "REPORTS";

type User = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
};

type BoardMember = {
  board_id: string;
  user_id: string;
  role?: BoardRole | null;
  project_role?: string | null;
  joined_at?: string | null;
  users: User;
};


type TaskComment = {
  id: string;
  task_id: string;
  user_id?: string | null;
  content: string;
  created_at?: string | null;
  updated_at?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_avatar_url?: string | null;
};

type TaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  uploaded_by?: string | null;
  created_at?: string | null;
  users?: User | null;
};

type SubTask = {
  id: string;
  title: string;
  is_completed?: boolean | null;
  order: number;
};

type Task = {
  id: string;
  column_id?: string;
  title: string;
  description?: string | null;
  task_type?: TaskType | null;
  priority?: Priority | null;
  assignee_id?: string | null;
  due_date?: string | null;
  order: number;
  archived_at?: string | null;
  users?: User | null;
  sub_tasks?: SubTask[];
};

type Column = {
  id: string;
  title: string;
  order?: number;
  is_intake?: boolean;
  tasks: Task[];
};

type BoardData = {
  title: string;
  description?: string | null;
  background?: string | null;
  board_members?: BoardMember[];
  columns?: Column[];
};

type BoardAnalytics = {
  generated_at: string;
  summary: {
    columns: number;
    intake_tasks: number;
    total_tasks: number;
    open_tasks: number;
    done_tasks: number;
    completion_rate: number;
    high_priority_tasks: number;
    urgent_tasks: number;
    overdue_tasks: number;
    due_soon_tasks: number;
    unassigned_tasks: number;
    checklist_completion_rate: number;
    health_status: "NEEDS_ATTENTION" | "HIGH_PRIORITY" | "ON_TRACK";
    health_label: string;
  };
  columns: Array<{
    id: string;
    title: string;
    task_count: number;
    percent: number;
    is_done: boolean;
  }>;
  priorities: Array<{
    label: Priority;
    count: number;
    percent: number;
  }>;
  task_types: Array<{
    label: TaskType;
    count: number;
    percent: number;
  }>;
  member_workload: Array<{
    user_id: string;
    name: string;
    project_role: string;
    task_count: number;
    urgent_count: number;
    overdue_count: number;
    workload_percent: number;
  }>;
};

type CreatedColumn = Omit<Column, "tasks">;

type TaskUpdate = {
  column_id: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  priority: Priority;
  assignee_id: string | null;
  due_date: string | null;
};

const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const taskTypes: TaskType[] = ["TASK", "BUG", "STORY", "EPIC"];
const editableBoardRoles: EditableBoardRole[] = ["ADMIN", "MEMBER"];
const projectRoles = [
  "Product Manager",
  "Project Manager",
  "Scrum Master",
  "Business Analyst (BA)",
  "UI/UX Designer",
  "Frontend Developer",
  "Backend Developer",
  "Mobile Developer",
  "Fullstack Developer",
  "QA / Tester",
  "DevOps Engineer",
  "Tech Lead / Team Lead",
  "Client / Customer",
];

function normalizeTask(task: Task): Task {
  return {
    ...task,
    sub_tasks: task.sub_tasks || [],
  };
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getAttachmentHref(fileUrl: string) {
  if (fileUrl.startsWith("/uploads/")) return `${API_BASE_URL}${fileUrl}`;
  return fileUrl;
}

function getColorValue(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#f8fafc";
}

function hexToRgb(value: string) {
  const color = getColorValue(value).replace("#", "");
  return {
    r: parseInt(color.slice(0, 2), 16),
    g: parseInt(color.slice(2, 4), 16),
    b: parseInt(color.slice(4, 6), 16),
  };
}

function mixWithWhite(value: string, amount = 0.88) {
  const { r, g, b } = hexToRgb(value);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function getBoardPageBackground(value: string) {
  if (!value) return "#f1f5f9";
  return mixWithWhite(value, 0.9);
}

function getColumnTaskCount(columns: Column[]) {
  return columns.reduce((total, column) => total + column.tasks.length, 0);
}

function isDoneColumn(title: string) {
  const normalizedTitle = title.trim().toLowerCase();
  return ["done", "completed", "finished", "closed"].some((keyword) =>
    normalizedTitle.includes(keyword)
  );
}

function getPriorityClass(priority?: Priority | null) {
  if (priority === "URGENT") return "bg-red-50 text-red-700 ring-red-200";
  if (priority === "HIGH") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (priority === "LOW") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

function getTaskTypeClass(taskType?: TaskType | null) {
  if (taskType === "BUG") return "bg-red-50 text-red-700 ring-red-200";
  if (taskType === "STORY") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (taskType === "EPIC") return "bg-violet-50 text-violet-700 ring-violet-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function getDueState(dueDate?: string | null): DueFilter | "NORMAL" {
  if (!dueDate) return "NO_DUE";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntilDue < 0) return "OVERDUE";
  if (daysUntilDue <= 3) return "DUE_SOON";
  return "NORMAL";
}

function getDueClass(dueDate?: string | null) {
  const state = getDueState(dueDate);
  if (state === "OVERDUE") return "text-red-600";
  if (state === "DUE_SOON") return "text-amber-600";
  return "text-slate-500";
}

function TaskDetailModal({
  task,
  members,
  locations,
  comments,
  attachments,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  onCreateSubTask,
  onGenerateSubTasks,
  onToggleSubTask,
  onDeleteSubTask,
  onCreateComment,
  onDeleteComment,
  onCreateAttachment,
  onDeleteAttachment,
}: {
  task: Task;
  members: BoardMember[];
  locations: Column[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  onClose: () => void;
  onSave: (values: TaskUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onCreateSubTask: (title: string) => Promise<void>;
  onGenerateSubTasks: () => Promise<void>;
  onToggleSubTask: (subTask: SubTask) => Promise<void>;
  onDeleteSubTask: (subTaskId: string) => Promise<void>;
  onCreateComment: (content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onCreateAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [taskType, setTaskType] = useState<TaskType>(task.task_type || "TASK");
  const [priority, setPriority] = useState<Priority>(task.priority || "MEDIUM");
  const [columnId, setColumnId] = useState(task.column_id || "");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || "");
  const [dueDate, setDueDate] = useState(toDateInputValue(task.due_date));
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isAddingSubTask, setIsAddingSubTask] = useState(false);
  const [isGeneratingSubTasks, setIsGeneratingSubTasks] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);

  const completedCount = (task.sub_tasks || []).filter((item) => item.is_completed).length;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        column_id: columnId,
        title: title.trim(),
        description: description.trim() || null,
        task_type: taskType,
        priority,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSubTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = subTaskTitle.trim();
    if (!trimmedTitle) return;

    setIsAddingSubTask(true);
    try {
      await onCreateSubTask(trimmedTitle);
      setSubTaskTitle("");
    } finally {
      setIsAddingSubTask(false);
    }
  };

  const handleGenerateSubTasks = async () => {
    setIsGeneratingSubTasks(true);
    try {
      await onGenerateSubTasks();
    } finally {
      setIsGeneratingSubTasks(false);
    }
  };

  const handleCreateComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = commentContent.trim();
    if (!content) return;

    setIsAddingComment(true);
    try {
      await onCreateComment(content);
      setCommentContent("");
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleCreateAttachment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attachmentFile) return;

    setIsAddingAttachment(true);
    try {
      await onCreateAttachment(attachmentFile);
      setAttachmentFile(null);
    } finally {
      setIsAddingAttachment(false);
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      await onDuplicate();
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="tm-modal-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="tm-modal tm-pop-in max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-white p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Task detail
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{task.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tm-button-secondary px-3 py-1.5 text-sm font-medium text-slate-500"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="grid gap-4">
          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="tm-input w-full border px-3 py-2 text-sm outline-none"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="tm-input min-h-28 w-full border px-3 py-2 text-sm outline-none"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Location</span>
            <select
              value={columnId}
              onChange={(event) => setColumnId(event.target.value)}
              className="tm-input w-full border px-3 py-2 text-sm outline-none"
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.is_intake ? "Task Intake — waiting to be placed" : `Desk — ${location.title}`}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Type</span>
              <select
                value={taskType}
                onChange={(event) => setTaskType(event.target.value as TaskType)}
                className="tm-input w-full border px-3 py-2 text-sm outline-none"
              >
                {taskTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="tm-input w-full border px-3 py-2 text-sm outline-none"
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Assignee</span>
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="tm-input w-full border px-3 py-2 text-sm outline-none"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.users.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="tm-input w-full border px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Archiving" : "Archive"}
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDuplicating ? "Copying" : "Duplicate"}
              </button>
            </div>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="tm-button-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving" : "Save changes"}
            </button>
          </div>
        </form>

        <section className="mt-6 border-t border-slate-200 pt-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-950">Checklist</h3>
              <p className="text-xs text-slate-500">
                {completedCount}/{task.sub_tasks?.length || 0} completed
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateSubTasks}
              disabled={isGeneratingSubTasks}
              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingSubTasks ? "Generating..." : "Generate with AI"}
            </button>
          </div>

          <div className="mb-3 grid gap-2">
            {(task.sub_tasks || []).map((subTask) => (
              <div
                key={subTask.id}
                className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={Boolean(subTask.is_completed)}
                  onChange={() => onToggleSubTask(subTask)}
                  className="h-4 w-4 accent-slate-900"
                />
                <span
                  className={`min-w-0 flex-1 text-sm ${
                    subTask.is_completed ? "text-slate-400 line-through" : "text-slate-800"
                  }`}
                >
                  {subTask.title}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteSubTask(subTask.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateSubTask} className="flex gap-2">
            <input
              value={subTaskTitle}
              onChange={(event) => setSubTaskTitle(event.target.value)}
              placeholder="Add checklist item"
              className="tm-input min-w-0 flex-1 border px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={isAddingSubTask || !subTaskTitle.trim()}
              className="tm-button-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </section>

        <section className="mt-6 grid gap-5 border-t border-slate-200 pt-5 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-950">Comments</h3>
              <span className="text-sm text-slate-500">{comments.length}</span>
            </div>

            <form onSubmit={handleCreateComment} className="mb-3 grid gap-2">
              <textarea
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                placeholder="Write a comment"
                className="tm-input min-h-20 w-full border px-3 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={isAddingComment || !commentContent.trim()}
                className="tm-button-primary justify-self-end px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAddingComment ? "Posting" : "Post comment"}
              </button>
            </form>

            <div className="grid max-h-64 gap-2 overflow-y-auto">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-md border border-slate-200 px-3 py-2">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {comment.user_name || "Demo User"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatDateTime(comment.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteComment(comment.id)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">
                      {comment.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-400">
                  No comments yet
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-950">Attachments</h3>
              <span className="text-sm text-slate-500">{attachments.length}</span>
            </div>

            <form onSubmit={handleCreateAttachment} className="mb-3 grid gap-2">
              <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center transition hover:border-blue-300 hover:bg-blue-50">
                <span className="text-sm font-semibold text-slate-800">
                  {attachmentFile ? attachmentFile.name : "Choose file from computer"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {attachmentFile
                    ? `${Math.max(1, Math.round(attachmentFile.size / 1024))} KB selected`
                    : "Maximum upload size: 10 MB"}
                </span>
                <input
                  type="file"
                  onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
              <button
                type="submit"
                disabled={isAddingAttachment || !attachmentFile}
                className="tm-button-primary justify-self-end px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAddingAttachment ? "Uploading" : "Upload file"}
              </button>
            </form>

            <div className="grid max-h-64 gap-2 overflow-y-auto">
              {attachments.length > 0 ? (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <a
                        href={getAttachmentHref(attachment.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-semibold text-slate-900 hover:underline"
                      >
                        {attachment.file_name}
                      </a>
                      <p className="text-[11px] text-slate-500">
                        {attachment.users?.name || "Demo User"} / {formatDateTime(attachment.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteAttachment(attachment.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-400">
                  No attachments yet
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type BoardWorkspaceProps = {
  id: string;
  embedded?: boolean;
};

export function BoardWorkspace({
  id,
  embedded = false,
}: BoardWorkspaceProps) {
  const [boardName, setBoardName] = useState("Loading...");
  const [boardDescription, setBoardDescription] = useState("");
  const [boardBackground, setBoardBackground] = useState("");
  const [boardAnalytics, setBoardAnalytics] = useState<BoardAnalytics | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [columnTitle, setColumnTitle] = useState("");
  const [trayTaskTitle, setTrayTaskTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<BoardView>("BOARD");
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberProjectRole, setMemberProjectRole] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberRole, setEditingMemberRole] = useState<EditableBoardRole>("MEMBER");
  const [editingMemberProjectRole, setEditingMemberProjectRole] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingColumn, setIsSavingColumn] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [savingColumnId, setSavingColumnId] = useState<string | null>(null);
  const [savingTaskColumnId, setSavingTaskColumnId] = useState<string | null>(null);
  const isBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("task-manager:active-board-changed", {
        detail: { boardId: id },
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("task-manager:active-board-changed", {
          detail: { boardId: "" },
        })
      );
    };
  }, [id]);

  useEffect(() => {
    if (!isControlsOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsControlsOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isControlsOpen]);

  const selectedTask =
    columns.flatMap((column) => column.tasks).find((task) => task.id === selectedTaskId) || null;
  const intakeColumn = columns.find((column) => column.is_intake) || null;
  const deskColumns = useMemo(
    () => columns.filter((column) => !column.is_intake),
    [columns]
  );
  const currentMember = boardMembers.find((member) => member.user_id === currentUser?.id);
  const currentRole = currentMember?.role || null;
  const canManageBoard = currentRole === "OWNER" || currentRole === "ADMIN";
  const canManageMembers = canManageBoard;
  const canEditMemberRoles = currentRole === "OWNER";
  const canManageColumns = canManageBoard;

  const isFiltering =
    query.trim().length > 0 ||
    priorityFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    dueFilter !== "ALL";
  const activeFilterCount = [
    query.trim().length > 0,
    priorityFilter !== "ALL",
    assigneeFilter !== "ALL",
    dueFilter !== "ALL",
  ].filter(Boolean).length;
  const totalTasks = getColumnTaskCount(columns);
  const allTasks = useMemo(() => columns.flatMap((column) => column.tasks), [columns]);
  const doneTasks = deskColumns
    .filter((column) => isDoneColumn(column.title))
    .reduce((total, column) => total + column.tasks.length, 0);
  const openTasks = Math.max(totalTasks - doneTasks, 0);
  const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const urgentTasks = allTasks.filter((task) => task.priority === "URGENT").length;
  const highPriorityTasks = allTasks.filter(
    (task) => task.priority === "HIGH" || task.priority === "URGENT"
  ).length;
  const overdueTasks = allTasks.filter((task) => getDueState(task.due_date) === "OVERDUE").length;
  const dueSoonTasks = allTasks.filter((task) => getDueState(task.due_date) === "DUE_SOON").length;
  const unassignedTasks = allTasks.filter((task) => !task.assignee_id).length;
  const totalChecklistItems = allTasks.reduce(
    (total, task) => total + (task.sub_tasks?.length || 0),
    0
  );
  const completedChecklistItems = allTasks.reduce(
    (total, task) =>
      total + (task.sub_tasks || []).filter((subTask) => subTask.is_completed).length,
    0
  );
  const checklistRate = totalChecklistItems
    ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
    : 0;
  const memberReport = boardMembers
    .map((member) => {
      const assignedTasks = allTasks.filter((task) => task.assignee_id === member.user_id);
      return {
        id: member.user_id,
        name: member.users.name,
        projectRole: member.project_role || member.role || "MEMBER",
        count: assignedTasks.length,
        urgentCount: assignedTasks.filter((task) => task.priority === "URGENT").length,
        overdueCount: assignedTasks.filter((task) => getDueState(task.due_date) === "OVERDUE").length,
      };
    })
    .sort((a, b) => b.count - a.count);
  const priorityReport = priorities.map((priority) => ({
    label: priority,
    count: allTasks.filter((task) => task.priority === priority).length,
  }));
  const typeReport = taskTypes.map((taskType) => ({
    label: taskType,
    count: allTasks.filter((task) => (task.task_type || "TASK") === taskType).length,
  }));
  const columnReport = deskColumns.map((column) => ({
    id: column.id,
    title: column.title,
    count: column.tasks.length,
    percent: totalTasks ? Math.round((column.tasks.length / totalTasks) * 100) : 0,
  }));
  const overdueTaskList = allTasks
    .filter((task) => getDueState(task.due_date) === "OVERDUE")
    .sort(
      (a, b) =>
        new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()
    );
  const archivedTaskList = archivedTasks
    .slice()
    .sort(
      (a, b) =>
        new Date(b.archived_at || 0).getTime() - new Date(a.archived_at || 0).getTime()
    );
  const analyticsSummary = boardAnalytics?.summary;
  const displayTotalTasks = analyticsSummary?.total_tasks ?? totalTasks;
  const displayOpenTasks = analyticsSummary?.open_tasks ?? openTasks;
  const displayDoneTasks = analyticsSummary?.done_tasks ?? doneTasks;
  const displayCompletionRate = analyticsSummary?.completion_rate ?? completionRate;
  const displayChecklistRate = analyticsSummary?.checklist_completion_rate ?? checklistRate;
  const displayUrgentTasks = analyticsSummary?.urgent_tasks ?? urgentTasks;
  const displayHighPriorityTasks = analyticsSummary?.high_priority_tasks ?? highPriorityTasks;
  const displayOverdueTasks = analyticsSummary?.overdue_tasks ?? overdueTasks;
  const displayDueSoonTasks = analyticsSummary?.due_soon_tasks ?? dueSoonTasks;
  const displayUnassignedTasks = analyticsSummary?.unassigned_tasks ?? unassignedTasks;
  const displayIntakeTasks =
    analyticsSummary?.intake_tasks ?? intakeColumn?.tasks.length ?? 0;
  const displayColumnReport = boardAnalytics?.columns.map((column) => ({
    id: column.id,
    title: column.title,
    count: column.task_count,
    percent: column.percent,
  })) ?? columnReport;
  const displayPriorityReport = boardAnalytics?.priorities ?? priorityReport.map((item) => ({
    ...item,
    percent: totalTasks ? Math.round((item.count / totalTasks) * 100) : 0,
  }));
  const displayTypeReport = boardAnalytics?.task_types ?? typeReport.map((item) => ({
    ...item,
    percent: totalTasks ? Math.round((item.count / totalTasks) * 100) : 0,
  }));
  const displayMemberReport = boardAnalytics?.member_workload.map((member) => ({
    id: member.user_id,
    name: member.name,
    projectRole: member.project_role,
    count: member.task_count,
    urgentCount: member.urgent_count,
    overdueCount: member.overdue_count,
    percent: member.workload_percent,
  })) ?? memberReport.map((member) => ({
    ...member,
    percent: totalTasks ? Math.round((member.count / totalTasks) * 100) : 0,
  }));
  const boardHealth =
    displayOverdueTasks > 0
      ? { label: "Needs attention", className: "bg-red-50 text-red-700 ring-red-200" }
      : displayUrgentTasks > 0
        ? { label: "High priority", className: "bg-amber-50 text-amber-700 ring-amber-200" }
        : { label: "On track", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  const filteredColumns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => {
        const matchesQuery =
          !normalizedQuery ||
          `${task.title} ${task.description || ""}`.toLowerCase().includes(normalizedQuery);
        const matchesPriority =
          priorityFilter === "ALL" || task.priority === priorityFilter;
        const matchesAssignee =
          assigneeFilter === "ALL" ||
          (assigneeFilter === "UNASSIGNED" && !task.assignee_id) ||
          task.assignee_id === assigneeFilter;
        const dueState = getDueState(task.due_date);
        const matchesDue =
          dueFilter === "ALL" ||
          dueState === dueFilter;

        return matchesQuery && matchesPriority && matchesAssignee && matchesDue;
      }),
    }));
  }, [assigneeFilter, columns, dueFilter, priorityFilter, query]);
  const visibleColumns = filteredColumns.filter((column) => !column.is_intake);
  const visibleIntakeTasks =
    filteredColumns.find((column) => column.is_intake)?.tasks || [];

  const updateTaskInColumns = (updatedTask: Task) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) =>
          task.id === updatedTask.id ? normalizeTask(updatedTask) : task
        ),
      }))
    );
  };

  const removeTaskFromColumns = (taskId: string) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) => task.id !== taskId),
      }))
    );
  };

  const updateSubTasksInColumns = (taskId: string, subTasks: SubTask[]) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) =>
          task.id === taskId ? { ...task, sub_tasks: subTasks } : task
        ),
      }))
    );
  };

  const fetchBoardData = useCallback(async () => {
    const [boardResponse, archivedTasksResponse, meResponse, analyticsResponse] = await Promise.all([
      apiFetch(`/api/boards/${id}`),
      apiFetch(`/api/tasks/archived?board_id=${encodeURIComponent(id)}`),
      apiFetch("/api/auth/me"),
      apiFetch(`/api/analytics/boards/${id}`),
    ]);

    if (!boardResponse.ok || !archivedTasksResponse.ok || !meResponse.ok) {
      throw new Error("Load board failed");
    }

    const boardData = (await boardResponse.json()) as BoardData;
    const archivedTaskData = (await archivedTasksResponse.json()) as Task[];
    const meData = (await meResponse.json()) as { user: AuthUser };
    const analyticsData = analyticsResponse.ok
      ? ((await analyticsResponse.json()) as BoardAnalytics)
      : null;

    setBoardName(boardData.title);
    setBoardDescription(boardData.description || "");
    setBoardBackground(boardData.background || "");
    setBoardAnalytics(analyticsData);
    setBoardMembers(boardData.board_members || []);
    setArchivedTasks(archivedTaskData.map(normalizeTask));
    setCurrentUser(meData.user);
    setColumns(
      (boardData.columns || []).map((column) => ({
        ...column,
        tasks: column.tasks.map(normalizeTask),
      }))
    );
    setError("");
  }, [id]);

  useEffect(() => {
    let isActive = true;

    // Client-side board hydration after Next resolves the dynamic route params.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBoardData().catch(() => {
      if (isActive) setError("Could not load board. Check backend and try again.");
    });

    return () => {
      isActive = false;
    };
  }, [fetchBoardData]);

  useEffect(() => {
    const refreshAfterAiAction = () => {
      fetchBoardData().catch(() => {
        setError("Could not refresh board after AI action.");
      });
    };

    window.addEventListener("task-manager:ai-actions-applied", refreshAfterAiAction);

    return () => {
      window.removeEventListener("task-manager:ai-actions-applied", refreshAfterAiAction);
    };
  }, [fetchBoardData]);

  const fetchTaskExtras = useCallback(async (taskId: string) => {
    const [commentsResponse, attachmentsResponse] = await Promise.all([
      apiFetch(`/api/tasks/${taskId}/comments`),
      apiFetch(`/api/tasks/${taskId}/attachments`),
    ]);

    if (!commentsResponse.ok || !attachmentsResponse.ok) {
      throw new Error("Load task extras failed");
    }

    const comments = (await commentsResponse.json()) as TaskComment[];
    const attachments = (await attachmentsResponse.json()) as TaskAttachment[];

    setTaskComments(comments);
    setTaskAttachments(attachments);
  }, []);

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }

    let isActive = true;

    // Load task-side resources only after a card is selected.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTaskExtras(selectedTaskId).catch(() => {
      if (isActive) setError("Could not load task comments or attachments.");
    });

    return () => {
      isActive = false;
    };
  }, [fetchTaskExtras, selectedTaskId]);

  const handleCreateColumn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageColumns) {
      setError("Only admins and owners can manage columns.");
      return;
    }

    const title = columnTitle.trim();
    if (!title) return;

    setError("");
    setIsSavingColumn(true);

    try {
      const res = await apiFetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: id, title }),
      });

      if (!res.ok) throw new Error("Create column failed");

      const column = (await res.json()) as CreatedColumn;
      setColumns((currentColumns) => [...currentColumns, { ...column, tasks: [] }]);
      setColumnTitle("");
      await fetchBoardData();
    } catch {
      setError("Could not create column. Check backend and try again.");
    } finally {
      setIsSavingColumn(false);
    }
  };

  const handleRenameColumn = async (event: FormEvent<HTMLFormElement>, columnId: string) => {
    event.preventDefault();
    if (!canManageColumns) {
      setError("Only admins and owners can manage columns.");
      return;
    }

    const title = editingColumnTitle.trim();
    if (!title) return;

    setSavingColumnId(columnId);
    setError("");

    try {
      const res = await apiFetch(`/api/columns/${columnId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) throw new Error("Rename column failed");

      const updatedColumn = (await res.json()) as CreatedColumn;
      setColumns((currentColumns) =>
        currentColumns.map((column) =>
          column.id === updatedColumn.id ? { ...column, title: updatedColumn.title } : column
        )
      );
      setEditingColumnId(null);
      setEditingColumnTitle("");
      await fetchBoardData();
    } catch {
      setError("Could not rename column. Try again.");
    } finally {
      setSavingColumnId(null);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!canManageColumns) {
      setError("Only admins and owners can manage columns.");
      return;
    }

    setDeletingColumnId(columnId);
    setError("");

    try {
      const res = await apiFetch(`/api/columns/${columnId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete column failed");

      setColumns((currentColumns) => currentColumns.filter((column) => column.id !== columnId));
      await fetchBoardData();
    } catch {
      setError("Could not delete column. Try again.");
    } finally {
      setDeletingColumnId(null);
    }
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) {
      setError("Only admins and owners can manage members.");
      return;
    }

    const trimmedName = memberName.trim();
    if (!trimmedName || !memberProjectRole) return;

    setIsAddingMember(true);
    setError("");

    try {
      const res = await apiFetch(`/api/boards/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_name: trimmedName,
          project_role: memberProjectRole,
        }),
      });

      if (!res.ok) throw new Error("Add member failed");

      setMemberName("");
      setMemberProjectRole("");
      await fetchBoardData();
    } catch {
      setError("Could not add member. Try again.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const openEditMember = (member: BoardMember) => {
    if (!canEditMemberRoles || member.role === "OWNER") return;

    setEditingMemberId(member.user_id);
    setEditingMemberRole(member.role === "ADMIN" ? "ADMIN" : "MEMBER");
    setEditingMemberProjectRole(member.project_role || "");
    setError("");
  };

  const closeEditMember = () => {
    setEditingMemberId(null);
    setEditingMemberRole("MEMBER");
    setEditingMemberProjectRole("");
  };

  const handleSaveMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMemberId || !canEditMemberRoles) return;

    setIsSavingMember(true);
    setError("");

    try {
      const res = await apiFetch(`/api/boards/${id}/members/${editingMemberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editingMemberRole,
          project_role: editingMemberProjectRole.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Update member failed");

      await fetchBoardData();
      closeEditMember();
    } catch {
      setError("Could not update member. Only owners can change member roles.");
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!canManageMembers) {
      setError("Only admins and owners can manage members.");
      return;
    }

    setRemovingMemberId(userId);
    setError("");

    try {
      const res = await apiFetch(`/api/boards/${id}/members/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Remove member failed");

      await fetchBoardData();
    } catch {
      setError("Could not remove member. Owners cannot be removed.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const openSettings = () => {
    if (!canManageBoard) {
      setError("Only admins and owners can change board settings.");
      return;
    }

    setSettingsTitle(boardName);
    setSettingsDescription(boardDescription);
    setIsControlsOpen(false);
    setIsSettingsOpen(true);
    setError("");
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageBoard) {
      setError("Only admins and owners can change board settings.");
      return;
    }

    if (!settingsTitle.trim()) return;

    setIsSavingSettings(true);
    setError("");

    try {
      const res = await apiFetch(`/api/boards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: settingsTitle.trim(),
          description: settingsDescription.trim() || null,
          background: boardBackground || null,
        }),
      });

      if (!res.ok) throw new Error("Update board failed");

      setIsSettingsOpen(false);
      await fetchBoardData();
    } catch {
      setError("Could not save board settings. Try again.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateTrayTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = trayTaskTitle.trim();
    if (!title) return;

    setError("");

    try {
      const response = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: id,
          column_id: intakeColumn?.id,
          title,
          task_type: "TASK",
          priority: "MEDIUM",
        }),
      });

      if (!response.ok) {
        throw new Error("Create intake task failed");
      }

      setTrayTaskTitle("");
      await fetchBoardData();
    } catch {
      setError("Could not capture this task in Intake. Check the database migration and try again.");
    }
  };

  const handleSaveTask = async (values: TaskUpdate) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      setError("Could not save task. Try again.");
      return;
    }

    const updatedTask = normalizeTask((await res.json()) as Task);
    updateTaskInColumns(updatedTask);
    setError("");
    await fetchBoardData();
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not archive task. Try again.");
      return;
    }

    removeTaskFromColumns(selectedTask.id);
    setSelectedTaskId(null);
    setError("");
    await fetchBoardData();
  };

  const handleRestoreTask = async (taskId: string) => {
    setError("");

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/restore`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Restore task failed");

      await fetchBoardData();
    } catch {
      setError("Could not restore task. Try again.");
    }
  };

  const handleDuplicateTask = async () => {
    if (!selectedTask) return;

    const column = columns.find((item) => item.tasks.some((task) => task.id === selectedTask.id));
    if (!column) return;

    const res = await apiFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column_id: column.id,
        title: `${selectedTask.title} Copy`,
        description: selectedTask.description || null,
        task_type: selectedTask.task_type || "TASK",
        priority: selectedTask.priority || "MEDIUM",
        assignee_id: selectedTask.assignee_id || null,
        due_date: selectedTask.due_date || null,
      }),
    });

    if (!res.ok) {
      setError("Could not duplicate task. Try again.");
      return;
    }

    const duplicatedTask = normalizeTask((await res.json()) as Task);
    setColumns((currentColumns) =>
      currentColumns.map((item) =>
        item.id === column.id ? { ...item, tasks: [...item.tasks, duplicatedTask] } : item
      )
    );
    setError("");
    await fetchBoardData();
  };

  const handleCreateSubTask = async (title: string) => {
    if (!selectedTask) return;

    const res = await apiFetch("/api/subtasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: selectedTask.id, title }),
    });

    if (!res.ok) {
      setError("Could not create checklist item. Try again.");
      return;
    }

    const subTask = (await res.json()) as SubTask;
    updateSubTasksInColumns(selectedTask.id, [...(selectedTask.sub_tasks || []), subTask]);
    setError("");
    await fetchBoardData();
  };

  const handleGenerateSubTasks = async () => {
    if (!selectedTask) return;

    setError("");

    const res = await apiFetch(`/api/ai/tasks/${selectedTask.id}/subtasks`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Could not generate checklist items with AI. Try again.");
      return;
    }

    const generatedSubTasks = (await res.json()) as SubTask[];

    updateSubTasksInColumns(selectedTask.id, [
      ...(selectedTask.sub_tasks || []),
      ...generatedSubTasks,
    ]);
    setError("");
    await fetchBoardData();
  };

  const handleToggleSubTask = async (subTask: SubTask) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/subtasks/${subTask.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: !subTask.is_completed }),
    });

    if (!res.ok) {
      setError("Could not update checklist. Try again.");
      return;
    }

    const updatedSubTask = (await res.json()) as SubTask;
    updateSubTasksInColumns(
      selectedTask.id,
      (selectedTask.sub_tasks || []).map((item) =>
        item.id === updatedSubTask.id ? updatedSubTask : item
      )
    );
    setError("");
    await fetchBoardData();
  };

  const handleDeleteSubTask = async (subTaskId: string) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/subtasks/${subTaskId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not delete checklist item. Try again.");
      return;
    }

    updateSubTasksInColumns(
      selectedTask.id,
      (selectedTask.sub_tasks || []).filter((item) => item.id !== subTaskId)
    );
    setError("");
    await fetchBoardData();
  };

  const handleCreateComment = async (content: string) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      setError("Could not post comment. Try again.");
      return;
    }

    await fetchTaskExtras(selectedTask.id);
    await fetchBoardData();
    setError("");
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}/comments/${commentId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not delete comment. Try again.");
      return;
    }

    await fetchTaskExtras(selectedTask.id);
    await fetchBoardData();
    setError("");
  };

  const handleCreateAttachment = async (file: File) => {
    if (!selectedTask) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch(`/api/tasks/${selectedTask.id}/attachments`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setError("Could not add attachment. Try again.");
      return;
    }

    await fetchTaskExtras(selectedTask.id);
    await fetchBoardData();
    setError("");
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}/attachments/${attachmentId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not delete attachment. Try again.");
      return;
    }

    await fetchTaskExtras(selectedTask.id);
    await fetchBoardData();
    setError("");
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (isFiltering) {
      setError("Clear search/filter before reordering tasks.");
      return;
    }

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === "COLUMN") {
      if (!canManageColumns) {
        setError("Only admins and owners can reorder columns.");
        return;
      }

      const newColumns = Array.from(deskColumns);
      const [movedColumn] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, movedColumn);
      setColumns(intakeColumn ? [intakeColumn, ...newColumns] : newColumns);

      let newOrder = 1000;
      if (newColumns.length > 1) {
        if (destination.index === 0) {
          newOrder = (newColumns[1].order || 1000) / 2;
        } else if (destination.index === newColumns.length - 1) {
          newOrder = (newColumns[newColumns.length - 2].order || 1000) + 1000;
        } else {
          newOrder =
            ((newColumns[destination.index - 1].order || 1000) +
              (newColumns[destination.index + 1].order || 1000)) /
            2;
        }
      }

      try {
        const res = await apiFetch(`/api/columns/${draggableId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: newOrder }),
        });

        if (!res.ok) throw new Error("Move column failed");
        await fetchBoardData();
      } catch {
        setError("Could not save column position. Try again.");
      }

      return;
    }

    const sourceColumnId =
      source.droppableId === "task-tray" ? intakeColumn?.id : source.droppableId;
    const destinationColumnId =
      destination.droppableId === "task-tray"
        ? intakeColumn?.id
        : destination.droppableId;

    if (!sourceColumnId || !destinationColumnId) {
      setError("Task Intake is not ready. Apply the database migration first.");
      return;
    }

    const sourceColIndex = columns.findIndex((column) => column.id === sourceColumnId);
    const destColIndex = columns.findIndex((column) => column.id === destinationColumnId);

    if (sourceColIndex === -1 || destColIndex === -1) return;

    const sourceCol = columns[sourceColIndex];
    const destCol = columns[destColIndex];
    const newColumns = [...columns];
    let destTasks: Task[] = Array.from(destCol.tasks);

    if (sourceCol.id === destCol.id) {
      const newTasks: Task[] = Array.from(sourceCol.tasks);
      const [movedTask] = newTasks.splice(source.index, 1);
      newTasks.splice(destination.index, 0, movedTask);
      newColumns[sourceColIndex] = { ...sourceCol, tasks: newTasks };
      destTasks = newTasks;
    } else {
      const sourceTasks: Task[] = Array.from(sourceCol.tasks);
      const [movedTask] = sourceTasks.splice(source.index, 1);
      destTasks.splice(destination.index, 0, {
        ...movedTask,
        column_id: destinationColumnId,
      });
      newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
      newColumns[destColIndex] = { ...destCol, tasks: destTasks };
    }

    setColumns(newColumns);

    let newOrder = 1000;
    if (destTasks.length > 1) {
      if (destination.index === 0) {
        newOrder = destTasks[1].order / 2;
      } else if (destination.index === destTasks.length - 1) {
        newOrder = destTasks[destTasks.length - 2].order + 1000;
      } else {
        newOrder =
          (destTasks[destination.index - 1].order +
            destTasks[destination.index + 1].order) /
          2;
      }
    }

    try {
      setSavingTaskColumnId(destinationColumnId);
      setError("");
      const res = await apiFetch(`/api/tasks/${draggableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          column_id: destinationColumnId,
          order: newOrder,
        }),
      });

      if (!res.ok) throw new Error("Move task failed");
      await fetchBoardData();
    } catch {
      setError("Could not save task position. Try again.");
      await fetchBoardData();
    } finally {
      setSavingTaskColumnId(null);
    }
  };

  const pageBackground = embedded ? "transparent" : getBoardPageBackground(boardBackground);
  const inputClass = "tm-input h-9 border px-3 text-sm text-slate-900 outline-none";
  const smallInputClass = "tm-input min-w-0 flex-1 border px-2 py-1.5 text-sm text-slate-900 outline-none";
  const innerCardClass = "rounded-md border border-slate-200 bg-white/80 px-3 py-2";
  const columnClass = "tm-work-desk flex max-h-[620px] min-w-[360px] flex-col border";
  const taskCardClass = "tm-desk-task border p-3";
  const addColumnClass = "tm-add-desk min-w-[300px] self-start border p-4";
  const reportPanelClass = "tm-panel p-4";
  const summaryCards = [
    {
      label: "Waiting in Intake",
      value: displayIntakeTasks,
      detail: "Ready to be placed",
      tone: displayIntakeTasks > 0 ? "text-blue-700" : "text-slate-900",
    },
    {
      label: "Open tasks",
      value: displayOpenTasks,
      detail: `${displayDoneTasks} done`,
    },
    {
      label: "Completion",
      value: `${displayCompletionRate}%`,
      detail: `${displayChecklistRate}% checklist progress`,
    },
    {
      label: "Due risk",
      value: displayOverdueTasks,
      detail: `${displayDueSoonTasks} due soon`,
      tone: displayOverdueTasks > 0 ? "text-red-600" : "text-slate-900",
    },
    {
      label: "Priority load",
      value: displayHighPriorityTasks,
      detail: `${displayUrgentTasks} urgent / ${displayUnassignedTasks} unassigned`,
      tone: displayUrgentTasks > 0 ? "text-amber-600" : "text-slate-900",
    },
  ];

  if (!isBrowser) return null;

  return (
    <div
      className={`${embedded ? "embedded-board-light min-h-full" : "tm-shell min-h-screen"} text-slate-900`}
      style={{ backgroundColor: pageBackground }}
    >
      {isControlsOpen && (
        <button
          type="button"
          aria-label="Close workspace controls"
          onClick={() => setIsControlsOpen(false)}
          className="fixed inset-0 z-[130] cursor-default bg-slate-950/20 backdrop-blur-[1px]"
        />
      )}

      <button
        type="button"
        onClick={() => setIsControlsOpen((current) => !current)}
        className="tm-controls-trigger fixed right-0 top-1/2 z-[145] flex -translate-y-1/2 flex-col items-center justify-center border border-r-0 border-blue-300 bg-white px-2 py-4 text-blue-700 shadow-lg"
        aria-label={isControlsOpen ? "Close workspace controls" : "Open workspace controls"}
        title="Workspace controls"
      >
        <span className="text-lg font-black">{isControlsOpen ? ">" : "<"}</span>
        {activeFilterCount > 0 && (
          <span className="mt-2 flex h-5 min-w-5 items-center justify-center bg-blue-600 px-1 text-[10px] font-black text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      <aside
        className={`tm-workspace-controls fixed right-0 top-0 z-[140] h-screen w-[min(460px,calc(100vw-24px))] overflow-y-auto border-l border-blue-200 bg-slate-50 p-5 shadow-2xl transition-transform duration-200 ${
          isControlsOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isControlsOpen}
        inert={!isControlsOpen}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 border-b border-blue-200 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                Workspace controls
              </p>
              <h1 className={`text-xl font-bold ${embedded ? "text-slate-900" : "text-slate-950"}`}>{boardName}</h1>
              {boardDescription && (
                <p className={`mt-0.5 max-w-2xl text-xs ${embedded ? "text-slate-600" : "text-slate-600"}`}>{boardDescription}</p>
              )}
              <p className={`mt-0.5 text-xs ${embedded ? "text-slate-500" : "text-slate-500"}`}>
                {deskColumns.length} desks / {displayTotalTasks} tasks / {intakeColumn?.tasks.length || 0} waiting
              </p>
              <div className={`mt-1 inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-xs font-semibold ${
                embedded
                  ? "border border-slate-200 bg-slate-50 text-slate-600"
                  : "border border-slate-200 bg-slate-50 text-slate-600"
              }`}>
                Your role
                <span className={`rounded px-2 py-0.5 ${embedded ? "bg-white text-slate-900" : "bg-white text-slate-900"}`}>
                  {currentRole || "Loading"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsControlsOpen(false)}
              className="tm-button-secondary border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600"
            >
              Close
            </button>
          </div>

          <section className="grid gap-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Find work
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks"
                className={`${inputClass} sm:col-span-2`}
              />
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                className={inputClass}
              >
                <option value="ALL">All priorities</option>
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
                className={inputClass}
              >
                <option value="ALL">All assignees</option>
                <option value="UNASSIGNED">Unassigned</option>
                {boardMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.users.name}
                  </option>
                ))}
              </select>
              <select
                value={dueFilter}
                onChange={(event) => setDueFilter(event.target.value as DueFilter)}
                className={inputClass}
              >
                <option value="ALL">All due dates</option>
                <option value="OVERDUE">Overdue</option>
                <option value="DUE_SOON">Due soon</option>
                <option value="NO_DUE">No due date</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPriorityFilter("ALL");
                  setAssigneeFilter("ALL");
                  setDueFilter("ALL");
                }}
                disabled={!isFiltering}
                className={`${inputClass} bg-white font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2`}
              >
                Clear filters
              </button>
              {canManageBoard && (
                <button
                  type="button"
                  onClick={openSettings}
                  className="tm-button-primary h-9 px-3 text-sm font-semibold text-white sm:col-span-2"
                >
                  Workspace settings
                </button>
              )}
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              {error}
            </div>
          )}

          <div className="flex gap-2 border-b border-slate-200 pt-1">
            {[
              { key: "BOARD", label: "Desks" },
              { key: "REPORTS", label: "Reports" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveView(item.key as BoardView);
                  setIsControlsOpen(false);
                }}
                className={`border-b-2 px-1 pb-2 text-sm font-semibold transition ${
                  activeView === item.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <section className="tm-panel p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Summary</h2>
              <span className={`w-fit rounded px-2 py-0.5 text-xs font-bold ring-1 ${boardHealth.className}`}>
                {boardHealth.label}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-500">{card.label}</p>
                    <p className="truncate text-xs text-slate-500">{card.detail}</p>
                  </div>
                  <p className={`shrink-0 text-lg font-bold ${card.tone || "text-slate-900"}`}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-1">
            <section className="tm-panel p-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h2 className={`text-xs font-bold uppercase tracking-wide ${embedded ? "text-slate-500" : "text-slate-500"}`}>Team</h2>
                  <p className={`text-xs ${embedded ? "text-slate-500" : "text-slate-500"}`}>{boardMembers.length} members</p>
                </div>
              </div>

              <div className="mb-2 flex flex-wrap gap-2">
                {boardMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className={`flex items-center gap-2 ${innerCardClass.replace("px-3 py-2", "px-2 py-1.5")}`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      {getInitials(member.users.name)}
                    </div>
                    <div className="min-w-0">
                      <p className={`max-w-32 truncate text-xs font-semibold ${embedded ? "text-slate-900" : "text-slate-900"}`}>
                        {member.users.name}
                      </p>
                      <p className={`text-[10px] font-medium ${embedded ? "text-slate-500" : "text-slate-500"}`}>
                        {member.project_role || member.role}
                      </p>
                      {member.project_role && (
                        <p className="text-[10px] font-semibold text-slate-400">
                          {member.role}
                        </p>
                      )}
                    </div>
                    {member.role !== "OWNER" && (
                      <div className="ml-auto flex gap-1">
                        {canEditMemberRoles && (
                          <button
                            type="button"
                            onClick={() => openEditMember(member)}
                            className="rounded px-1.5 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                        )}
                        {canManageMembers && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.user_id)}
                            disabled={removingMemberId === member.user_id}
                            className="rounded px-1.5 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {editingMemberId && (
                <form
                  onSubmit={handleSaveMember}
                  className="mb-2 grid gap-2 rounded-md border border-blue-200 bg-blue-50 p-2"
                >
                  <select
                    value={editingMemberRole}
                    onChange={(event) => setEditingMemberRole(event.target.value as EditableBoardRole)}
                    className={`${inputClass} h-9 px-2`}
                  >
                    {editableBoardRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editingMemberProjectRole}
                    onChange={(event) => setEditingMemberProjectRole(event.target.value)}
                    className={`${inputClass} h-9 px-2`}
                  >
                    <option value="">No project role</option>
                    {projectRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={closeEditMember}
                    className="h-9 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMember}
                    className="tm-button-primary h-9 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingMember ? "Saving" : "Save"}
                  </button>
                </form>
              )}

              {canManageMembers ? (
                <form onSubmit={handleAddMember} className="grid gap-2">
                  <input
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    placeholder="Member name"
                    className={`${inputClass} h-9 min-w-0 px-2`}
                  />
                  <select
                    value={memberProjectRole}
                    onChange={(event) => setMemberProjectRole(event.target.value)}
                    className={`${inputClass} h-9 px-2`}
                  >
                    <option value="">Select project role</option>
                    {projectRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={isAddingMember || !memberName.trim() || !memberProjectRole}
                    className="tm-button-primary h-9 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500">
                  Members can view the team, but only admins and owners can manage it.
                </div>
              )}
            </section>
          </div>
        </div>
      </aside>

      {!isControlsOpen && error && (
        <button
          type="button"
          onClick={() => setError("")}
          className="fixed right-14 top-20 z-[125] max-w-sm border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-900 shadow-lg"
          title="Dismiss"
        >
          {error}
        </button>
      )}

      {activeView === "BOARD" ? (
      <DragDropContext onDragEnd={onDragEnd}>
        <main className={`tm-desk-board-canvas ${embedded ? "w-full" : "mx-auto max-w-7xl"} px-4 py-5 sm:px-6`}>
          <div className="tm-desk-workspace-layout grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="tm-task-tray-panel flex min-h-[560px] flex-col border">
              <div className="border-b border-blue-200 bg-slate-950 px-4 py-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">
                      Task intake
                    </p>
                    <h2 className="mt-1 text-lg font-black tracking-tight">Task tray</h2>
                  </div>
                  <span className="border border-white/20 px-2 py-1 text-xs font-bold">
                    {intakeColumn?.tasks.length || 0}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Capture work, edit the details, then place it on the right desk.
                </p>
              </div>

              <form onSubmit={handleCreateTrayTask} className="border-b border-blue-200 bg-white p-3">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Capture new work
                </label>
                <textarea
                  value={trayTaskTitle}
                  onChange={(event) => setTrayTaskTitle(event.target.value)}
                  placeholder="What needs to be done?"
                  rows={3}
                  className="tm-input mt-2 w-full resize-none border px-3 py-2 text-sm text-slate-900 outline-none"
                />
                <button
                  type="submit"
                  disabled={!trayTaskTitle.trim() || !intakeColumn}
                  className="tm-button-primary mt-2 w-full px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add to tray
                </button>
              </form>

              <Droppable droppableId="task-tray" type="TASK">
                {(trayProvided, traySnapshot) => (
                  <div
                    ref={trayProvided.innerRef}
                    {...trayProvided.droppableProps}
                    className={`tm-tray-dropzone flex min-h-56 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 ${
                      traySnapshot.isDraggingOver ? "bg-blue-100/70" : ""
                    }`}
                  >
                    {visibleIntakeTasks.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                        isDragDisabled={isFiltering}
                      >
                        {(taskProvided, taskSnapshot) => (
                          <article
                            ref={taskProvided.innerRef}
                            {...taskProvided.draggableProps}
                            onClick={() => {
                              setTaskComments([]);
                              setTaskAttachments([]);
                              setSelectedTaskId(task.id);
                            }}
                            className={`tm-tray-draft border p-3 ${
                              taskSnapshot.isDragging ? "shadow-xl ring-2 ring-blue-400" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-1 h-2 w-2 shrink-0 bg-lime-400" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold leading-5 text-slate-900">
                                  {task.title}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 text-[9px] font-black ring-1 ${getTaskTypeClass(task.task_type)}`}>
                                    {task.task_type || "TASK"}
                                  </span>
                                  <span className={`px-1.5 py-0.5 text-[9px] font-black ring-1 ${getPriorityClass(task.priority)}`}>
                                    {task.priority || "MEDIUM"}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                {...taskProvided.dragHandleProps}
                                onClick={(event) => event.stopPropagation()}
                                className="tm-task-drag-handle border border-blue-200 px-1.5 py-1 text-[10px] font-black text-blue-600 hover:bg-blue-50"
                                aria-label={`Drag ${task.title}`}
                              >
                                ::
                              </button>
                            </div>
                            <p className="mt-3 text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">
                              Click to edit / drag handle to place
                            </p>
                          </article>
                        )}
                      </Draggable>
                    ))}
                    {visibleIntakeTasks.length === 0 && (
                      <div className="flex flex-1 items-center justify-center border border-dashed border-blue-200 bg-white/70 p-6 text-center">
                        <div>
                          <p className="text-sm font-bold text-slate-700">
                            {isFiltering ? "No matching intake tasks" : "Tray is clear"}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Capture work here before placing it on a desk.
                          </p>
                        </div>
                      </div>
                    )}
                    {trayProvided.placeholder}
                  </div>
                )}
              </Droppable>

              <div className="border-t border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-slate-500">
                Intake tasks are saved and editable before they reach a desk.
              </div>
            </aside>

            <section className="min-w-0">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                    Workspace floor
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                    Project desks
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Each desk is a workflow area. Drag cards between desks to move the work.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  <span className="h-2 w-2 bg-lime-400" />
                  Ready for work
                </div>
              </div>

              <div className="overflow-x-auto pb-8">
          <Droppable droppableId="board-columns" direction="horizontal" type="COLUMN">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-4">
                {visibleColumns.map((column, columnIndex) => (
                  <Draggable
                    key={column.id}
                    draggableId={column.id}
                    index={columnIndex}
                    isDragDisabled={!canManageColumns || isFiltering}
                  >
                    {(columnProvided, columnSnapshot) => (
                      <section
                        ref={columnProvided.innerRef}
                        {...columnProvided.draggableProps}
                        className={`${columnClass} ${
                          columnSnapshot.isDragging ? "shadow-lg ring-2 ring-blue-200" : ""
                        }`}
                      >
                        <div className="tm-desk-header border-b border-blue-200 px-4 py-3" {...columnProvided.dragHandleProps}>
                          {editingColumnId === column.id ? (
                            <form onSubmit={(event) => handleRenameColumn(event, column.id)} className="flex gap-2">
                              <input
                                value={editingColumnTitle}
                                onChange={(event) => setEditingColumnTitle(event.target.value)}
                                className={smallInputClass}
                                autoFocus
                              />
                              <button
                                type="submit"
                                disabled={savingColumnId === column.id || !editingColumnTitle.trim()}
                                className="tm-button-primary px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                Save
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                                  Desk {String(columnIndex + 1).padStart(2, "0")}
                                </p>
                                <h2 className="mt-1 truncate text-sm font-black uppercase tracking-wide text-slate-800">
                                  {column.title}
                                </h2>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {column.tasks.length} visible /{" "}
                                  {columns.find((item) => item.id === column.id)?.tasks.length || 0} cards
                                </p>
                              </div>
                              {canManageColumns && (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingColumnId(column.id);
                                      setEditingColumnTitle(column.title);
                                    }}
                                    className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteColumn(column.id)}
                                    disabled={deletingColumnId === column.id}
                                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <Droppable droppableId={column.id} type="TASK">
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="tm-desk-surface flex min-h-64 flex-1 flex-col gap-3 overflow-y-auto p-4"
                            >
                              {column.tasks.map((task, index) => (
                                <Draggable
                                  key={task.id}
                                  draggableId={task.id}
                                  index={index}
                                  isDragDisabled={isFiltering}
                                >
                                  {(provided, snapshot) => (
                                    <article
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      onClick={() => {
                                        setTaskComments([]);
                                        setTaskAttachments([]);
                                        setSelectedTaskId(task.id);
                                      }}
                                      className={`${taskCardClass} ${
                                        snapshot.isDragging
                                          ? "shadow-lg ring-2 ring-blue-200"
                                          : ""
                                      }`}
                                    >
                                      <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">
                                          Work card
                                        </span>
                                        <button
                                          type="button"
                                          {...provided.dragHandleProps}
                                          onClick={(event) => event.stopPropagation()}
                                          className="tm-task-drag-handle border border-blue-200 px-1.5 py-1 text-[10px] font-black text-blue-600 hover:bg-blue-50"
                                          aria-label={`Drag ${task.title}`}
                                        >
                                          ::
                                        </button>
                                      </div>
                                      <p className={`text-sm font-medium leading-5 ${embedded ? "text-slate-900" : "text-slate-900"}`}>{task.title}</p>
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${getTaskTypeClass(
                                            task.task_type
                                          )}`}
                                        >
                                          {task.task_type || "TASK"}
                                        </span>
                                        <span
                                          className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${getPriorityClass(
                                            task.priority
                                          )}`}
                                        >
                                          {task.priority || "MEDIUM"}
                                        </span>
                                        {task.users && (
                                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[8px] font-bold text-white">
                                              {getInitials(task.users.name)}
                                            </span>
                                            {task.users.name}
                                          </span>
                                        )}
                                        {task.due_date && (
                                          <span className={`text-[11px] font-medium ${getDueClass(task.due_date)}`}>
                                            Due {toDateInputValue(task.due_date)}
                                          </span>
                                        )}
                                        {Boolean(task.sub_tasks?.length) && (
                                          <span className="text-[11px] font-medium text-slate-500">
                                            {(task.sub_tasks || []).filter((item) => item.is_completed).length}/
                                            {task.sub_tasks?.length}
                                          </span>
                                        )}
                                      </div>
                                    </article>
                                  )}
                                </Draggable>
                              ))}
                              {column.tasks.length === 0 && (
                                <div className={`tm-desk-empty flex min-h-32 items-center justify-center border border-dashed px-3 py-5 text-center text-sm ${
                                  embedded
                                    ? "border-blue-200 bg-white/70 text-slate-500"
                                    : "border-blue-200 bg-white/70 text-slate-400"
                                }`}>
                                  {isFiltering ? "No matching cards" : "Drop a task card on this desk"}
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        <div className="tm-desk-footer flex items-center justify-between border-t border-blue-200 px-4 py-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                            Drop zone / {column.title}
                          </span>
                          <span className="text-[10px] font-bold text-blue-600">
                            {savingTaskColumnId === column.id ? "Placing card..." : "Ready"}
                          </span>
                        </div>
                      </section>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}

                {canManageColumns && (
                  <form
                    onSubmit={handleCreateColumn}
                    className={addColumnClass}
                  >
                    <input
                      value={columnTitle}
                      onChange={(event) => setColumnTitle(event.target.value)}
                      placeholder="New desk name"
                      className={`mb-3 w-full ${inputClass}`}
                    />
                    <button
                      type="submit"
                      disabled={isSavingColumn || !columnTitle.trim()}
                      className="tm-button-primary w-full px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingColumn ? "Creating" : "Add desk"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </Droppable>
              </div>
            </section>
          </div>
        </main>
      </DragDropContext>
      ) : (
        <main className={`${embedded ? "w-full" : "mx-auto max-w-7xl"} px-6 py-4`}>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <section className={reportPanelClass}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Work overview</h2>
                  <p className="text-sm text-slate-500">
                    Distribution by column and current completion status.
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-bold ring-1 ${boardHealth.className}`}>
                  {boardHealth.label}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className={innerCardClass}>
                  <p className="text-xs font-medium text-slate-500">Waiting in Intake</p>
                  <p className="mt-2 text-2xl font-bold text-blue-700">{displayIntakeTasks}</p>
                  <p className="mt-1 text-xs text-slate-500">Not placed on a desk yet</p>
                </div>
                <div className={innerCardClass}>
                  <p className="text-xs font-medium text-slate-500">Total tasks</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{displayTotalTasks}</p>
                  <p className="mt-1 text-xs text-slate-500">{displayOpenTasks} open / {displayDoneTasks} done</p>
                </div>
                <div className={innerCardClass}>
                  <p className="text-xs font-medium text-slate-500">Completion</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{displayCompletionRate}%</p>
                  <p className="mt-1 text-xs text-slate-500">{displayChecklistRate}% checklist progress</p>
                </div>
                <div className={innerCardClass}>
                  <p className="text-xs font-medium text-slate-500">Risk</p>
                  <p className={`mt-2 text-2xl font-bold ${displayOverdueTasks > 0 ? "text-red-600" : "text-slate-900"}`}>
                    {displayOverdueTasks}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{displayDueSoonTasks} due soon</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {displayColumnReport.map((column) => (
                  <div key={column.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold uppercase tracking-wide text-slate-600">
                        {column.title}
                      </span>
                      <span className="text-slate-500">
                        {column.count} tasks / {column.percent}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${column.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={reportPanelClass}>
              <h2 className="text-base font-bold text-slate-900">Member workload</h2>
              <p className="mb-4 text-sm text-slate-500">
                Assigned work and risk by member.
              </p>
              <div className="grid gap-2">
                {displayMemberReport.length > 0 ? (
                  displayMemberReport.map((member) => {
                    return (
                      <div key={member.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
                            <p className="truncate text-xs text-slate-500">{member.projectRole}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-slate-900">{member.count}</p>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-slate-700" style={{ width: `${member.percent}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {member.urgentCount} urgent / {member.overdueCount} overdue
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                    No members yet
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className={reportPanelClass}>
              <h2 className="text-base font-bold text-slate-900">Priority breakdown</h2>
              <div className="mt-4 grid gap-3">
                {displayPriorityReport.map((item) => {
                  return (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className={`rounded px-2 py-0.5 font-bold ring-1 ${getPriorityClass(item.label)}`}>
                          {item.label}
                        </span>
                        <span className="text-slate-500">{item.count} tasks</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-slate-700" style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={reportPanelClass}>
              <h2 className="text-base font-bold text-slate-900">Type breakdown</h2>
              <div className="mt-4 grid gap-3">
                {displayTypeReport.map((item) => {
                  return (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className={`rounded px-2 py-0.5 font-bold ring-1 ${getTaskTypeClass(item.label)}`}>
                          {item.label}
                        </span>
                        <span className="text-slate-500">{item.count} tasks</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className={`${reportPanelClass} mt-4`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Overdue tasks</h2>
                <p className="text-sm text-slate-500">Tasks past their due date.</p>
              </div>
              <span className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
                {overdueTaskList.length}
              </span>
            </div>

            {overdueTaskList.length > 0 ? (
              <div className="grid gap-2">
                {overdueTaskList.slice(0, 8).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setTaskComments([]);
                      setTaskAttachments([]);
                      setSelectedTaskId(task.id);
                    }}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-white"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{task.title}</span>
                      <span className="mt-1 flex flex-wrap gap-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${getTaskTypeClass(task.task_type)}`}>
                          {task.task_type || "TASK"}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${getPriorityClass(task.priority)}`}>
                          {task.priority || "MEDIUM"}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-red-600">
                      Due {toDateInputValue(task.due_date)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                No overdue tasks
              </div>
            )}
          </section>

          <section className={`${reportPanelClass} mt-4`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Archived tasks</h2>
                <p className="text-sm text-slate-500">Restore archived work items back to the board.</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                {archivedTaskList.length}
              </span>
            </div>

            {archivedTaskList.length > 0 ? (
              <div className="grid gap-2">
                {archivedTaskList.slice(0, 8).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{task.title}</span>
                      <span className="mt-1 flex flex-wrap gap-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${getTaskTypeClass(task.task_type)}`}>
                          {task.task_type || "TASK"}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${getPriorityClass(task.priority)}`}>
                          {task.priority || "MEDIUM"}
                        </span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRestoreTask(task.id)}
                      className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                No archived tasks
              </div>
            )}
          </section>
        </main>
      )}

      {isSettingsOpen && (
        <div className="tm-modal-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSettings}
            className="tm-modal tm-pop-in w-full max-w-lg bg-white p-5"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Workspace settings
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Workspace details</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="tm-button-secondary px-3 py-1.5 text-sm font-medium text-slate-500"
              >
                Close
              </button>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Board name</span>
              <input
                value={settingsTitle}
                onChange={(event) => setSettingsTitle(event.target.value)}
                className="tm-input w-full border px-3 py-2 text-sm outline-none"
                autoFocus
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={settingsDescription}
                onChange={(event) => setSettingsDescription(event.target.value)}
                className="tm-input min-h-24 w-full border px-3 py-2 text-sm outline-none"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="tm-button-secondary px-4 py-2 text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSettings || !settingsTitle.trim()}
                className="tm-button-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingSettings ? "Saving" : "Save settings"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          key={selectedTask.id}
          task={selectedTask}
          members={boardMembers}
          locations={columns}
          comments={taskComments}
          attachments={taskAttachments}
          onClose={() => {
            setSelectedTaskId(null);
            setTaskComments([]);
            setTaskAttachments([]);
          }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onDuplicate={handleDuplicateTask}
          onCreateSubTask={handleCreateSubTask}
          onGenerateSubTasks={handleGenerateSubTasks}
          onToggleSubTask={handleToggleSubTask}
          onDeleteSubTask={handleDeleteSubTask}
          onCreateComment={handleCreateComment}
          onDeleteComment={handleDeleteComment}
          onCreateAttachment={handleCreateAttachment}
          onDeleteAttachment={handleDeleteAttachment}
        />
      )}
    </div>
  );
}

export default function BoardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <BoardWorkspace id={id} />;
}
