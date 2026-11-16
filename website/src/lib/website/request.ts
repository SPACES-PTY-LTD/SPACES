import { apiFetch, isApiErrorResponse } from "@/lib/api/client";
export class WebsiteRequestError extends Error {
    constructor(message: string, public status?: number, public fields: Record<string, string[]> = {}) { super(message); }
}
export async function websiteRequest<T>(
    path: string,
    token?: string,
    method: "GET" | "POST" | "PATCH" = "GET",
    body?: unknown,
): Promise<T> {
    const result = await apiFetch<{ data: T }>(`/api/v1/${path}`, {
        token,
        method,
        body,
        headers: { Accept: "application/json" },
    });
    if (isApiErrorResponse(result)) {
        const payload = result.payload as { errors?: Record<string, string[]>; error?: { details?: Record<string, string[]> } } | undefined;
        throw new WebsiteRequestError(result.message, result.status, payload?.errors ?? payload?.error?.details ?? {});
    }
    return result.data;
}
