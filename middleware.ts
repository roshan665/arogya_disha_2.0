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

  // Helper to normalize user role
  const rawRole = user?.user_metadata?.role;
  const isPatient = !rawRole || rawRole.toLowerCase() === 'patient';
  const isAsha = rawRole === 'ASHA' || rawRole === 'asha_worker' || rawRole === 'asha' || rawRole === 'anm';
  const isPhcOrDH = rawRole === 'PHC' || rawRole === 'DISTRICT_HOSPITAL' || rawRole === 'mo_doctor' || rawRole === 'specialist' || rawRole === 'phc_doctor' || rawRole === 'dh_specialist';
  const isAdmin = rawRole === 'admin' || rawRole === 'system_admin';

  // 1. Root '/' Route Redirection:
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    if (user) {
      if (isPhcOrDH) url.pathname = '/doctor';
      else if (isAdmin) url.pathname = '/admin';
      else if (isAsha) url.pathname = '/asha';
      else url.pathname = '/patient';
    } else {
      url.pathname = '/patient';
    }
    return NextResponse.redirect(url);
  }

  // 2. Profile Status Check & Onboarding Enforcement for authenticated users
  if (user && (pathname.startsWith('/doctor') || pathname.startsWith('/asha') || pathname.startsWith('/onboarding'))) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_status, role')
        .eq('id', user.id)
        .maybeSingle();

      const isProfileComplete = profile?.profile_status === 'PROFILE_COMPLETE';

      // If user is accessing /onboarding but already completed profile -> redirect to dashboard
      if (pathname.startsWith('/onboarding')) {
        if (isProfileComplete) {
          const dashUrl = request.nextUrl.clone();
          if (isPhcOrDH) dashUrl.pathname = '/doctor';
          else if (isAdmin) dashUrl.pathname = '/admin';
          else if (isAsha) dashUrl.pathname = '/asha';
          else dashUrl.pathname = '/patient';
          return NextResponse.redirect(dashUrl);
        }
        return supabaseResponse;
      }

      // If accessing protected staff dashboards with incomplete profile -> redirect to /onboarding
      if (!isProfileComplete && (pathname.startsWith('/doctor') || pathname.startsWith('/asha'))) {
        const onboardingUrl = request.nextUrl.clone();
        onboardingUrl.pathname = '/onboarding';
        return NextResponse.redirect(onboardingUrl);
      }
    } catch (e) {
      console.warn('Middleware profile status check:', e);
    }
  }

  // 3. Strict Server-Side Role-Based Route Guards:
  // Protect /doctor route (Only PHC Medical Officers & District Hospital Specialists)
  if (pathname.startsWith('/doctor')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isPhcOrDH) {
      const fallbackUrl = request.nextUrl.clone();
      fallbackUrl.pathname = isPatient ? '/patient' : '/asha';
      return NextResponse.redirect(fallbackUrl);
    }
  }

  // Protect /asha route (Only authorized ASHA workers / ANMs)
  if (pathname.startsWith('/asha')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAsha) {
      const fallbackUrl = request.nextUrl.clone();
      fallbackUrl.pathname = isPatient ? '/patient' : '/doctor';
      return NextResponse.redirect(fallbackUrl);
    }
  }

  // Protect /admin route (Only System Admins)
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdmin) {
      const fallbackUrl = request.nextUrl.clone();
      fallbackUrl.pathname = isPatient ? '/patient' : '/asha';
      return NextResponse.redirect(fallbackUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/',
    '/asha/:path*',
    '/doctor/:path*',
    '/admin/:path*',
    '/patient/:path*',
    '/onboarding/:path*',
  ],
};
