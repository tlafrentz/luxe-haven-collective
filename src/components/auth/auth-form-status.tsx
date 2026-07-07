import type { AuthActionState } from "@/app/actions/auth";

export function AuthFormStatus({ state }: { state?: AuthActionState }) {
  if (!state?.message) return null;
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
      {state.message}
    </div>
  );
}
