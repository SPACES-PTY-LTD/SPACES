import { NextResponse } from "next/server"

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://api.example.com"

type RegisterPayload = {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  const requestOrigin = request.headers.get("origin")
  const requestReferer = request.headers.get("referer")
  let payload: RegisterPayload

  try {
    payload = (await request.json()) as RegisterPayload
  } catch {
    console.error("[auth/register] Invalid JSON payload", {
      requestId,
    })
    return NextResponse.json(
      {
        error: {
          message: "Invalid JSON payload.",
        },
      },
      { status: 400 }
    )
  }

  console.info("[auth/register] Proxy request started", {
    requestId,
    email: payload.email,
    origin: requestOrigin,
    referer: requestReferer,
    upstreamUrl: `${API_BASE_URL}/api/v1/auth/register`,
  })

  const upstream = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error("[auth/register] Upstream fetch failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  })

  if (!upstream) {
    return NextResponse.json(
      {
        error: {
          message: "Registration service is unavailable.",
        },
      },
      { status: 502 }
    )
  }

  const bodyText = await upstream.text()
  const contentType = upstream.headers.get("content-type") ?? "application/json"
  const upstreamHeaders = Object.fromEntries(upstream.headers.entries())
  const accessControlAllowOrigin =
    upstream.headers.get("access-control-allow-origin")
  const accessControlAllowMethods =
    upstream.headers.get("access-control-allow-methods")
  const accessControlAllowHeaders =
    upstream.headers.get("access-control-allow-headers")
  const hasCorsHeaders = Boolean(
    accessControlAllowOrigin ||
      accessControlAllowMethods ||
      accessControlAllowHeaders
  )
  const isOriginAllowed =
    requestOrigin && accessControlAllowOrigin
      ? accessControlAllowOrigin === "*" ||
        accessControlAllowOrigin === requestOrigin
      : null

  console.info("[auth/register] Proxy response received", {
    requestId,
    status: upstream.status,
    ok: upstream.ok,
    contentType,
    upstreamHeaders,
    upstreamBody: bodyText,
    cors: {
      requestOrigin,
      accessControlAllowOrigin,
      accessControlAllowMethods,
      accessControlAllowHeaders,
      hasCorsHeaders,
      isOriginAllowed,
    },
    durationMs: Date.now() - startedAt,
  })

  return new NextResponse(bodyText, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
    },
  })
}
