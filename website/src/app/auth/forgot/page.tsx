import Link from "next/link"
import { ForgotForm } from "@/components/auth/forgot-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ForgotPasswordPage() {
  return (
    <Card className="border border-white/40 bg-white/80 shadow-xl">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your admin email and we will send reset instructions.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ForgotForm />
        <Button variant="ghost" className="w-full" asChild>
          <Link href="/auth/login">Back to login</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
