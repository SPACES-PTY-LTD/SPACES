type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"

export type ApiRequestOptions = {
  method?: HttpMethod
  body?: unknown
  token?: string | null
  refreshToken?: string | null
  params?: Record<string, string | number | boolean | undefined>
  headers?: HeadersInit
  cache?: RequestCache
  tags?: string[]
}

export type ApiErrorResponse = {
  error: true
  message: string
  status?: number
  data?: unknown
  payload?: unknown
}

export type ApiResult<T> = T | ApiErrorResponse

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(value && typeof value === "object" && (value as { error?: unknown }).error === true)
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.example.com"

type RefreshTokenResponse = {
  success?: boolean
  data?: {
    token?: string
    refresh_token?: string
    expires_in?: number
  }
}

function buildUrl(path: string, params?: ApiRequestOptions["params"]) {
  const url = new URL(path, API_BASE_URL)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    })
  }
  return url.toString()
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
  retry = true
): Promise<ApiResult<T>> {
  const response = await performApiFetch<T>(path, options)
  if (
    isApiErrorResponse(response) &&
    response.status === 401 &&
    retry &&
    typeof window !== "undefined"
  ) {
    const refreshedToken = await refreshBrowserAccessToken(options.refreshToken)
    if (refreshedToken) {
      return apiFetch<T>(
        path,
        {
          ...options,
          token: refreshedToken,
        },
        false
      )
    }
  }

  return response
}

async function performApiFetch<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResult<T>> {
  const url = buildUrl(path, options.params)
  const headers = new Headers(options.headers)
  const resolvedToken =
    typeof window !== "undefined"
      ? (await resolveBrowserAccessToken(options.token)) ?? options.token
      : options.token

  if (resolvedToken) {
    headers.set("Authorization", `Bearer ${resolvedToken}`)
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  const payloadBody = options.body && !(options.body instanceof FormData)
          ? JSON.stringify(options.body)
          : (options.body as BodyInit | null);

  // console.log("!!!!!!!!API Request:", { url, options, payloadBody })

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      body: payloadBody,
      headers,
      cache: options.cache ?? "no-store",
      next: options.tags ? { tags: options.tags } : undefined,
    })
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Request failed.",
    }
  }

  // console.log("!!!!!!!!API response:", response);

  if (!response.ok) {
    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      console.error("Failed to parse error response as JSON", { error, response })
      payload = await response.text().catch(() => "")
    }

    let message = "Request failed url:" + url + ", status:" + response.status
    if (payload && typeof payload === "object") {
      const maybeError = (payload as { error?: { message?: unknown } }).error
      if (typeof maybeError?.message === "string") {
        message = maybeError.message
      } else if (typeof (payload as { message?: unknown }).message === "string") {
        message = (payload as { message?: string }).message ?? message
      }
    } else if (typeof payload === "string" && payload.trim().length > 0) {
      message = payload
    }

    console.log("!!!!!!!!API message:", message);

    return { error: true, message, status: response.status, payload }
  }

  if (response.status === 204) {
    return null as T
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return (await response.json()) as T
  }

  if (
    contentType.includes("application/pdf") ||
    contentType.includes("application/octet-stream")
  ) {
    return (await response.blob()) as T
  }

  return (await response.text()) as T
}

export async function apiFetchWithAuth<T>(
  path: string,
  options: ApiRequestOptions = {},
  retry = true
): Promise<ApiResult<T>> {
  return apiFetch<T>(path, options, retry)
}

let refreshRequest: Promise<string | null> | null = null

async function resolveBrowserAccessToken(
  token?: string | null
): Promise<string | null> {
  const { getStoredAuthTokens } = await import("@/lib/auth-session-manager")
  return getStoredAuthTokens().accessToken ?? token ?? null
}

async function refreshBrowserAccessToken(
  providedRefreshToken?: string | null
): Promise<string | null> {
  if (refreshRequest) {
    return refreshRequest
  }

  refreshRequest = performBrowserTokenRefresh(providedRefreshToken)

  try {
    return await refreshRequest
  } finally {
    refreshRequest = null
  }
}

async function performBrowserTokenRefresh(
  providedRefreshToken?: string | null
): Promise<string | null> {
  const [{ getStoredAuthTokens, logoutStoredSession, updateStoredSession }, auth] =
    await Promise.all([
      import("@/lib/auth-session-manager"),
      import("next-auth/react"),
    ])

  const session = await auth.getSession()
  const refreshToken =
    providedRefreshToken ??
    getStoredAuthTokens().refreshToken ??
    session?.refreshToken ??
    null

  if (!refreshToken) {
    await logoutStoredSession()
    return null
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    })
  } catch {
    await logoutStoredSession()
    return null
  }

  if (!response.ok) {
    await logoutStoredSession()
    return null
  }

  const payload = (await response.json()) as RefreshTokenResponse
  const nextAccessToken = payload.data?.token ?? null
  const nextRefreshToken = payload.data?.refresh_token ?? refreshToken

  if (!nextAccessToken) {
    await logoutStoredSession()
    return null
  }

  await updateStoredSession({
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    authError: undefined,
  })

  return nextAccessToken
}
