import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

// Logging in is optional: everyone can practise, logging in just saves your progress.
// These pages show saved data, so they need a login:
const LOGGED_IN_ONLY = ["/progress"];
// And these make no sense once you're logged in:
const LOGGED_OUT_ONLY = ["/login", "/signup"];

const matches = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

// Runs before every page request: refreshes the login session if it's about to expire,
// sends logged-out visitors from /progress to /login, and logged-in visitors away from the log-in pages.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      // A refreshed session has to reach both the page being rendered (request)
      // and the browser (response), or the two get out of sync.
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims() checks the login token's signature, so a forged cookie doesn't count
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (!isLoggedIn && matches(path, LOGGED_IN_ONLY)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isLoggedIn && matches(path, LOGGED_OUT_ONLY)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}
