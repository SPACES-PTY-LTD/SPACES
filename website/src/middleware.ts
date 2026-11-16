import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTATION_COOKIE, documentationPassword, validDocumentationSession } from "./lib/documentation/access";

// Next.js src/app projects discover middleware in src. Keep the matcher scoped
// to documentation so existing admin and authentication routing is unchanged.
export async function middleware(request: NextRequest) {
    const authorized = await validDocumentationSession(request.cookies.get(DOCUMENTATION_COOKIE)?.value, documentationPassword());
    let response: NextResponse;
    if (authorized) {
        response = NextResponse.next();
    } else {
        const gate = new URL("/documentation-access", request.url);
        gate.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
        response = NextResponse.redirect(gate);
    }
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
}
export const config = { matcher: ["/docs/:path*", "/platform/integrations/:path*"] };
