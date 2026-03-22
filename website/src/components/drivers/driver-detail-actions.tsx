"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeactivateDriverDialog } from "@/components/drivers/deactivate-driver-dialog"
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog"
import { UpdateDriverPasswordDialog } from "@/components/drivers/update-driver-password-dialog"
import type { Driver } from "@/lib/types"

export function DriverDetailActions({
  driver,
  accessToken,
}: {
  driver: Driver
  accessToken?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Actions
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditDriverDialog
          driver={driver}
          accessToken={accessToken}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Edit driver
            </DropdownMenuItem>
          }
        />
        <UpdateDriverPasswordDialog
          driver={driver}
          accessToken={accessToken}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Update password
            </DropdownMenuItem>
          }
        />
        <DeactivateDriverDialog
          driver={driver}
          accessToken={accessToken}
          trigger={
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => event.preventDefault()}
            >
              Deactivate driver
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
