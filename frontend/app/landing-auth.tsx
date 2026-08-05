"use client";

import { useState, type FormEvent } from "react";

type AuthMode = "login" | "register" | "forgot" | "reset";

type LandingAuthProps = {
  authMode: AuthMode;
  isOpen: boolean;
  authName: string;
  authEmail: string;
  authPassword: string;
  authOtp: string;
  isAuthenticating: boolean;
  error: string;
  notice: string;
  onOpen: (mode: AuthMode) => void;
  onClose: () => void;
  onAuthSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGoogleLogin: () => void;
  onModeChange: (mode: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onErrorClear: () => void;
};

const workflowStages = [
  { id: "intake", number: "01", label: "Intake", note: "Capture the work", tone: "lime" },
  { id: "desk", number: "02", label: "Desk", note: "Place it where it belongs", tone: "blue" },
  { id: "done", number: "03", label: "Done", note: "Close the loop", tone: "orange" },
];

const workflowTask = {
  code: "MD-042",
  title: "Review API boundary decisions",
  detail: "Task / Medium",
};

const workflowSignals = [
  { label: "One next move", value: "Visible", tone: "lime" },
  { label: "Work location", value: "Clear", tone: "blue" },
  { label: "Loop status", value: "Open", tone: "orange" },
];

const workflow = [
  ["01", "Capture", "Put raw work in one visible place."],
  ["02", "Place", "Drop each card on the desk where it belongs."],
  ["03", "Advance", "Keep the next move clear until it is done."],
];

export default function LandingAuth({
  authMode,
  isOpen,
  authName,
  authEmail,
  authPassword,
  authOtp,
  isAuthenticating,
  error,
  notice,
  onOpen,
  onClose,
  onAuthSubmit,
  onGoogleLogin,
  onModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onOtpChange,
  onErrorClear,
}: LandingAuthProps) {
  const [activeStageIndex, setActiveStageIndex] = useState(1);
  const activeStage = workflowStages[activeStageIndex];
  const openAuth = (mode: AuthMode) => onOpen(mode);
  const closeAuth = () => {
    if (!isAuthenticating) onClose();
  };
  const isPasswordAuthMode = authMode === "login" || authMode === "register";
  const modalTitle =
    authMode === "login"
      ? "Return to your desk"
      : authMode === "register"
        ? "Create your desk"
        : authMode === "forgot"
          ? "Reset your password"
          : "Enter your reset code";
  const modalDescription =
    authMode === "login"
      ? "Pick up the signal where you left it."
      : authMode === "register"
        ? "Set up a workspace for work with intent."
        : authMode === "forgot"
          ? "We will send a one-time code to your email."
          : "Enter the 6-digit code from your email and choose a new password.";
  const canSubmit =
    Boolean(authEmail.trim()) &&
    (authMode === "forgot" ||
      (authMode === "reset" ? /^\\d{6}$/.test(authOtp) && Boolean(authPassword) : Boolean(authPassword) && (authMode !== "register" || Boolean(authName.trim()))));

  return (
    <main className="tm-command-landing min-h-screen overflow-hidden text-white">
      <div className="tm-command-noise pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="tm-command-glow tm-command-glow-one pointer-events-none" aria-hidden="true" />
      <div className="tm-command-glow tm-command-glow-two pointer-events-none" aria-hidden="true" />

      <nav className="tm-command-nav relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="tm-command-mark">MD</span>
          <div>
            <span className="block text-sm font-black tracking-[0.18em] text-white">MARTINDESK</span>
            <span className="block text-[9px] font-bold tracking-[0.2em] text-slate-500">WORK COMMAND CENTER</span>
          </div>
        </div>
        <div className="hidden items-center gap-8 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 md:flex">
          <a href="#system" className="transition hover:text-white">The system</a>
          <a href="#signals" className="transition hover:text-white">Signals</a>
          <a href="#workflow" className="transition hover:text-white">Workflow</a>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openAuth("login")} className="tm-command-ghost px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-300 transition hover:text-white">Sign in</button>
          <button type="button" onClick={() => openAuth("register")} className="tm-command-cta px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-950 transition hover:bg-lime-300">Sign up</button>
        </div>
      </nav>

      <section id="system" className="relative z-10 mx-auto grid w-full max-w-[1440px] gap-12 px-6 pb-20 pt-16 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-12 lg:pb-28 lg:pt-20">
        <div className="tm-command-copy">
          <div className="tm-command-kicker mb-7 inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">
            <span className="tm-live-dot" />
            Personal work operating system / 01
          </div>
          <h1 className="max-w-2xl text-6xl font-black leading-[0.9] tracking-[-0.07em] text-white sm:text-7xl lg:text-[7.2rem]">
            Work,<br />
            <span className="tm-command-outline">with intent.</span>
          </h1>
          <p className="mt-8 max-w-lg text-base leading-7 text-slate-400 sm:text-lg">
            MartinDesk is a quiet work floor for turning scattered requests into clear next moves. Capture the work, place it where it belongs, and keep momentum visible.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => openAuth("register")} className="tm-command-cta px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-950 transition hover:bg-lime-300">Open your desk <span className="ml-3 text-base">→</span></button>
            <a href="#workflow" className="tm-command-link text-xs font-black uppercase tracking-[0.16em] text-slate-400 transition hover:text-white">See the method <span className="ml-2 text-lime-300">↘</span></a>
          </div>
          <div className="mt-12 flex items-center gap-4 border-t border-white/10 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {workflowStages.map((stage, index) => (
              <span key={stage.id} className="contents">
                {index > 0 && <span className="h-px w-8 bg-white/20" />}
                <span className={activeStageIndex === index ? "text-lime-300" : ""}>{stage.number}</span>
                <span>{stage.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div id="signals" className="tm-command-stage relative">
          <div className="tm-stage-label absolute -left-2 top-4 z-20 hidden -rotate-90 text-[9px] font-black uppercase tracking-[0.28em] text-slate-600 sm:block">LIVE DESK / 09:41</div>
          <div className="tm-command-room tm-flow-room">
            <header className="tm-room-header flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="tm-room-indicator" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-lime-300">Workflow online</p>
                  <p className="mt-1 text-xs font-bold text-slate-300">One card / three clear places</p>
                </div>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">Live flow</span>
            </header>

            <div className="tm-flow-content p-5 lg:p-7">
              <div className="tm-flow-path" role="tablist" aria-label="MartinDesk workflow stages">
                {workflowStages.map((stage, index) => (
                  <button
                    key={stage.id}
                    type="button"
                    role="tab"
                    aria-selected={activeStageIndex === index}
                    className={`tm-flow-stage tm-flow-stage-${stage.tone} ${activeStageIndex === index ? "is-active" : ""}`}
                    onClick={() => setActiveStageIndex(index)}
                  >
                    <span className="tm-flow-stage-number">{stage.number}</span>
                    <span>
                      <span className="tm-flow-stage-label">{stage.label}</span>
                      <span className="tm-flow-stage-note">{stage.note}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="tm-flow-board">
                <div className="tm-flow-board-heading">
                  <span>Interactive demo flow</span>
                  <span>{activeStage.label} / ready</span>
                </div>
                <div className="tm-flow-track" aria-hidden="true"><span className="tm-flow-track-progress" style={{ width: `${activeStageIndex * 50}%` }} /></div>
                <div className="tm-flow-card" data-stage={activeStage.id}>
                  <div className="flex items-start gap-3">
                    <span className={`tm-task-marker tm-task-marker-${activeStage.tone} mt-1 h-2 w-2 shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Work card / {activeStage.label}</p>
                      <p className="mt-3 text-sm font-black text-slate-950">{workflowTask.title}</p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{workflowTask.code} / {workflowTask.detail}</p>
                    </div>
                    <span className="tm-flow-card-arrow" aria-hidden="true">-&gt;</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <span>{activeStage.note}</span>
                    <span className="text-blue-600">Click a stage</span>
                  </div>
                </div>
                <div className="tm-flow-signals">
                  {workflowSignals.map((signal) => (
                    <div key={signal.label} className="tm-flow-signal">
                      <span className={`tm-signal-bar tm-signal-${signal.tone} block h-1 w-7`} />
                      <span className="mt-3 block text-[11px] font-black text-slate-950">{signal.value}</span>
                      <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">{signal.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="tm-room-footer flex items-center justify-between border-t border-white/10 px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">
              <span>Work stays visible</span>
              <span className="text-lime-300">Intake -&gt; desk -&gt; done</span>
            </footer>
          </div>
          <div className="tm-command-stamp absolute -bottom-7 -right-3 hidden px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 sm:block">MD / BUILD WITH INTENT</div>
        </div>
      </section>

      <section id="workflow" className="relative z-10 mx-auto w-full max-w-[1440px] border-t border-white/10 px-6 py-10 lg:px-12 lg:py-12">
        <div className="grid gap-8 md:grid-cols-[0.7fr_1.3fr] md:items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">The MartinDesk method</p>
            <h2 className="mt-3 max-w-xs text-2xl font-black leading-tight tracking-[-0.04em] text-white">A better place for the work between the lines.</h2>
          </div>
          <div className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
            {workflow.map(([number, title, description]) => (
              <article key={number} className="tm-workflow-card bg-[#0b1424] p-5">
                <span className="text-[10px] font-black tracking-[0.16em] text-lime-300">{number}</span>
                <h3 className="mt-8 text-sm font-black uppercase tracking-[0.12em] text-white">{title}</h3>
                <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 py-6 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 lg:px-12">
        <span>MartinDesk / Built for meaningful momentum</span>
        <span className="flex items-center gap-2"><span className="tm-live-dot" /> Secure workspace access</span>
      </footer>

      {isOpen && (
        <div className="tm-auth-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onMouseDown={closeAuth}>
          <div className="tm-auth-modal tm-command-auth tm-pop-in relative w-full max-w-md p-5 sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={closeAuth} aria-label="Close authentication dialog" className="absolute right-4 top-4 px-2 py-1 text-lg leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-800">×</button>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">MartinDesk access</p>
            <h2 id="auth-modal-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950">{modalTitle}</h2>
            <p className="mt-2 text-sm leading-5 text-slate-500">{modalDescription}</p>
            {isPasswordAuthMode && <><button type="button" onClick={onGoogleLogin} className="tm-button-secondary mt-5 flex h-11 w-full items-center justify-center gap-2 px-4 text-sm font-bold text-slate-800">
              <span className="flex h-5 w-5 items-center justify-center border border-slate-200 text-xs font-black text-blue-600">G</span>
              Continue with Google
            </button>
            <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">or email</span><div className="h-px flex-1 bg-slate-200" /></div></>}
            <form onSubmit={onAuthSubmit}>
              {authMode === "register" && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">Name</span><input value={authName} onChange={(event) => onNameChange(event.target.value)} className="tm-input h-11 w-full border px-3 text-sm text-slate-900 outline-none" autoFocus /></label>}
              <label className={authMode === "register" ? "mt-4 block" : "mt-5 block"}><span className="mb-1.5 block text-xs font-bold text-slate-700">Email</span><input type="email" value={authEmail} onChange={(event) => onEmailChange(event.target.value)} className="tm-input h-11 w-full border px-3 text-sm text-slate-900 outline-none" autoFocus={authMode === "login" || authMode === "forgot"} /></label>
              {authMode === "reset" && <label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold text-slate-700">6-digit OTP</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={authOtp} onChange={(event) => onOtpChange(event.target.value.replace(/\\D/g, ""))} className="tm-input h-11 w-full border px-3 font-mono text-sm tracking-[0.25em] text-slate-900 outline-none" autoFocus /></label>}
              {authMode !== "forgot" && <label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold text-slate-700">{authMode === "reset" ? "New password" : "Password"}</span><input type="password" autoComplete={authMode === "reset" ? "new-password" : authMode === "register" ? "new-password" : "current-password"} value={authPassword} onChange={(event) => onPasswordChange(event.target.value)} className="tm-input h-11 w-full border px-3 text-sm text-slate-900 outline-none" /></label>}
              {error && <div className="mt-4 border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</div>}
              {notice && <div className="mt-4 border border-lime-200 bg-lime-50 px-3 py-2.5 text-sm font-medium text-lime-800">{notice}</div>}
              <button type="submit" disabled={isAuthenticating || !canSubmit} className="tm-button-primary mt-5 h-11 w-full px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isAuthenticating ? "Please wait" : authMode === "login" ? "Sign in to MartinDesk" : authMode === "register" ? "Create account" : authMode === "forgot" ? "Send reset OTP" : "Reset password"}</button>
            </form>
            {authMode === "login" && <button type="button" onClick={() => { onModeChange("forgot"); onErrorClear(); }} className="mt-3 w-full px-4 py-2 text-sm font-bold text-blue-600 transition hover:bg-blue-50">Forgot password?</button>}
            {(authMode === "forgot" || authMode === "reset") && <button type="button" onClick={() => { onModeChange(authMode === "reset" ? "forgot" : "login"); onErrorClear(); }} className="mt-3 w-full px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-blue-50 hover:text-blue-700">{authMode === "reset" ? "Request a new OTP" : "Back to sign in"}</button>}
            {isPasswordAuthMode && <button type="button" onClick={() => { onModeChange(authMode === "login" ? "register" : "login"); onErrorClear(); }} className="mt-3 w-full px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-blue-50 hover:text-blue-700">{authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button>}
          </div>
        </div>
      )}
    </main>
  );
}
