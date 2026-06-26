export default function Loading() {
  return (
    <div className="auth-market-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="relative z-10 flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-white/80 px-5 py-4 text-sm font-semibold text-gray-700 shadow-2xl backdrop-blur dark:bg-[#0a0c0c]/85 dark:text-cyan-50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        Loading
      </div>
    </div>
  );
}
