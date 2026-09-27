import { Lock } from "lucide-react";

export function LoginForm({ invalid = false }: { invalid?: boolean }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <Lock className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-center text-xl font-bold">Admin access only</h1>
      <p className="mt-1 text-center text-sm text-slate-500">Enter the admin password to view results and create reports.</p>
      <form action="/api/admin/login" method="post" className="mt-6 space-y-3">
        <input
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Admin password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {invalid && <p className="text-sm text-red-600" role="alert">Incorrect password. Please try again.</p>}
        <button className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700">
          Sign in
        </button>
      </form>
      {!process.env.ADMIN_PASSWORD && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Demo password: <code className="rounded bg-slate-100 px-1.5 py-0.5">admin123</code>
        </p>
      )}
    </div>
  );
}
