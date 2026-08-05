"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, apiFetch, notifyAuthChanged, type AuthUser } from "./api";
import { BoardWorkspace } from "./boards/[id]/page";
import CreateBoardButton from "./create-board-button";
import LandingAuth from "./landing-auth";

type BoardColumnSummary = {
  id: string;
  is_intake?: boolean;
  tasks?: { id: string }[];
};

type BoardMemberPreview = {
  user_id: string;
  users: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string | null;
  };
};

type BoardActivityPreview = {
  id: string;
  action_text: string;
  created_at?: string | null;
  users?: {
    id: string;
    name: string;
  } | null;
};

export type HomeBoard = {
  id: string;
  title: string;
  description?: string | null;
  background?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  columns?: BoardColumnSummary[];
  board_members?: BoardMemberPreview[];
  activity_logs?: BoardActivityPreview[];
};

type WorkspaceBoardAnalytics = {
  id: string;
  title: string;
  health_status: "NEEDS_ATTENTION" | "HIGH_PRIORITY" | "ON_TRACK";
  health_label: string;
  total_tasks: number;
  open_tasks: number;
  done_tasks: number;
  overdue_tasks: number;
  urgent_tasks: number;
  completion_rate: number;
};

type WorkspaceAnalytics = {
  generated_at: string;
  summary: {
    boards: number;
    columns: number;
    intake_tasks: number;
    total_tasks: number;
    open_tasks: number;
    done_tasks: number;
    urgent_tasks: number;
    overdue_tasks: number;
    due_soon_tasks: number;
    unassigned_tasks: number;
    completion_rate: number;
    checklist_completion_rate: number;
  };
  boards: WorkspaceBoardAnalytics[];
};

type SortMode = "recent" | "updated" | "az" | "za";
type AuthMode = "login" | "register";
type DirectoryFilter = "ALL" | "ACTIVE" | "ARCHIVED";

function getTaskCount(board: HomeBoard) {
  return (board.columns || []).reduce(
    (total, column) => total + (column.tasks?.length || 0),
    0
  );
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "No recent activity";

  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(Math.floor(difference / 60000), 0);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getWorkspaceHealth(
  board: HomeBoard,
  analytics?: WorkspaceBoardAnalytics
) {
  if (board.archived_at) {
    return {
      label: "Archived",
      className: "border-slate-300 bg-slate-100 text-slate-600",
    };
  }

  if (analytics?.health_status === "NEEDS_ATTENTION") {
    return {
      label: "At risk",
      className: "border-red-300 bg-red-50 text-red-700",
    };
  }

  if (analytics?.health_status === "HIGH_PRIORITY") {
    return {
      label: "High priority",
      className: "border-orange-300 bg-orange-50 text-orange-700",
    };
  }

  return {
    label: analytics?.health_label || "On track",
    className: "border-lime-300 bg-lime-50 text-lime-700",
  };
}

function AccountMenu({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="tm-account-trigger flex h-10 items-center gap-2 border border-blue-200 bg-white px-2 text-left"
        aria-label="Open account menu"
        aria-expanded={isOpen}
      >
        <span className="flex h-7 w-7 items-center justify-center bg-slate-900 text-[10px] font-black text-white">
          {getInitials(user.name)}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-36 truncate text-xs font-bold text-slate-800">{user.name}</span>
          <span className="block max-w-36 truncate text-[9px] text-slate-500">{user.email}</span>
        </span>
        <span className="hidden text-[9px] font-black text-blue-600 sm:block">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="tm-account-menu absolute right-0 top-[calc(100%+8px)] z-50 w-64 border border-blue-200 bg-white p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Active operator</p>
          <p className="mt-2 truncate text-sm font-black text-slate-950">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 w-full border border-red-200 bg-red-50 px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-red-600 hover:bg-red-100"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function getOAuthErrorMessage(authError: string | null) {
  if (!authError) return "";

  if (authError === "google_oauth_not_configured") {
    return "Google login is not configured yet.";
  }

  return "Google login failed. Please try again.";
}

function getInitialAuthError() {
  if (typeof window === "undefined") return "";
  return getOAuthErrorMessage(new URLSearchParams(window.location.search).get("auth_error"));
}

class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired.");
    this.name = "SessionExpiredError";
  }
}

