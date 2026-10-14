// Best-effort, per-instance limiter so a public demo link can't run up the
// API bill. Production uses the platform's gateway limits per SSO identity.
const hits = new Map<string, number[]>();
let day = new Date().toDateString();
let dailyCount = 0;

export function allow(key: string, perMinute = 12): boolean {
  const today = new Date().toDateString();
  if (today !== day) {
    day = today;
    dailyCount = 0;
  }
  const cap = Number(process.env.DAILY_LIMIT ?? 1500);
  if (dailyCount >= cap) return false;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) return false;
  recent.push(now);
  hits.set(key, recent);
  dailyCount++;
  return true;
}

export const clientKey = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
