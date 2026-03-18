"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ResetForm() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setError(null)
    setSuccess(true)
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Input
        type="password"
        placeholder="Confirm password"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {success ? (
        <p className="text-xs text-emerald-600">Password updated.</p>
      ) : null}
      <Button className="w-full" type="submit">
        Update password
      </Button>
    </form>
  )
}
