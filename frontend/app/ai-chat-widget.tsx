"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch, getAuthToken } from "./api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const starterPrompts = [
  "Phan tich board hien tai giup tui",
  "Goi y task tiep theo nen lam",
  "Tom tat tien do workspace",
  "Tim task rui ro va cach xu ly",
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

export default function AiChatWidget() {
  const pathname = usePathname();
  const boardId = useMemo(() => getBoardIdFromPath(pathname || ""), [pathname]);
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

      const data = (await response.json()) as { reply: string };
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: data.reply },
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

  return (
    <>
      {isOpen && (
        <section className="fixed bottom-20 right-5 z-[120] flex h-[min(760px,calc(100vh-120px))] w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                AI Assistant
              </p>
              <h2 className="text-base font-bold">Task Manager Copilot</h2>
              <p className="mt-0.5 text-xs text-slate-300">
                {boardId ? "Dang dung context board hien tai" : "Dang dung context workspace"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-2 py-1 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </header>

          <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={isSending}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className={`max-w-[94%] rounded-lg px-3 py-2 text-sm leading-6 ${
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
                </div>
              ))}

              {isSending && (
                <div className="mr-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500">
                  AI is thinking...
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-slate-50 p-3">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Hoi AI ve board, task, sprint, risk..."
              className="min-h-20 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                AI chi doc du lieu ban co quyen xem.
              </p>
              <button
                type="submit"
                disabled={isSending || !message.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
        className="fixed bottom-5 right-5 z-[120] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white shadow-xl ring-4 ring-blue-100 transition hover:bg-blue-500"
        aria-label="Open AI assistant"
      >
        AI
      </button>
    </>
  );
}