export default function HomeWorkspaces() {
  const router = useRouter();
  const [boards, setBoards] = useState<HomeBoard[]>([]);
  const [archivedBoards, setArchivedBoards] = useState<HomeBoard[]>([]);
  const [workspaceAnalytics, setWorkspaceAnalytics] = useState<WorkspaceAnalytics | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => Boolean(getInitialAuthError()));
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [editingBoard, setEditingBoard] = useState<HomeBoard | null>(null);
  const [deletingBoard, setDeletingBoard] = useState<HomeBoard | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(getInitialAuthError);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoringBoardId, setRestoringBoardId] = useState<string | null>(null);
  const [duplicatingBoardId, setDuplicatingBoardId] = useState<string | null>(null);
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>("ACTIVE");
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  const filteredBoards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sourceBoards =
      directoryFilter === "ACTIVE"
        ? boards
        : directoryFilter === "ARCHIVED"
          ? archivedBoards
          : [...boards, ...archivedBoards];
    const result = sourceBoards.filter((board) => {
      if (!normalizedQuery) return true;
      return `${board.title} ${board.description || ""}`
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return result.sort((a, b) => {
      if (sortMode === "az") return a.title.localeCompare(b.title);
      if (sortMode === "za") return b.title.localeCompare(a.title);
      if (sortMode === "updated") {
        return (
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime()
        );
      }
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });
  }, [archivedBoards, boards, directoryFilter, query, sortMode]);

  const totalTasks = boards.reduce((total, board) => total + getTaskCount(board), 0);
  const totalColumns = boards.reduce(
    (total, board) =>
      total + (board.columns || []).filter((column) => !column.is_intake).length,
    0
  );
  const workspaceSummary = workspaceAnalytics?.summary;
  const displayWorkspaceBoards = workspaceSummary?.boards ?? boards.length;
  const displayWorkspaceColumns = workspaceSummary?.columns ?? totalColumns;
  const displayWorkspaceTasks = workspaceSummary?.total_tasks ?? totalTasks;
  const boardAnalyticsById = useMemo(
    () =>
      new Map(
        (workspaceAnalytics?.boards || []).map((boardAnalytics) => [
          boardAnalytics.id,
          boardAnalytics,
        ])
      ),
    [workspaceAnalytics]
  );
  const recentBoards = useMemo(
    () =>
      [...boards]
        .sort(
          (a, b) =>
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
        )
        .slice(0, 5),
    [boards]
  );
  const directorySourceCount =
    directoryFilter === "ACTIVE"
      ? boards.length
      : directoryFilter === "ARCHIVED"
        ? archivedBoards.length
        : boards.length + archivedBoards.length;
  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) || null,
    [boards, selectedBoardId]
  );

  const loadBoards = useCallback(async () => {
    const response = await apiFetch("/api/boards");

    if (!response.ok) {
      if (response.status === 401) {
        throw new SessionExpiredError();
      }
      throw new Error("Load boards failed");
    }

    const boardData = (await response.json()) as HomeBoard[];
    setBoards(boardData);
  }, []);

  const loadArchivedBoards = useCallback(async () => {
    const response = await apiFetch("/api/boards/archived");

    if (!response.ok) {
      if (response.status === 401) {
        throw new SessionExpiredError();
      }
      throw new Error("Load archived boards failed");
    }

    const boardData = (await response.json()) as HomeBoard[];
    setArchivedBoards(boardData);
  }, []);

  const loadWorkspaceAnalytics = useCallback(async () => {
    const response = await apiFetch("/api/analytics/workspace");

    if (!response.ok) {
      if (response.status === 401) {
        throw new SessionExpiredError();
      }
      setWorkspaceAnalytics(null);
      return;
    }

    const data = (await response.json()) as WorkspaceAnalytics;
    setWorkspaceAnalytics(data);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const response = await apiFetch("/api/auth/me");

      if (!response.ok) {
        notifyAuthChanged();
        setCurrentUser(null);
        setBoards([]);
        setArchivedBoards([]);
        setWorkspaceAnalytics(null);
        return;
      }

      const data = (await response.json()) as { user: AuthUser };
      setCurrentUser(data.user);
      notifyAuthChanged();
      await Promise.all([loadBoards(), loadArchivedBoards(), loadWorkspaceAnalytics()]);
    } catch (sessionError) {
      if (sessionError instanceof SessionExpiredError) {
        notifyAuthChanged();
        setCurrentUser(null);
        setBoards([]);
        setArchivedBoards([]);
        setWorkspaceAnalytics(null);
        setAuthMode("login");
        setIsAuthModalOpen(true);
        setError("Your session expired. Please sign in again.");
        return;
      }

      console.error("Could not reach the backend while restoring the session.", sessionError);
      notifyAuthChanged();
      setCurrentUser(null);
      setBoards([]);
      setArchivedBoards([]);
      setWorkspaceAnalytics(null);
      setError(
        `Cannot connect to the backend at ${API_BASE_URL}. Check the Render URL and CORS settings.`
      );
    } finally {
      setIsAuthChecked(true);
    }
  }, [loadArchivedBoards, loadBoards, loadWorkspaceAnalytics]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");

    if (authError) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Restore the existing HttpOnly cookie session on first client render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession();
  }, [loadSession]);

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthenticating(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${authMode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
          ...(authMode === "register" ? { name: authName.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Authentication failed");
      }

      const data = (await response.json()) as { user: AuthUser };
      setCurrentUser(data.user);
      notifyAuthChanged();
      setAuthPassword("");
      setIsAuthModalOpen(false);
      await Promise.all([loadBoards(), loadArchivedBoards(), loadWorkspaceAnalytics()]);
    } catch (authError) {
      if (authError instanceof SessionExpiredError) {
        setCurrentUser(null);
        setIsAuthModalOpen(true);
        setError("The login succeeded, but the session could not be restored. Please try again.");
      } else {
        setError(authError instanceof Error ? authError.message : "Could not authenticate.");
      }
    } finally {
      setIsAuthenticating(false);
      setIsAuthChecked(true);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      notifyAuthChanged();
    }
    setCurrentUser(null);
    setBoards([]);
    setArchivedBoards([]);
    setWorkspaceAnalytics(null);
    router.push("/");
  };

  const handleWorkspaceCreated = async (board: { id: string }) => {
    await Promise.all([loadBoards(), loadWorkspaceAnalytics()]);
    setDirectoryFilter("ACTIVE");
    setSelectedBoardId(board.id);
  };

  const openEdit = (board: HomeBoard) => {
    setEditingBoard(board);
    setTitle(board.title);
    setDescription(board.description || "");
    setError("");
  };

  const closeEdit = () => {
    setEditingBoard(null);
    setTitle("");
    setDescription("");
    setError("");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingBoard || !title.trim()) return;

    setIsSaving(true);
    setError("");

    try {
      const response = await apiFetch(`/api/boards/${editingBoard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          background: editingBoard.background || null,
        }),
      });

      if (!response.ok) throw new Error("Update board failed");

      const updatedBoard = (await response.json()) as HomeBoard;
      setBoards((currentBoards) =>
        currentBoards.map((board) =>
          board.id === updatedBoard.id ? updatedBoard : board
        )
      );
      closeEdit();
    } catch {
      setError("Khong luu duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (boardId: string) => {
    setDuplicatingBoardId(boardId);
    setError("");

    try {
      const response = await apiFetch(`/api/boards/${boardId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Duplicate board failed");

      const duplicatedBoard = (await response.json()) as HomeBoard;
      setBoards((currentBoards) => [duplicatedBoard, ...currentBoards]);
      await loadWorkspaceAnalytics();
    } catch {
      setError("Khong nhan ban duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setDuplicatingBoardId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingBoard) return;

    setIsDeleting(true);
    setError("");

    try {
      const response = await apiFetch(`/api/boards/${deletingBoard.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Archive board failed");

      setBoards((currentBoards) =>
        currentBoards.filter((board) => board.id !== deletingBoard.id)
      );
      setArchivedBoards((currentBoards) => [
        { ...deletingBoard, archived_at: new Date().toISOString() },
        ...currentBoards,
      ]);
      if (selectedBoardId === deletingBoard.id) {
        setSelectedBoardId(null);
      }
      setDeletingBoard(null);
      await loadWorkspaceAnalytics();
    } catch {
      setError("Khong archive duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreBoard = async (boardId: string) => {
    setRestoringBoardId(boardId);
    setError("");

    try {
      const response = await apiFetch(`/api/boards/${boardId}/restore`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Restore board failed");

      await Promise.all([loadBoards(), loadArchivedBoards(), loadWorkspaceAnalytics()]);
    } catch {
      setError("Khong khoi phuc duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setRestoringBoardId(null);
    }
  };

  if (!isAuthChecked) {
    return (
      <main className="tm-shell flex min-h-screen items-center justify-center px-6 text-slate-900">
        <div className="tm-panel tm-fade-in px-5 py-4 text-sm font-medium text-slate-600">
          Loading workspace...
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <LandingAuth
        authMode={authMode}
        isOpen={isAuthModalOpen}
        authName={authName}
        authEmail={authEmail}
        authPassword={authPassword}
        isAuthenticating={isAuthenticating}
        error={error}
        onAuthSubmit={handleAuthSubmit}
        onGoogleLogin={handleGoogleLogin}
        onOpen={(mode) => {
          setAuthMode(mode);
          setError("");
          setIsAuthModalOpen(true);
        }}
        onClose={() => setIsAuthModalOpen(false)}
        onModeChange={setAuthMode}
        onNameChange={setAuthName}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onErrorClear={() => setError("")}
      />
    );
  }

  return (
    <main className="tm-shell tm-dashboard-shell tm-directory-shell min-h-screen text-slate-900">
      <div className={`grid min-h-screen ${selectedBoard ? "grid-cols-1" : "md:grid-cols-[240px_1fr]"}`}>
        {!selectedBoard && (
          <aside className="tm-sidebar tm-directory-sidebar sticky top-0 hidden h-screen overflow-y-auto border-r px-3 py-4 md:block">
          <div className="tm-sidebar-brand mb-4 flex items-center gap-3">
            <span className="tm-brand-mark tm-directory-mark flex h-9 w-9 items-center justify-center text-[11px] font-black text-white">MD</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-slate-950">MartinDesk</p>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-500">Workspace directory</p>
            </div>
          </div>
          <nav className="grid gap-1 text-sm">
            <p className="mb-1 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
              Workspaces
            </p>
            {([
              { value: "ALL", label: "All", count: boards.length + archivedBoards.length },
              { value: "ACTIVE", label: "Active", count: boards.length },
              { value: "ARCHIVED", label: "Archived", count: archivedBoards.length },
            ] as const).map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setDirectoryFilter(filter.value);
                  setSelectedBoardId(null);
                }}
                className={`tm-directory-nav-item flex w-full items-center justify-between px-3 py-2 text-left font-bold transition ${
                  directoryFilter === filter.value
                    ? "is-active bg-blue-50 text-blue-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{filter.label}</span>
                <span className="text-xs text-blue-600">{filter.count}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 border-t border-slate-200 pt-4">
            <p className="px-3 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
              Recently opened
            </p>
            <div className="mt-2 grid gap-1">
              {recentBoards.map((board, index) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => {
                    setDirectoryFilter("ACTIVE");
                    setSelectedBoardId(board.id);
                  }}
                  className="tm-directory-recent flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-blue-200 bg-white text-[9px] font-black text-blue-700">
                    W{index + 1}
                  </span>
                  <span className="truncate">{board.title}</span>
                </button>
              ))}
              {recentBoards.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400">No recent workspaces</p>
              )}
            </div>
          </div>
          </aside>
        )}

        <section className="min-w-0">
          <header className="tm-topbar tm-directory-topbar sticky top-0 z-20 border-b px-5 py-3">
            {selectedBoard ? (
              <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedBoardId(null)}
                    className="tm-button-secondary h-9 border px-3 text-xs font-black uppercase tracking-[0.12em] text-slate-700"
                  >
                    ← All workspaces
                  </button>
                  <div className="hidden h-6 w-px bg-blue-200 sm:block" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                      Active workspace
                    </p>
                    <p className="truncate text-sm font-black text-slate-950">
                      {selectedBoard.title}
                    </p>
                  </div>
                </div>

                <AccountMenu user={currentUser} onLogout={handleLogout} />
              </div>
            ) : (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="md:hidden">
                    <span className="tm-brand-mark flex h-9 w-9 items-center justify-center text-[11px] font-black text-white">MD</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">
                      Directory search
                    </p>
                    <input
                      aria-label="Find a workspace by name"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Find a workspace by name"
                      className="tm-input h-9 w-full max-w-2xl border px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 xl:w-[480px]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <CreateBoardButton onCreated={handleWorkspaceCreated} />
                  <AccountMenu user={currentUser} onLogout={handleLogout} />
                </div>
              </div>
            )}
          </header>

          <div className={`px-5 py-5 ${selectedBoard ? "" : "tm-directory-content"}`}>
            {selectedBoard ? (
              <div className="-mx-5 -my-5 min-h-[calc(100vh-65px)]">
                <BoardWorkspace
                  key={selectedBoard.id}
                  id={selectedBoard.id}
                  embedded
                />
              </div>
            ) : (
              <>
            <div className="tm-dashboard-hero tm-directory-hero mb-6 p-6 text-white sm:p-7">
              <div className="relative z-[1] flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 bg-lime-300" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">
                      Control room / Directory 01
                    </p>
                  </div>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                    {currentUser.name.split(" ")[0]}&apos;s work floor
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/85">
                    Every workspace is a room. Open one to move tasks, inspect signals, and keep the work visible.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="tm-dashboard-stat tm-directory-stat px-3 py-2.5 sm:min-w-24">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-100">Workspaces</p>
                    <p className="mt-1 text-xl font-black">{displayWorkspaceBoards}</p>
                  </div>
                  <div className="tm-dashboard-stat tm-directory-stat px-3 py-2.5 sm:min-w-24">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-100">Open tasks</p>
                    <p className="mt-1 text-xl font-black">{workspaceSummary?.open_tasks ?? displayWorkspaceTasks}</p>
                  </div>
                  <div className="tm-dashboard-stat tm-directory-stat px-3 py-2.5 sm:min-w-24">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-100">Overdue</p>
                    <p className={`mt-1 text-xl font-black ${(workspaceSummary?.overdue_tasks ?? 0) > 0 ? "text-orange-300" : ""}`}>
                      {workspaceSummary?.overdue_tasks ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="tm-directory-toolbar mb-5 flex flex-col gap-4 border p-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Workspace nodes</p>
                <p className="mt-1 text-sm text-slate-500">
                  {displayWorkspaceBoards} workspaces / {displayWorkspaceColumns} desks / {displayWorkspaceTasks} tasks
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Showing {filteredBoards.length} of {directorySourceCount}
                </span>
                <div className="flex border border-blue-200 bg-white">
                  {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setDirectoryFilter(filter)}
                      className={`border-r border-blue-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] last:border-r-0 ${
                        directoryFilter === filter
                          ? "bg-blue-600 text-white"
                          : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="tm-button-secondary h-9 px-3 text-xs font-bold text-slate-600"
                  >
                    Clear ×
                  </button>
                )}
                <select
                  aria-label="Sort workspaces"
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="tm-input h-9 border px-3 text-sm text-slate-900 outline-none"
                >
                  <option value="recent">Newest first</option>
                  <option value="updated">Recently updated</option>
                  <option value="az">A to Z</option>
                  <option value="za">Z to A</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                {error}
              </div>
            )}

            {filteredBoards.length > 0 || (directoryFilter !== "ARCHIVED" && !query.trim()) ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {filteredBoards.map((board, boardIndex) => {
                  const analytics = boardAnalyticsById.get(board.id);
                  const health = getWorkspaceHealth(board, analytics);
                  const isArchived = Boolean(board.archived_at);
                  const members = board.board_members || [];
                  const latestActivity = board.activity_logs?.[0];
                  const intakeTasks =
                    (board.columns || []).find((column) => column.is_intake)?.tasks?.length || 0;

                  return (
                  <article
                    key={board.id}
                    className={`tm-card tm-directory-card tm-fade-in ${isArchived ? "is-archived" : ""}`}
                  >
                    <div className="p-4">
                      <div className="mb-4 flex items-start justify-between gap-3 border-b border-blue-100 pb-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                            Workspace node / {String(boardIndex + 1).padStart(2, "0")}
                          </p>
                          <h2 className="mt-1 truncate text-lg font-black uppercase tracking-wide text-slate-950" title={board.title}>
                            {board.title}
                          </h2>
                          <p className="mt-1 text-xs text-slate-500">
                            {isArchived ? `Archived ${formatDate(board.archived_at)}` : `Updated ${formatDate(board.updated_at)}`}
                          </p>
                        </div>
                        <span className={`border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${health.className}`}>
                          {health.label}
                        </span>
                      </div>

                      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">
                        {board.description || "No description"}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div className="tm-directory-metric border px-3 py-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Desks</p>
                          <p className="mt-1 font-black text-slate-950">
                            {(board.columns || []).filter((column) => !column.is_intake).length}
                          </p>
                        </div>
                        <div className="tm-directory-metric border px-3 py-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Tasks</p>
                          <p className="mt-1 font-black text-slate-950">{getTaskCount(board)}</p>
                        </div>
                        <div className="tm-directory-metric border px-3 py-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Intake</p>
                          <p className="mt-1 font-black text-slate-950">
                            {intakeTasks}
                          </p>
                        </div>
                        <div className="tm-directory-metric border px-3 py-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Overdue</p>
                          <p className={`mt-1 font-black ${(analytics?.overdue_tasks || 0) > 0 ? "text-red-600" : "text-slate-950"}`}>
                            {analytics?.overdue_tasks || 0}
                          </p>
                        </div>
                      </div>

                      {!isArchived && (
                        <div className="mt-4">
                          <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                            <span>Completion signal</span>
                            <span>{analytics?.completion_rate || 0}%</span>
                          </div>
                          <div className="h-2 border border-blue-100 bg-blue-50">
                            <div
                              className="h-full bg-blue-600"
                              style={{ width: `${analytics?.completion_rate || 0}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-4 grid gap-3 border-t border-blue-100 pt-3 sm:grid-cols-[auto_1fr] sm:items-center">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Crew</p>
                          <div className="mt-1 flex items-center">
                            {members.length > 0 ? (
                              members.map((member, memberIndex) => (
                                <span
                                  key={member.user_id}
                                  title={`${member.users.name} (${member.users.email})`}
                                  className="relative flex h-7 w-7 items-center justify-center border border-white bg-slate-900 text-[8px] font-black text-white"
                                  style={{ marginLeft: memberIndex === 0 ? 0 : -5, zIndex: members.length - memberIndex }}
                                >
                                  {getInitials(member.users.name)}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">No members</span>
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Latest signal</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                            {latestActivity?.action_text || "No recent activity"}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {formatRelativeTime(latestActivity?.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="tm-directory-card-footer flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
                      {isArchived ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreBoard(board.id)}
                          disabled={restoringBoardId === board.id}
                          className="tm-button-primary ml-auto px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
                        >
                          {restoringBoardId === board.id ? "Restoring" : "Restore workspace"}
                        </button>
                      ) : (
                        <>
                        <button
                          type="button"
                          onClick={() => {
                            setDirectoryFilter("ACTIVE");
                            setSelectedBoardId(board.id);
                          }}
                          className="text-xs font-black uppercase tracking-[0.14em] text-blue-700 hover:text-blue-500"
                        >
                          Enter workspace →
                        </button>
                        <details className="tm-directory-actions relative">
                          <summary aria-label="Open workspace actions" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center border border-blue-200 bg-white text-base font-black text-blue-700">
                            ⋯
                          </summary>
                          <div className="absolute bottom-[calc(100%+6px)] right-0 z-20 grid w-36 border border-blue-200 bg-white p-1 shadow-xl">
                            <button
                              type="button"
                              onClick={() => handleDuplicate(board.id)}
                              disabled={duplicatingBoardId === board.id}
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {duplicatingBoardId === board.id ? "Copying" : "Duplicate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(board)}
                              className="px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingBoard(board);
                                setError("");
                              }}
                              className="px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Archive
                            </button>
                          </div>
                        </details>
                        </>
                      )}
                    </div>
                  </article>
                  );
                })}
                {directoryFilter !== "ARCHIVED" && !query.trim() && (
                  <CreateBoardButton variant="card" onCreated={handleWorkspaceCreated} />
                )}
              </div>
            ) : (
              <div className="tm-panel border-dashed p-10 text-center text-slate-500">
                {directoryFilter === "ARCHIVED"
                  ? "No archived workspaces."
                  : "No workspaces match your search."}
              </div>
            )}
              </>
            )}
          </div>
        </section>
      </div>

      {editingBoard && (
        <div className="tm-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-12">
          <form
            onSubmit={handleSave}
            className="tm-modal tm-pop-in w-full max-w-md border border-slate-200 bg-white p-5 text-slate-900"
          >
            <h2 className="mb-4 text-xl font-bold text-slate-900">Edit workspace</h2>
            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Workspace name
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="tm-input w-full border px-3 py-2 text-sm text-slate-900 outline-none"
                autoFocus
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="tm-input min-h-24 w-full border px-3 py-2 text-sm text-slate-900 outline-none"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="tm-button-secondary px-4 py-2 text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !title.trim()}
                className="tm-button-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingBoard && (
        <div className="tm-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-12">
          <div className="tm-modal tm-pop-in w-full max-w-md border border-slate-200 bg-white p-5 text-slate-900">
            <h2 className="text-xl font-bold text-slate-900">Archive workspace?</h2>
            <p className="mt-2 text-sm text-slate-600">
              {deletingBoard.title} will move to the archived workspace directory. You can restore it later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingBoard(null)}
                className="tm-button-secondary px-4 py-2 text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Archiving" : "Archive workspace"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
