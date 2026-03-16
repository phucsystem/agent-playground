import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const ACTIVITY_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serviceClient: ReturnType<typeof createClient<any>> | null = null;

function getServiceClient() {
  if (!serviceClient) {
    serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return serviceClient;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPage = pathname === "/login" || pathname === "/setup";

  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  if (user) {
    const sessionRecordId = request.cookies.get("session_record_id")?.value;
    if (sessionRecordId) {
      const fiveMinutesAgo = new Date(
        Date.now() - ACTIVITY_DEBOUNCE_MS
      ).toISOString();
      Promise.resolve(
        getServiceClient()
          .from("user_sessions")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", sessionRecordId)
          .lt("last_active_at", fiveMinutesAgo)
      ).catch(() => {});
    }
  }

  return supabaseResponse;
}
