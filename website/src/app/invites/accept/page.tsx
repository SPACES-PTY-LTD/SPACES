import { redirect } from "next/navigation"

type LegacyInvitePageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

export default async function LegacyInvitePage({
  searchParams,
}: LegacyInvitePageProps) {
  const params = (await searchParams) ?? {}
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  redirect(token ? `/auth/invites?token=${encodeURIComponent(token)}` : "/auth/invites")
}
