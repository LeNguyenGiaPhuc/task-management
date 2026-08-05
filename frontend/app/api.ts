const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

// On Vercel, route requests through Next.js so the session cookie belongs to
// martin desk's domain instead of depending on a third-party Render cookie.
export const API_BASE_URL =
  process.env.NODE_ENV === "production" && configuredApiUrl
    ? ""
    : configuredApiUrl || "http://localhost:5000";
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
