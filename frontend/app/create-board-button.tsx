"use client";

import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./api";

type CreateBoardResponse = {
  id: string;
};

export default function CreateBoardButton({
  onCreated,
}: {
  onCreated: (board: CreateBoardResponse) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Create board failed");
      }

      const board = (await response.json()) as CreateBoardResponse;
      setTitle("");
      setDescription("");
      setIsOpen(false);
      await onCreated(board);
    } catch {
      setError("Khong tao duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="tm-button-primary h-10 px-4 text-sm font-semibold text-white"
      >
        + New board
      </button>

      {isOpen &&
        createPortal(
        <div className="tm-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto px-6 py-10">
          <form
            onSubmit={handleSubmit}
            className="tm-modal tm-pop-in w-full max-w-2xl border border-slate-200 bg-white p-6 text-slate-900"
          >
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Workspace
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Create space</h2>
              <p className="mt-2 text-sm text-slate-600">
                Create a new workspace for columns, tasks, members, and activity tracking.
              </p>
            </div>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Space name
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="tm-input h-11 w-full border px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                autoFocus
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="tm-input min-h-36 w-full border px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

            {error && (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="tm-button-secondary px-4 py-2 text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="tm-button-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Creating" : "Create space"}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}
