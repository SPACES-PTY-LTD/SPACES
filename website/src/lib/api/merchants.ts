import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type {
  AcceptMerchantInviteResponse,
  ApiEnvelope,
  ApiListResponse,
  Merchant,
  MerchantEnvironment,
  MerchantInvite,
  MerchantInvitePreview,
  MerchantMember,
  MerchantPerson,
  MerchantAccessRole,
  User,
} from "@/lib/types"

export async function listMerchants(
  token?: string | null,
  params?: { page?: number; per_page?: number }
) {
  return apiFetch<ApiListResponse<Merchant>>("/api/v1/merchants", {
    token,
    params,
  })
}

export async function getCurrentUserProfile(token?: string | null) {
  const response = await apiFetch<ApiEnvelope<User>>("/api/v1/me", {
    token,
  })

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function updateLastAccessedMerchant(
  merchantId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<User>>(
    "/api/v1/me/last-accessed-merchant",
    {
      method: "PATCH",
      body: { merchant_id: merchantId },
      token,
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function updateCurrentUserProfile(
  payload: { name?: string; telephone?: string | null; account_country_code?: string },
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<User>>("/api/v1/me", {
    method: "PATCH",
    body: payload,
    token,
  })

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function updateCurrentUserPassword(
  payload: {
    current_password: string
    password: string
    password_confirmation: string
  },
  token?: string | null
) {
  return apiFetch<ApiEnvelope<{ message: string }>>("/api/v1/me/password", {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function uploadCurrentUserProfilePhoto(
  payload: { photo: File },
  token?: string | null
) {
  const formData = new FormData()
  formData.append("photo", payload.photo)

  const response = await apiFetch<ApiEnvelope<User>>("/api/v1/me/profile-photo", {
    method: "POST",
    body: formData,
    token,
  })

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function getMerchant(merchantId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<Merchant>>(
    `/api/v1/merchants/${merchantId}`,
    { token }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createMerchant(
  payload: Partial<Merchant>,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<Merchant>>("/api/v1/merchants", {
    method: "POST",
    body: payload,
    token,
  })

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function updateMerchant(
  merchantId: string,
  payload: Partial<Merchant>,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<Merchant>>(`/api/v1/merchants/${merchantId}`, {
    method: "PATCH",
    body: payload,
    token,
  })

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export type UpdateMerchantSettingsPayload = {
  timezone?: string | null
  operating_countries?: string[] | null
  allow_auto_shipment_creations_at_locations?: boolean
  setup_completed_at?: string | null
}

export async function updateMerchantSettings(
  merchantId: string,
  payload: UpdateMerchantSettingsPayload,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<Merchant>>(
    `/api/v1/merchants/${merchantId}/settings`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function uploadMerchantLogo(
  merchantId: string,
  payload: { logo: File },
  token?: string | null
) {
  const formData = new FormData()
  formData.append("logo", payload.logo)

  const response = await apiFetch<ApiEnvelope<Merchant>>(
    `/api/v1/merchants/${merchantId}/logo`,
    {
      method: "POST",
      body: formData,
      token,
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function deleteMerchant(
  merchantId: string,
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/merchants/${merchantId}`, {
    method: "DELETE",
    token,
  })
}

export async function listMerchantMembers(
  merchantId: string,
  token?: string | null,
  params?: { page?: number }
) {
  return apiFetch<ApiListResponse<MerchantMember>>(
    `/api/v1/merchants/${merchantId}/members`,
    { token, params }
  )
}

export async function inviteMerchantMember(
  merchantId: string,
  payload: { email: string; role: string },
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/merchants/${merchantId}/members/invite`,
    {
      method: "POST",
      body: payload,
      token,
    }
  )
}

export async function updateMerchantMember(
  merchantId: string,
  userId: string,
  payload: { role?: string; status?: string },
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/merchants/${merchantId}/members/${userId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}

export async function removeMerchantMember(
  merchantId: string,
  userId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/merchants/${merchantId}/members/${userId}`,
    {
      method: "DELETE",
      token,
    }
  )
}

export async function listMerchantInvites(
  merchantId: string,
  token?: string | null,
  params?: { page?: number }
) {
  return apiFetch<ApiListResponse<MerchantInvite>>(
    `/api/v1/merchants/${merchantId}/invites`,
    { token, params }
  )
}

export async function listMerchantUsers(
  merchantId: string,
  token?: string | null,
  params?: { page?: number; sort_by?: string; sort_dir?: "asc" | "desc" }
) {
  return apiFetch<ApiListResponse<MerchantPerson>>(
    `/api/v1/merchants/${merchantId}/users`,
    { token, params }
  )
}

export async function getMerchantUser(
  merchantId: string,
  personId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<MerchantPerson>>(
    `/api/v1/merchants/${merchantId}/users/${personId}`,
    { token }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function inviteMerchantUser(
  merchantId: string,
  payload: { email: string; role: MerchantAccessRole },
  token?: string | null
) {
  return apiFetch<ApiEnvelope<MerchantPerson>>(`/api/v1/merchants/${merchantId}/users`, {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateMerchantUser(
  merchantId: string,
  personId: string,
  payload: { role?: MerchantAccessRole; name?: string; telephone?: string | null },
  token?: string | null
) {
  return apiFetch<ApiEnvelope<MerchantPerson>>(
    `/api/v1/merchants/${merchantId}/users/${personId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}

export async function deleteMerchantUser(
  merchantId: string,
  personId: string,
  token?: string | null
) {
  return apiFetch(`/api/v1/merchants/${merchantId}/users/${personId}`, {
    method: "DELETE",
    token,
  })
}

export async function resendMerchantUserInvite(
  merchantId: string,
  personId: string,
  token?: string | null
) {
  return apiFetch<ApiEnvelope<MerchantPerson>>(
    `/api/v1/merchants/${merchantId}/users/${personId}/resend`,
    {
      method: "POST",
      token,
    }
  )
}

export async function acceptMerchantInvite(payload: {
  token: string
  name?: string
  password?: string
  password_confirmation?: string
}) {
  return apiFetch<ApiEnvelope<AcceptMerchantInviteResponse>>(
    "/api/v1/merchant-invites/accept",
    {
      method: "POST",
      body: payload,
    }
  )
}

export async function previewMerchantInvite(token: string) {
  return apiFetch<ApiEnvelope<MerchantInvitePreview>>("/api/v1/merchant-invites/preview", {
    params: { token },
  })
}

export async function resendMerchantInvite(
  merchantId: string,
  inviteId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/merchants/${merchantId}/invites/${inviteId}/resend`,
    { method: "POST", token }
  )
}

export async function revokeMerchantInvite(
  merchantId: string,
  inviteId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/merchants/${merchantId}/invites/${inviteId}/revoke`,
    { method: "POST", token }
  )
}

export async function listMerchantEnvironments(
  merchantId: string,
  token?: string | null,
  params?: { page?: number }
) {
  return apiFetch<ApiListResponse<MerchantEnvironment>>(
    `/api/v1/merchants/${merchantId}/environments`,
    { token, params }
  )
}

export async function createMerchantEnvironment(
  merchantId: string,
  payload: Partial<MerchantEnvironment>,
  token?: string | null
) {
  return apiFetch<MerchantEnvironment>(
    `/api/v1/merchants/${merchantId}/environments`,
    {
      method: "POST",
      body: payload,
      token,
    }
  )
}

export async function getMerchantEnvironment(
  merchantId: string,
  environmentId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<MerchantEnvironment>>(
    `/api/v1/merchants/${merchantId}/environments/${environmentId}`,
    { token }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function updateMerchantEnvironment(
  merchantId: string,
  environmentId: string,
  payload: Partial<MerchantEnvironment>,
  token?: string | null
) {
  return apiFetch<MerchantEnvironment>(
    `/api/v1/merchants/${merchantId}/environments/${environmentId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}

export async function deleteMerchantEnvironment(
  merchantId: string,
  environmentId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/merchants/${merchantId}/environments/${environmentId}`,
    { method: "DELETE", token }
  )
}

export async function rotateEnvironmentToken(
  merchantId: string,
  environmentId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/merchants/${merchantId}/environments/${environmentId}/token`,
    { method: "POST", token }
  )
}
