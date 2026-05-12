import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png|sdvosb.jpg|sw.js|offline.html|preview|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// /login/demo is handled inside updateSession (public, no auth required)
// Add new public paths there, not here — the matcher only controls which
// requests Next.js routes through the middleware at all.
