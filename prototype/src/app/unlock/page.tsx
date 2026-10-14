import { UnlockError } from "./UnlockError";

export default function Unlock() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <form action="/api/unlock" method="post" className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-lg font-semibold text-brand">Learning Suite · Prototype</h1>
        <p className="text-sm text-ink-2">Enter the passcode from the submission email. Mock data only.</p>
        <input name="passcode" type="password" autoFocus required className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
        <UnlockError />
        <button className="w-full rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white">Open</button>
      </form>
    </main>
  );
}
