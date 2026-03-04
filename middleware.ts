import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PAGES = ['/botadmin/dashboard', '/botadmin/prompts'];
const PROTECTED_API = '/api/admin/';
const LOGIN_PAGE = '/botadmin';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect admin pages (not login page itself) and admin APIs (not /api/track)
  const isProtectedPage = PROTECTED_PAGES.some(p => pathname.startsWith(p));
  const isProtectedAPI = pathname.startsWith(PROTECTED_API) &&
    !pathname.startsWith('/api/admin/login') &&
    !pathname.startsWith('/api/admin/logout');

  if (!isProtectedPage && !isProtectedAPI) return NextResponse.next();

  const token = request.cookies.get('admin-token')?.value;
  if (!token) {
    if (isProtectedAPI) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL(LOGIN_PAGE, request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (isProtectedAPI) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL(LOGIN_PAGE, request.url));
  }
}

export const config = {
  matcher: ['/botadmin/:path+', '/api/admin/:path*'],
};
