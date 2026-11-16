import { timingSafeEqual, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createDocumentationSession, DOCUMENTATION_COOKIE, documentationPassword, safeDocumentationDestination, SESSION_SECONDS } from "@/lib/documentation/access";

export const runtime = "nodejs";
// A process-wide ceiling also prevents bypassing the limit with spoofed IP headers.
// Multi-instance deployments must additionally rate-limit this route at the ingress.
const attempts: number[] = [];
function response(body: object, status = 200) {
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
export async function POST(request: NextRequest) {
    if (request.headers.get("origin") !== request.nextUrl.origin) return response({ error: "Invalid request origin." }, 403);
    const password = documentationPassword();
    if (!password) return response({ error: "Documentation access is not configured. Please contact the team." }, 503);
    const now = Date.now();
    while (attempts.length && attempts[0] <= now - 60_000) attempts.shift();
    if (attempts.length >= 20) {
        const limited = response({ error: "Too many attempts. Please wait a minute and try again." }, 429);
        limited.headers.set("Retry-After", "60");
        return limited;
    }
    attempts.push(now);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return response({ error: "Invalid request." }, 400);
    // Bound streamed input, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return response({ error: "Enter your password." }, 400);
    let raw = "", size = 0;
    const decoder = new TextDecoder();
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 4096) { await reader.cancel(); return response({ error: "Invalid request." }, 413); }
            raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
        const body = JSON.parse(raw);
        if (typeof body.password !== "string" || body.password.length !== 8) return response({ error: "Incorrect password. Please try again." }, 401);
        const digest = (value: string) => createHash("sha256").update(value).digest();
        if (!timingSafeEqual(digest(body.password), digest(password))) return response({ error: "Incorrect password. Please try again." }, 401);
        const result = response({ destination: safeDocumentationDestination(body.next) });
        result.cookies.set(DOCUMENTATION_COOKIE, await createDocumentationSession(password), {
            httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS,
        });
        return result;
    } catch { return response({ error: "Invalid request. Please try again." }, 400); }
}
