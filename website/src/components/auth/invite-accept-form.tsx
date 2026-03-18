"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { signIn } from "next-auth/react"
import { acceptMerchantInvite } from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import { AdminLinks } from "@/lib/routes/admin"
import type { MerchantInvitePreview } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const schema = z
  .object({
    name: z.string().optional(),
    password: z.string().optional(),
    password_confirmation: z.string().optional(),
  })
  .superRefine((values, context) => {
    const hasPassword = Boolean(values.password)
    const hasPasswordConfirmation = Boolean(values.password_confirmation)
    const hasName = Boolean(values.name?.trim())

    if (hasPassword || hasPasswordConfirmation || hasName) {
      if (!hasName) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter your full name",
          path: ["name"],
        })
      }

      if (!values.password || values.password.length < 8) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must be at least 8 characters",
          path: ["password"],
        })
      }

      if (values.password !== values.password_confirmation) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match",
          path: ["password_confirmation"],
        })
      }
    }
  })

type FormValues = z.infer<typeof schema>

type InviteAcceptFormProps = {
  token?: string
  preview?: MerchantInvitePreview | null
}

function getInviteRequirementError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const details = (payload as { error?: { details?: Record<string, unknown> } }).error?.details
  const userErrors = Array.isArray(details?.user) ? details.user : []

  return userErrors.includes("NAME_AND_PASSWORD_REQUIRED")
    ? null
    : null
}

export function InviteAcceptForm({ token, preview }: InviteAcceptFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [step, setStep] = useState<"accept" | "set-password">("accept")
  const [merchantName, setMerchantName] = useState<string | null>(null)
  const [acceptedEmail, setAcceptedEmail] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: preview?.recipient_name ?? "",
      password: "",
      password_confirmation: "",
    },
  })

  const missingToken = useMemo(() => !token || token.trim().length === 0, [token])

  const onSubmit = async (values: FormValues) => {
    if (missingToken || !token) {
      setError("This invite link is incomplete.")
      return
    }

    setError(null)
    setSuccessMessage(null)

    const payload = {
      token,
      ...(values.name?.trim()
        ? {
            name: values.name.trim(),
            password: values.password,
            password_confirmation: values.password_confirmation,
          }
        : {}),
    }

    const response = await acceptMerchantInvite(payload)

    if (isApiErrorResponse(response)) {
      const requirementError = getInviteRequirementError(response.payload)
      if (requirementError) {
        setStep("set-password")
        if (preview?.recipient_name && !form.getValues("name")) {
          form.setValue("name", preview.recipient_name, {
            shouldDirty: false,
            shouldTouch: false,
          })
        }
        setError(requirementError)
        return
      }

      setError(response.message || "Unable to accept invite.")
      return
    }

    const accepted = response.data
    setMerchantName(accepted.merchant.name)
    setAcceptedEmail(accepted.user.email)

    if (values.password && accepted.user.email) {
      const loginResult = await signIn("credentials", {
        email: accepted.user.email,
        password: values.password,
        callbackUrl: AdminLinks.dashboard,
        redirect: false,
      })

      if (!loginResult?.error && loginResult?.url) {
        router.push(loginResult.url)
        router.refresh()
        return
      }
    }

    setSuccessMessage(
      accepted.user.created
        ? `Your account has been created and the invite was accepted for ${accepted.merchant.name}. Sign in to continue.`
        : `Your invite was accepted for ${accepted.merchant.name}. Sign in to continue.`
    )
  }

  const isSubmitting = form.formState.isSubmitting
  const isPasswordStep = step === "set-password"

  if (successMessage) {
    return (
      <Card className="border border-white/40 bg-white/80 shadow-xl backdrop-blur">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">Invite accepted</CardTitle>
          <p className="text-sm text-muted-foreground">{successMessage}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {acceptedEmail ? (
            <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
              Continue with <span className="font-medium text-foreground">{acceptedEmail}</span>
              {merchantName ? ` for ${merchantName}.` : "."}
            </div>
          ) : null}
          <Button className="w-full" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-white/40 bg-white/80 shadow-xl backdrop-blur">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">
          {isPasswordStep ? "Set your account password" : "Accept invite"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isPasswordStep
            ? "Finish joining this workspace by creating the password you will use to sign in."
            : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {missingToken ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            This invite link is missing its token.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {preview ? (
          <div className="text-muted-foreground">
            <p className="mb-3 text-sm text-muted-foreground">
              {preview.recipient_name
                ? `${preview.recipient_name}, you have been invited to join ${preview.merchant_name ?? "this merchant"}.`
                : `You have been invited to join ${preview.merchant_name ?? "this merchant"}.`}
            </p>
            <p className="mt-2">
              Your email:{" "}
              <span className="font-medium text-foreground">{preview.email}</span>
            </p>
            
            <p className="mt-1">
              Role:{" "}
              <span className="font-medium capitalize text-foreground">
                {preview.role.replaceAll("_", " ")}
              </span>
            </p>
          </div>
        ) : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {isPasswordStep ? (
              <>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password_confirmation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting || missingToken}>
              {isSubmitting
                ? isPasswordStep
                  ? "Creating password..."
                  : "Accepting invite..."
                : isPasswordStep
                  ? "Save password and continue"
                  : "Accept invite"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
