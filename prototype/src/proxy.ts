import { NextResponse, type NextRequest } from "next/server";

// Unlisted demo: a shared passcode keeps the link from being casually opened
// and protects the API budget. Disabled when DEMO_PASSCODE is unset.
export function proxy(req: NextRequest) {
  const pass = process.env.DEMO_PASSCODE;
  if (!pass || req.cookies.get("demo_pass")?.value === pass) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Locked" }, { status: 401 });
  return NextResponse.redirect(new URL("/unlock", req.url));
}

export const config = {
  matcher: ["/((?!unlock|api/unlock|_next/static|_next/image|favicon.ico).*)"],
};
