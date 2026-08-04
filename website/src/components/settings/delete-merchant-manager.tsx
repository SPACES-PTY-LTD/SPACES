"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isApiErrorResponse } from "@/lib/api/client"
import { deleteMerchant } from "@/lib/api/merchants"
import { AdminLinks } from "@/lib/routes/admin"
import type { Merchant } from "@/lib/types"

export function DeleteMerchantManager({
  accessToken,
  merchant,
  initialMerchants,
}: {
  accessToken?: string
  merchant: Merchant
  initialMerchants: Merchant[]
}) {
  const router = useRouter()
  const { data: liveSession, update } = useSession()
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [successOpen, setSuccessOpen] = React.useState(false)
  const [continuing, setContinuing] = React.useState(false)
  const [postDeleteSession, setPostDeleteSession] = React.useState<{
    merchants: Merchant[]
    selectedMerchant: Merchant
  } | null>(null)

  const merchants = liveSession?.merchants ?? initialMerchants
  const isLastMerchant = merchants.length <= 1

  async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const confirmedPassword = password.trim()

    if (!confirmedPassword) {
      setError("Password is required.")
      return
    }

    if (isLastMerchant) {
      setError("Create another merchant before deleting this one.")
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const response = await deleteMerchant(
        merchant.merchant_id,
        { password: confirmedPassword },
        accessToken
      )

      if (isApiErrorResponse(response)) {
        setError(response.message || "Failed to delete merchant.")
        return
      }

      const remainingMerchants = merchants
        .filter((entry) => entry.merchant_id !== response.deleted_merchant_id)
        .map((entry) =>
          entry.merchant_id === response.next_merchant.merchant_id
            ? response.next_merchant
            : entry
        )

      if (!remainingMerchants.some(
        (entry) => entry.merchant_id === response.next_merchant.merchant_id
      )) {
        remainingMerchants.unshift(response.next_merchant)
      }

      const nextSession = {
        merchants: remainingMerchants,
        selectedMerchant: response.next_merchant,
      }
      setPostDeleteSession(nextSession)

      try {
        await update({
          merchants: nextSession.merchants,
          selected_merchant: nextSession.selectedMerchant,
        })
      } catch {
        toast.error("Merchant deleted, but the merchant menu could not refresh. Continue to retry.")
      }

      setPassword("")
      setSuccessOpen(true)
      toast.success("Merchant deleted successfully.")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete merchant."
      )
    } finally {
      setDeleting(false)
    }
  }

  async function handleContinue() {
    setContinuing(true)

    try {
      if (postDeleteSession) {
        await update({
          merchants: postDeleteSession.merchants,
          selected_merchant: postDeleteSession.selectedMerchant,
        })
      }

      router.replace(AdminLinks.dashboard)
      router.refresh()
    } catch {
      toast.error("Unable to refresh the merchant menu. Please try Continue again.")
      setContinuing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delete merchant"
        description={`Permanently delete ${merchant.name} and all of its data.`}
      />

      <Card className="mx-auto max-w-3xl border-destructive/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1">
              <CardTitle>This action cannot be undone</CardTitle>
              <CardDescription>
                Deleting <span className="font-medium text-foreground">{merchant.name}</span> will
                permanently remove the merchant and all associated shipments, runs, vehicles,
                drivers, locations, integrations, files, and activity data.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleDelete}>
            <div className="space-y-2">
              <Label htmlFor="delete-merchant-password">Confirm your password</Label>
              <Input
                id="delete-merchant-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={deleting || isLastMerchant}
                placeholder="Enter your password"
              />
            </div>

            {isLastMerchant ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                This is your only merchant. Create another merchant before deleting it.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              variant="destructive"
              disabled={deleting || isLastMerchant}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? "Deleting merchant..." : "Delete merchant"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={successOpen}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="mb-2 flex justify-center text-emerald-600 sm:justify-start">
              <CheckCircle2 className="size-10" />
            </div>
            <DialogTitle>Merchant deleted successfully</DialogTitle>
            <DialogDescription>
              The merchant and its data have been permanently deleted. Continue to your next
              merchant dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleContinue} disabled={continuing}>
              {continuing ? <Loader2 className="size-4 animate-spin" /> : null}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
