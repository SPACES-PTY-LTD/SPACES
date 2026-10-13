"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function DriverAvatar({ name, photoUrl, size = "default" }: {
  name?: string | null
  photoUrl?: string | null
  size?: "sm" | "default" | "lg"
}) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
  const initials = words.length > 1
    ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
    : words[0]?.slice(0, 2).toUpperCase() || "DR"

  return (
    <Avatar size={size}>
      <AvatarImage src={photoUrl?.trim() || undefined} alt={name ? `${name} profile photo` : "Driver profile photo"} className="object-cover" />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
