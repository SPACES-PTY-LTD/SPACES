"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ForgotForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!email) {
          setError("Email is required")
          return
        }
        setError(null)
        setSubmitted(true)
      }}
    >
      <Input
        type="email"
        placeholder="ops@pickndrop.io"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {submitted ? (
        <p className="text-xs text-emerald-600">
          Reset instructions sent. Check your inbox.
        </p>
      ) : null}
      <Button className="w-full" type="submit">
        Send reset link
      </Button>
    </form>
  )
}
