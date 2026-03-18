import type { MerchantAccessRole, MerchantPerson } from "@/lib/types"

export const merchantUserRoleOptions: Array<{
  value: MerchantAccessRole
  label: string
  description: string
}> = [
  {
    value: "member",
    label: "Member",
    description: "Full access to merchant resources and user management.",
  },
  {
    value: "modifier",
    label: "Modifier",
    description: "Can read, create, and update resources, but cannot delete.",
  },
  {
    value: "biller",
    label: "Biller",
    description: "Can access merchant billing settings only.",
  },
  {
    value: "resource_viewer",
    label: "Resource Viewer",
    description: "Read-only access to merchant resources.",
  },
]

export function formatMerchantUserRole(role: MerchantAccessRole | null | undefined) {
  if (!role) return "Unknown"

  const option = merchantUserRoleOptions.find((item) => item.value === role)
  if (option) return option.label

  return role
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export function formatMerchantPersonName(person: MerchantPerson) {
  return person.name?.trim() || person.email
}
