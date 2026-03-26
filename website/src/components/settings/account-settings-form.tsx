"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  updateCurrentUserPassword,
  updateCurrentUserProfile,
} from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import { getCountryOptions } from "@/lib/geo-options"
import type { User } from "@/lib/types"

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim()
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
  const [passwordSaving, setPasswordSaving] = React.useState(false)
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

      await update({
        user: {
          name: response.name,
          email: response.email,
          role: response.role,
        },
      })

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

  return (
    <div className="grid gap-6">
      <Card className="max-w-3xl">
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
              <Label htmlFor="account-email">Email address</Label>
              <Input
                id="account-email"
                type="email"
                value={user.email ?? ""}
                readOnly
                disabled
              />
              <p className="text-sm text-muted-foreground">
                Email address changes are not available here.
              </p>
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

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Profile image</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Image upload is not available yet because the user avatar API has
                not been added on the backend.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t pt-6">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change the password you use to sign in to the admin area.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordSubmit}>
          <CardContent className="grid gap-6">
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
  )
}
