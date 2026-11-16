// Shared by middleware and server handlers; never import this module into client components.
export const DOCUMENTATION_COOKIE = "spaces_documentation";
export const SESSION_SECONDS = 3600;
export function documentationPassword() {
    const value = process.env.DOCUMENTATION_PASSWORD;
    return value && /^[\x21-\x7e]{8}$/.test(value) ? value : null;
}
export function protectedDocumentationPath(path: string) {
    return path === "/docs" || path.startsWith("/docs/") || path === "/platform/integrations" || path.startsWith("/platform/integrations/");
}
export function safeDocumentationDestination(value: string | null | undefined) {
    if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return "/platform/integrations";
    const url = new URL(value, "https://local.invalid");
    return url.origin === "https://local.invalid" && protectedDocumentationPath(url.pathname) ? url.pathname + url.search : "/platform/integrations";
}
async function key(password: string) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(`spaces-documentation-v1:${password}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function createDocumentationSession(password: string, now = Date.now()) {
    const expires = String(Math.floor(now / 1000) + SESSION_SECONDS);
    const signature = await crypto.subtle.sign("HMAC", await key(password), new TextEncoder().encode(expires));
    return `${expires}.${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
export async function validDocumentationSession(token: string | undefined, password: string | null, now = Date.now()) {
    if (!token || !password || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
    const [expires, signature] = token.split(".");
    const seconds = Math.floor(now / 1000);
    if (Number(expires) <= seconds || Number(expires) > seconds + SESSION_SECONDS) return false;
    return crypto.subtle.verify("HMAC", await key(password), Uint8Array.from(signature.match(/../g)!, byte => parseInt(byte, 16)), new TextEncoder().encode(expires));
}
