import Link from "next/link"
import { ResetForm } from "@/components/auth/reset-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ResetPasswordPage() {
  return (
    <Card className="border border-white/40 bg-white/80 shadow-xl">
      <CardHeader>
        <CardTitle>Create a new password</CardTitle>
        <p className="text-sm text-muted-foreground">
          
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResetForm />
        <Button variant="ghost" className="w-full" asChild>
          <Link href="/auth/login">Back to login</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
