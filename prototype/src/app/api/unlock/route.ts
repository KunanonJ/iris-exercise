export async function POST(req: Request) {
  const form = await req.formData();
  const pass = String(form.get("passcode") ?? "");
  const ok = !process.env.DEMO_PASSCODE || pass === process.env.DEMO_PASSCODE;
  const res = Response.redirect(new URL(ok ? "/" : "/unlock?e=1", req.url), 303);
  if (!ok) return res;
  const headers = new Headers(res.headers);
  headers.append("set-cookie", `demo_pass=${encodeURIComponent(pass)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`);
  return new Response(null, { status: 303, headers });
}
