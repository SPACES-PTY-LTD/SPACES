"use client"

import { AdminLinks } from "@/lib/routes/admin"
import { createMerchant, listMerchants } from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import type { Merchant } from "@/lib/types"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { getSession, signIn, useSession } from "next-auth/react"
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
    name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    password_confirmation: z
      .string()
      .min(6, "Confirm your password"),
  })
  .refine((values) => values.password === values.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
  })

type FormValues = z.infer<typeof schema>

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { update } = useSession()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setError(null)
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          password_confirmation: values.password_confirmation,
        }),
      });

      console.log("Registration response", response);

      if (!response.ok) {
        let message = "Registration failed"
        const payload = await response.json().catch(() => null)
        if (payload && typeof payload === "object" && "error" in payload) {
          const maybeError = (payload as {
            error?: { message?: unknown }
          }).error
          if (typeof maybeError?.message === "string") {
            message = maybeError.message
          }
        } else if (
          payload &&
          typeof payload === "object" &&
          typeof (payload as { message?: unknown }).message === "string"
        ) {
          message = (payload as { message: string }).message
        }

        console.error("Registration failed", {
          status: response.status,
          payload,
        })
        setError(message)
        return
      }

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        callbackUrl: AdminLinks.dashboard,
        redirect: false,
      })

      if (result?.error) {
        console.error("Auto-login after registration failed", result)
        setError("Registration succeeded, but login failed.")
        return
      }

      const activeSession = await getSession()
      const accessToken = activeSession?.accessToken ?? null
      if (activeSession?.user?.role === "user" && accessToken) {
        const merchantsResponse = await listMerchants(accessToken)
        if (isApiErrorResponse(merchantsResponse)) {
          console.error("Failed to load merchants after registration", merchantsResponse)
        } else {
          let merchants = merchantsResponse.data
          if (merchants.length === 0) {
            const created = await createMerchant({ name: "Main" }, accessToken)
            if (isApiErrorResponse(created)) {
              console.error("Failed to create default merchant after registration", created)
            } else {
              merchants = [created]
            }
          }

          if (merchants.length > 0) {
            const selected =
              merchants.find(
                (merchant) =>
                  merchant.merchant_id === activeSession?.selected_merchant?.merchant_id
              ) ?? merchants[0]

            await update({
              merchants: merchants as Merchant[],
              selected_merchant: selected,
            })
          }
        }
      }

      if (result?.url) {
        router.push(result.url)
      } else {
        router.push(AdminLinks.dashboard)
      }
    } catch (err) {
      console.error("Registration request crashed", err)
      setError(err instanceof Error ? err.message : "Registration failed")
    }
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <Card className="border border-white/40 bg-white/80 shadow-xl backdrop-blur">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="" {...field} />
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button variant="link" size="sm" asChild>
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
