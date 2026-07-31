"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch, getAuthToken } from "./api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: AiAction[];
};

type AiAction =
  | {
      type: "CREATE_TASK";
      label: string;
      payload: {
        board_id: string;
        column_id: string;
        title: string;
        description?: string | null;
        task_type?: "TASK" | "BUG" | "STORY" | "EPIC";
        priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
        due_date?: string | null;
      };
    }
  | {
      type: "CREATE_SUBTASKS";
      label: string;
      payload: {
        task_id: string;
        titles: string[];
      };
    };

type AiActionResult = {
  ok: boolean;
  type: string;
  message?: string;
  error?: string;
};

const starterPrompts = [
  "Phan tich board hien tai giup tui",
  "Goi y task tiep theo nen lam",
  "Tao 3 task tiep theo cho board nay",
  "Chia task dang rui ro thanh checklist",
];

function getBoardIdFromPath(pathname: string) {
  const match = pathname.match(/^\/boards\/([^/?#]+)/);
  return match?.[1] || "";
}

function renderInlineText(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function renderAssistantText(content: string) {
  const lines = content.split("\n");
  const rendered: ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      rendered.push(<div key={index} className="h-2" />);
      return;
    }

    if (/^#{1,3}\s+/.test(trimmedLine)) {
      rendered.push(
        <p key={index} className="mt-2 font-bold text-slate-950 first:mt-0">
          {renderInlineText(trimmedLine.replace(/^#{1,3}\s+/, ""))}
        </p>
      );
      return;
    }

    if (/^[-*]\s+/.test(trimmedLine)) {
      rendered.push(
        <div key={index} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
          <span>{renderInlineText(trimmedLine.replace(/^[-*]\s+/, ""))}</span>
        </div>
      );
      return;
    }

    if (/^\d+[.)]\s+/.test(trimmedLine)) {
      rendered.push(
        <div key={index} className="flex gap-2">
          <span className="shrink-0 font-semibold text-blue-700">
            {trimmedLine.match(/^\d+/)?.[0]}.
          </span>
          <span>{renderInlineText(trimmedLine.replace(/^\d+[.)]\s+/, ""))}</span>
        </div>
      );
      return;
    }

    rendered.push(<p key={index}>{renderInlineText(trimmedLine)}</p>);
  });

  return rendered;
}

function renderActionPreview(action: AiAction) {
  if (action.type === "CREATE_TASK") {
    return (
      <div className="grid gap-1">
        <p className="font-semibold text-slate-950">Create task: {action.payload.title}</p>
        <p className="text-xs text-slate-500">
          {action.payload.task_type || "TASK"} / {action.payload.priority || "MEDIUM"}
          {action.payload.due_date ? ` / Due ${action.payload.due_date}` : ""}
        </p>
        {action.payload.description && (
          <p className="line-clamp-2 text-xs text-slate-600">{action.payload.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <p className="font-semibold text-slate-950">Create checklist items</p>
      <ul className="grid gap-1 text-xs text-slate-600">
        {action.payload.titles.slice(0, 5).map((title) => (
          <li key={title}>- {title}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AiChatWidget() {
  const pathname = usePathname();
  const boardIdFromPath = useMemo(() => getBoardIdFromPath(pathname || ""), [pathname]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeBoardId, setActiveBoardId] = useState("");
  const boardId = boardIdFromPath || activeBoardId;
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Tui co the phan tich board, goi y task, chia subtasks, tom tat activity va tra loi dua tren du lieu workspace hien tai.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [applyingMessageIndex, setApplyingMessageIndex] = useState<number | null>(null);

  useEffect(() => {
    const syncAuthentication = () => {
      const authenticated = Boolean(getAuthToken());
      setIsAuthenticated(authenticated);
      if (!authenticated) setIsOpen(false);
    };

    syncAuthentication();
    window.addEventListener("task-manager:auth-changed", syncAuthentication);

    return () => {
      window.removeEventListener("task-manager:auth-changed", syncAuthentication);
    };
  }, []);

  useEffect(() => {
    const handleActiveBoardChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ boardId?: string }>;
      setActiveBoardId(customEvent.detail?.boardId || "");
    };

    window.addEventListener("task-manager:active-board-changed", handleActiveBoardChange);

    return () => {
      window.removeEventListener("task-manager:active-board-changed", handleActiveBoardChange);
    };
  }, []);

  const sendMessage = async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSending) return;

    if (!getAuthToken()) {
      setIsOpen(true);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: "Ban can login truoc de AI doc duoc du lieu workspace.",
        },
      ]);
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmedContent },
    ];
    setMessages(nextMessages);
    setMessage("");
    setIsSending(true);

    try {
      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedContent,
          board_id: boardId || undefined,
          history: nextMessages.slice(-8),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "AI chat failed");
      }

      const data = (await response.json()) as { reply: string; actions?: AiAction[] };
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: data.reply, actions: data.actions || [] },
      ]);
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "AI dang loi. Kiem tra backend va GEMINI_API_KEY roi thu lai.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(message);
  };

  const applyActions = async (messageIndex: number, actions: AiAction[]) => {
    if (!actions.length || applyingMessageIndex !== null) return;

    setApplyingMessageIndex(messageIndex);

    try {
      const response = await apiFetch("/api/ai/actions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not apply AI actions");
      }

      const data = (await response.json()) as { results: AiActionResult[] };
      const okResults = data.results.filter((result) => result.ok);
      const failedResults = data.results.filter((result) => !result.ok);
      const resultLines = [
        okResults.length ? `Da ap dung ${okResults.length} action:` : "",
        ...okResults.map((result) => `- ${result.message || result.type}`),
        failedResults.length ? `Khong ap dung duoc ${failedResults.length} action:` : "",
        ...failedResults.map((result) => `- ${result.error || result.type}`),
      ].filter(Boolean);

      setMessages((currentMessages) => [
        ...currentMessages.map((item, index) =>
          index === messageIndex ? { ...item, actions: [] } : item
        ),
        {
          role: "assistant",
          content: resultLines.join("\n") || "Da ap dung AI actions.",
        },
      ]);

      window.dispatchEvent(new CustomEvent("task-manager:ai-actions-applied"));
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Khong ap dung duoc AI actions. Kiem tra backend roi thu lai.",
        },
      ]);
    } finally {
      setApplyingMessageIndex(null);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {isOpen && (
        <section className="tm-ai-panel tm-slide-up fixed bottom-20 right-5 z-[120] flex h-[min(760px,calc(100vh-120px))] w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden border bg-white text-slate-900">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-950 to-blue-950 px-4 py-3 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                AI Assistant
              </p>
              <h2 className="text-base font-bold">MartinDesk Copilot</h2>
              <p className="mt-0.5 text-xs text-slate-300">
                {boardId ? "Dang dung context board hien tai" : "Dang dung context workspace"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-2 py-1 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </header>

          <div className="grid gap-2 border-b border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={isSending}
                className="tm-button-secondary px-3 py-2 text-left text-xs font-medium text-slate-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto bg-white p-4">
            <div className="grid gap-3">
              {messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[94%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm ${
                    item.role === "user"
                      ? "ml-auto bg-blue-600 text-white"
                      : "mr-auto border border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="grid gap-1">
                    {item.role === "assistant" ? (
                      renderAssistantText(item.content)
                    ) : (
                      <p className="whitespace-pre-wrap">{item.content}</p>
                    )}
                  </div>
                  {item.role === "assistant" && item.actions && item.actions.length > 0 && (
                    <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Pending actions
                      </p>
                      {item.actions.map((action, actionIndex) => (
                        <div
                          key={`${action.type}-${actionIndex}`}
                          className="tm-card px-3 py-2"
                        >
                          {renderActionPreview(action)}
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => applyActions(index, item.actions || [])}
                          disabled={applyingMessageIndex !== null}
                          className="tm-button-primary px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {applyingMessageIndex === index ? "Applying..." : "Apply actions"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMessages((currentMessages) =>
                              currentMessages.map((messageItem, messageIndex) =>
                                messageIndex === index ? { ...messageItem, actions: [] } : messageItem
                              )
                            )
                          }
                          disabled={applyingMessageIndex !== null}
                          className="tm-button-secondary px-3 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="mr-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500">
                  AI is thinking...
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-slate-50/80 p-3">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Hoi AI ve board, task, sprint, risk..."
              className="tm-input min-h-20 w-full resize-none border px-3 py-2 text-sm text-slate-900 outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                AI chi doc du lieu ban co quyen xem.
              </p>
              <button
                type="submit"
                disabled={isSending || !message.trim()}
                className="tm-button-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="tm-ai-fab fixed bottom-5 right-5 z-[120] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white ring-4 ring-blue-100 transition hover:bg-blue-500"
        aria-label="Open AI assistant"
      >
        AI
      </button>
    </>
  );
}
