export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
};

export function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("task-manager:auth-changed"));
}

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: init?.headers,
  });
}
