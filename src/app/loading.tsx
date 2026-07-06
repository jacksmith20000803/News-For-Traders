export default function Loading() {
  return (
    <div className="auth-market-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="relative z-10 flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-white/85 px-5 py-4 text-sm font-semibold text-slate-700 shadow-2xl shadow-sky-950/10 backdrop-blur dark:border-cyan-300/15 dark:bg-[#0a0c0c]/85 dark:text-cyan-50 dark:shadow-black/40">
        <span className="relative flex h-5 w-5 items-center justify-center rounded-full" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border border-sky-300/25 dark:border-sky-300/20" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-sky-300 border-t-sky-500 shadow-[0_0_14px_rgba(56,189,248,0.6)] dark:border-r-sky-200 dark:border-t-cyan-400" />
          <span className="h-2 w-2 rounded-full bg-sky-500/20 ring-1 ring-sky-400/35 dark:bg-cyan-300/20 dark:ring-cyan-200/30" />
        </span>
        Loading
      </div>
    </div>
  );
}
