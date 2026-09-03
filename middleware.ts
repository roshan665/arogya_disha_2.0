import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iwinomhcofhouapfirjo.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3aW5vbWhjb2Zob3VhcGZpcmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNDM1OTgsImV4cCI6MjEwMzkxOTU5OH0.Vm5RHwbzKTlbyw8RiU92HqMdfIaMMFtnpAcCPSRw_uE';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Root '/' Route Redirection:
  // If user accesses '/', redirect them to their specific role dashboard (or /patient by default if guest)
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    if (user) {
      const userRole = user.user_metadata?.role || 'asha_worker';
      if (userRole === 'mo_doctor') url.pathname = '/doctor';
      else if (userRole === 'admin') url.pathname = '/admin';
      else if (userRole === 'patient') url.pathname = '/patient';
      else url.pathname = '/asha';
    } else {
      url.pathname = '/patient';
    }
    return NextResponse.redirect(url);
  }

  // Allow direct access to /patient, /asha, /doctor, /admin without cross-route forced redirects
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/',
    '/asha/:path*',
    '/doctor/:path*',
    '/admin/:path*',
    '/patient/:path*',
  ],
};
