"use client"

import { AdminLinks } from "@/lib/routes/admin"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { signIn } from "next-auth/react"
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

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password is required"),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setError(null)
    setIsLoading(false)
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        login_context: "admin",
        callbackUrl: AdminLinks.dashboard,
        redirect: false,
      })

      if (result?.error) {
        console.error("Login failed", result)
        setError("Invalid email or password")
        return
      }
      if (result?.url) {
        setIsLoading(true)
        router.push(result.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    }
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <div className="space-y-6 rounded-3xl  bg-background/95 p-6 shadow-2xl shadow-black/5 backdrop-blur sm:p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email below to access your workspace.
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-3">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href="/auth/forgot"
                    className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    autoComplete="current-password"
                    className="h-11"
                    type="password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting || isLoading}>
            {isSubmitting || isLoading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-foreground underline underline-offset-4 transition hover:text-primary"
            >
              Sign up
            </Link>
          </p>
        </form>
      </Form>
    </div>
  )
}
