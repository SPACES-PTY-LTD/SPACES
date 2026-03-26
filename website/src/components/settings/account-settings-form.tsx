"use client"

import * as React from "react"
import { Camera, LoaderCircle, Mail, Phone, ShieldCheck, User2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  uploadCurrentUserProfilePhoto,
  updateCurrentUserPassword,
  updateCurrentUserProfile,
} from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import { getCountryOptions } from "@/lib/geo-options"
import type { User } from "@/lib/types"

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim()
}

function getInitials(name: string | null | undefined) {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return "U"
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

type FormState = {
  name: string
  telephone: string
  accountCountryCode: string
}

type PasswordState = {
  currentPassword: string
  password: string
  confirmPassword: string
}

export function AccountSettingsForm({
  user,
  accessToken,
}: {
  user: User
  accessToken?: string
}) {
  const router = useRouter()
  const { update } = useSession()
  const countryOptions = React.useMemo(() => getCountryOptions(), [])
  const [saving, setSaving] = React.useState(false)
  const [photoSaving, setPhotoSaving] = React.useState(false)
  const [passwordSaving, setPasswordSaving] = React.useState(false)
  const [photoFile, setPhotoFile] = React.useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(
    user.profile_photo_url ?? null
  )
  const [values, setValues] = React.useState<FormState>({
    name: user.name ?? "",
    telephone: user.telephone ?? "",
    accountCountryCode: user.account_country_code ?? "ZA",
  })
  const [passwords, setPasswords] = React.useState<PasswordState>({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  })

  React.useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(user.profile_photo_url ?? null)
      return
    }

    const objectUrl = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [photoFile, user.profile_photo_url])

  const syncSessionUser = async (nextUser: User) => {
    await update({
      user: {
        name: nextUser.name,
        email: nextUser.email,
        role: nextUser.role,
        image: nextUser.profile_photo_url ?? null,
      },
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = normalizeText(values.name)
    const telephone = normalizeText(values.telephone)
    const accountCountryCode = values.accountCountryCode

    if (!name) {
      toast.error("Name is required.")
      return
    }

    setSaving(true)

    try {
      const response = await updateCurrentUserProfile(
        {
          name,
          telephone: telephone || null,
          ...(user.is_account_holder ? { account_country_code: accountCountryCode } : {}),
        },
        accessToken
      )

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to update your account.")
        return
      }

      setValues({
        name: response.name ?? "",
        telephone: response.telephone ?? "",
        accountCountryCode: response.account_country_code ?? accountCountryCode,
      })

      await syncSessionUser(response)

      toast.success("Account details updated.")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (
      !passwords.currentPassword ||
      !passwords.password ||
      !passwords.confirmPassword
    ) {
      toast.error("All password fields are required.")
      return
    }

    if (passwords.password.length < 8) {
      toast.error("New password must be at least 8 characters.")
      return
    }

    if (passwords.password !== passwords.confirmPassword) {
      toast.error("New password and confirmation do not match.")
      return
    }

    setPasswordSaving(true)

    try {
      const response = await updateCurrentUserPassword(
        {
          current_password: passwords.currentPassword,
          password: passwords.password,
          password_confirmation: passwords.confirmPassword,
        },
        accessToken
      )

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to update password.")
        return
      }

      setPasswords({
        currentPassword: "",
        password: "",
        confirmPassword: "",
      })

      toast.success("Password updated.")
    } finally {
      setPasswordSaving(false)
    }
  }

  const handlePhotoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!photoFile) {
      toast.error("Choose an image before uploading.")
      return
    }

    setPhotoSaving(true)

    try {
      const response = await uploadCurrentUserProfilePhoto(
        { photo: photoFile },
        accessToken
      )

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to upload profile photo.")
        return
      }

      setPhotoFile(null)
      setPhotoPreviewUrl(response.profile_photo_url ?? null)
      await syncSessionUser(response)

      toast.success("Profile photo updated.")
      router.refresh()
    } finally {
      setPhotoSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="items-center text-center">
            <Avatar className="size-24">
              <AvatarImage src={photoPreviewUrl ?? ""} alt={values.name || user.name} />
              <AvatarFallback>{getInitials(values.name || user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <CardTitle>{values.name || user.name}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <User2 className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Role</p>
                <p className="text-sm text-muted-foreground">
                  {user.role === "super_admin" ? "Super admin" : "Merchant user"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Mail className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Email address</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Phone className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Telephone</p>
                <p className="text-sm text-muted-foreground">
                  {values.telephone || "Not provided"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <ShieldCheck className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Account country</p>
                <p className="text-sm text-muted-foreground">
                  {user.is_account_holder ? values.accountCountryCode : "Managed by account holder"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile picture</CardTitle>
            <CardDescription>
              Upload a square image for the account menu and profile card.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handlePhotoSubmit}>
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-20">
                  <AvatarImage src={photoPreviewUrl ?? ""} alt={values.name || user.name} />
                  <AvatarFallback>{getInitials(values.name || user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="account-photo"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
                  >
                    <Camera />
                    Choose image
                  </Label>
                  <input
                    id="account-photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      setPhotoFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, or WebP up to 5MB.
                  </p>
                  {photoFile ? (
                    <p className="text-xs text-muted-foreground">
                      Selected: {photoFile.name}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-3 border-t pt-6">
              {photoFile ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPhotoFile(null)}
                  disabled={photoSaving}
                >
                  Reset
                </Button>
              ) : null}
              <Button type="submit" disabled={photoSaving || !photoFile}>
                {photoSaving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
                {photoSaving ? "Uploading..." : "Upload photo"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>
            Update your personal details used across the admin workspace.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="account-name">Full name</Label>
              <Input
                id="account-name"
                value={values.name}
                onChange={(event) =>
                  setValues((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Enter your full name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="account-telephone">Telephone</Label>
              <Input
                id="account-telephone"
                value={values.telephone}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    telephone: event.target.value,
                  }))
                }
                placeholder="Enter your telephone number"
              />
            </div>

            {user.is_account_holder ? (
              <div className="grid gap-2">
                <Label htmlFor="account-country">Account country</Label>
                <Select
                  value={values.accountCountryCode}
                  onValueChange={(value) =>
                    setValues((current) => ({
                      ...current,
                      accountCountryCode: value,
                    }))
                  }
                >
                  <SelectTrigger id="account-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This country controls account billing currency and gateway routing.
                </p>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end border-t pt-6">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </CardFooter>
        </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Change the password you use to sign in to the admin area.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="grid gap-6">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium">Security tip</p>
                <p className="text-sm text-muted-foreground">
                  Use at least 8 characters and avoid reusing a password from another service.
                </p>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="account-current-password">Current password</Label>
                <Input
                  id="account-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.currentPassword}
                  onChange={(event) =>
                    setPasswords((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  placeholder="Enter your current password"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="account-password">New password</Label>
                <Input
                  id="account-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.password}
                  onChange={(event) =>
                    setPasswords((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Enter your new password"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="account-password-confirmation">
                  Confirm new password
                </Label>
                <Input
                  id="account-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.confirmPassword}
                  onChange={(event) =>
                    setPasswords((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  placeholder="Confirm your new password"
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-6">
              <Button type="submit" disabled={passwordSaving}>
                {passwordSaving ? "Updating..." : "Update password"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
