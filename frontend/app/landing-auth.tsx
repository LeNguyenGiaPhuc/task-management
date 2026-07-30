"use client";

import type { FormEvent } from "react";

type AuthMode = "login" | "register";

type LandingAuthProps = {
  authMode: AuthMode;
  isOpen: boolean;
  authName: string;
  authEmail: string;
  authPassword: string;
  isAuthenticating: boolean;
  error: string;
  onOpen: (mode: AuthMode) => void;
  onClose: () => void;
  onAuthSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGoogleLogin: () => void;
  onModeChange: (mode: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onErrorClear: () => void;
};

const features = [
  {
    icon: "01",
    title: "Plan with clarity",
    description: "Turn ideas into focused boards, columns, and priorities your team can act on.",
  },
  {
    icon: "02",
    title: "Control access",
    description: "Keep every workspace secure with OWNER, ADMIN, and MEMBER permissions.",
  },
  {
    icon: "03",
    title: "Move work forward",
    description: "Use analytics and an AI assistant to spot bottlenecks and take the next step.",
  },
];

export default function LandingAuth({
  authMode,
  isOpen,
  authName,
  authEmail,
  authPassword,
  isAuthenticating,
  error,
  onOpen,
  onClose,
  onAuthSubmit,
  onGoogleLogin,
  onModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onErrorClear,
}: LandingAuthProps) {
  const openAuth = (mode: AuthMode) => {
    onOpen(mode);
  };

  const closeAuth = () => {
    if (!isAuthenticating) onClose();
  };

  return (
    <main className="tm-landing min-h-screen overflow-hidden text-slate-950">
      <div className="tm-landing-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <nav className="tm-landing-nav relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <div className="flex items-center gap-3">
          <span className="tm-brand-mark flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black text-white">MD</span>
          <span className="text-base font-extrabold tracking-tight text-slate-950">MartinDesk</span>
        </div>
        <div className="hidden items-center gap-7 text-sm font-semibold text-slate-500 md:flex">
          <a href="#features" className="transition hover:text-slate-950">Features</a>
          <a href="#workflow" className="transition hover:text-slate-950">How it works</a>
          <a href="#access" className="transition hover:text-slate-950">Access control</a>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openAuth("login")} className="tm-landing-nav-button rounded-full px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50">
            Sign in
          </button>
          <button type="button" onClick={() => openAuth("register")} className="tm-button-primary rounded-full px-4 py-2 text-sm font-bold text-white">
            Sign up
          </button>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-14 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-16">
        <div className="tm-fade-in max-w-2xl">
          <div className="tm-eyebrow mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Calm workspaces for ambitious teams
          </div>
          <h1 className="max-w-2xl text-5xl font-black leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
            Make progress visible.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
            A focused, AI-assisted workspace for turning scattered tasks into clear momentum - from your first idea to the final release.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
            <span className="tm-trust-pill">Kanban boards</span>
            <span className="tm-trust-pill">Role-based access</span>
            <span className="tm-trust-pill">Actionable analytics</span>
          </div>

          <div id="features" className="mt-12 grid gap-4 sm:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="tm-feature-card rounded-2xl p-4">
                <div className="tm-feature-number mb-5 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-blue-700">{feature.icon}</div>
                <h2 className="text-sm font-extrabold text-slate-950">{feature.title}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="workflow" className="relative lg:pl-8">
          <div className="tm-board-preview absolute -left-1 -top-8 hidden w-44 rounded-2xl p-3 shadow-xl sm:block lg:-left-10 lg:top-10">
            <div className="mb-3 flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span>Today&apos;s focus</span>
              <span className="text-emerald-600">+24%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-3/4 rounded-full bg-emerald-400" /></div>
            <p className="mt-3 text-xs font-bold text-slate-900">Team momentum</p>
            <p className="mt-1 text-[10px] text-slate-500">12 tasks completed this week</p>
          </div>

          <div className="tm-landing-auth-wrap rounded-[2rem] p-2 sm:p-3">
            <div className="tm-mini-board rounded-[1.5rem] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Live workspace</p>
                  <p className="mt-1 text-sm font-bold text-white">Product launch / Q3</p>
                </div>
                <span className="flex -space-x-2">
                  {['A', 'M', 'K'].map((letter, index) => (
                    <span key={letter} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-black text-white ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-violet-500' : 'bg-emerald-500'}`}>
                      {letter}
                    </span>
                  ))}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { title: "Backlog", tone: "blue", cards: ["Research users", "Map flow"] },
                  { title: "In progress", tone: "violet", cards: ["Build dashboard", "Review API"] },
                  { title: "Done", tone: "emerald", cards: ["Set up auth", "Ship v1"] },
                ].map((column) => (
                  <div key={column.title} className="tm-mini-column rounded-xl p-2">
                    <div className="mb-2 flex items-center justify-between gap-1">
                      <span className="truncate text-[9px] font-bold text-slate-300">{column.title}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${column.tone === 'blue' ? 'bg-blue-400' : column.tone === 'violet' ? 'bg-violet-400' : 'bg-emerald-400'}`} />
                    </div>
                    <div className="grid gap-2">
                      {column.cards.map((card) => (
                        <div key={card} className="tm-mini-task rounded-lg p-2">
                          <p className="text-[9px] font-semibold leading-3 text-slate-200">{card}</p>
                          <div className="mt-2 flex gap-1"><span className="h-1 w-5 rounded-full bg-slate-600" /><span className="h-1 w-2 rounded-full bg-slate-700" /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                <span className="text-[10px] font-medium text-slate-300">AI assistant is ready to help</span>
                <span className="rounded-full bg-blue-400/20 px-2 py-1 text-[9px] font-bold text-blue-200">Ask AI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="access" className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 px-6 py-6 text-xs font-semibold text-slate-500 lg:px-10">
        <span>Built for thoughtful teams who want less noise and more momentum.</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Secure workspace access</span>
      </section>

      {isOpen && (
        <div className="tm-auth-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onMouseDown={closeAuth}>
          <div className="tm-auth-modal tm-pop-in relative w-full max-w-md rounded-[1.5rem] p-5 sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={closeAuth} aria-label="Close authentication dialog" className="absolute right-4 top-4 rounded-full px-2 py-1 text-lg leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-800">×</button>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">MartinDesk</p>
            <h2 id="auth-modal-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              {authMode === "login" ? "Enter your workspace" : "Create your workspace"}
            </h2>
            <p className="mt-2 text-sm leading-5 text-slate-500">
              {authMode === "login" ? "Pick up where your team left off." : "Create your account with email or Google."}
            </p>

            <button type="button" onClick={onGoogleLogin} className="tm-button-secondary mt-5 flex h-11 w-full items-center justify-center gap-2 px-4 text-sm font-bold text-slate-800">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs font-black text-blue-600">G</span>
              Continue with Google
            </button>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">or continue with email</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={onAuthSubmit}>
              {authMode === "register" && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">Name</span>
                  <input value={authName} onChange={(event) => onNameChange(event.target.value)} className="tm-input h-11 w-full border px-3 text-sm text-slate-900 outline-none" autoFocus />
                </label>
              )}
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Email</span>
                <input type="email" value={authEmail} onChange={(event) => onEmailChange(event.target.value)} className="tm-input h-11 w-full border px-3 text-sm text-slate-900 outline-none" autoFocus={authMode === "login"} />
              </label>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Password</span>
                <input type="password" value={authPassword} onChange={(event) => onPasswordChange(event.target.value)} className="tm-input h-11 w-full border px-3 text-sm text-slate-900 outline-none" />
              </label>

              {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</div>}

              <button type="submit" disabled={isAuthenticating || !authEmail.trim() || !authPassword || (authMode === "register" && !authName.trim())} className="tm-button-primary mt-5 h-11 w-full px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {isAuthenticating ? "Please wait" : authMode === "login" ? "Sign in to MartinDesk" : "Create account"}
              </button>
            </form>

            <button type="button" onClick={() => { onModeChange(authMode === "login" ? "register" : "login"); onErrorClear(); }} className="mt-3 w-full rounded-xl px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-blue-50 hover:text-blue-700">
              {authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
