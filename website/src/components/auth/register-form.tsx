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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCountryOptions } from "@/lib/geo-options"

const schema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email"),
    country_code: z.string().length(2, "Select a country"),
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
  const countryOptions = getCountryOptions()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      country_code: "ZA",
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          country_code: values.country_code,
          password: values.password,
          password_confirmation: values.password_confirmation,
        }),
      })

      console.log("Registration response", response)

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
    <div className="space-y-6 bg-background/95 p-6 shadow-2xl shadow-black/5 backdrop-blur sm:p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Set up your workspace and start managing deliveries from one dashboard.
        </p>
      </div>

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
                  <Input className="h-11" placeholder="Jane Doe" {...field} />
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
                  <Input
                    autoComplete="email"
                    className="h-11"
                    placeholder="name@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="country_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} >
                  <FormControl>
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <Input
                      autoComplete="new-password"
                      className="h-11"
                      type="password"
                      {...field}
                    />
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
                    <Input
                      autoComplete="new-password"
                      className="h-11"
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-foreground underline underline-offset-4 transition hover:text-primary"
            >
              Sign in
            </Link>
          </p>
        </form>
      </Form>
    </div>
  )
}
