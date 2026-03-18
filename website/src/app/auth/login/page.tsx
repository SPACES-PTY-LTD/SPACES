import Link from "next/link"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/auth"

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect("/admin")
  }

  return (
    <div className="space-y-6">
      <LoginForm />
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Button variant="link" size="sm" asChild>
          <Link href="/auth/forgot">Reset password</Link>
        </Button>
      </div>
    </div>
  )
}
