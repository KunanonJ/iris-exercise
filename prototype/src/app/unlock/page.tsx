import Link from "next/link";

export default function Unlock() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <section className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-lg font-semibold text-brand">Learning Suite · Prototype</h1>
        <p className="text-sm text-ink-2">The shared demo passcode has been retired. Use your assigned Clerk account on the home page.</p>
        <p className="text-sm text-ink-2" lang="th">ยกเลิกรหัสผ่านร่วมของเดโมแล้ว โปรดเข้าสู่ระบบด้วยบัญชี Clerk ของคุณที่หน้าหลัก</p>
        <Link href="/" className="inline-block rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white">Go to sign-in · เข้าสู่ระบบ</Link>
      </section>
    </main>
  );
}
