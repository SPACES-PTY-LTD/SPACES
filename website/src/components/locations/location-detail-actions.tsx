"use client"

import { ChevronDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteLocationDialog } from "@/components/locations/delete-location-dialog"
import { LocationDialog } from "@/components/locations/location-dialog"
import type { Location } from "@/lib/types"

export function LocationDetailActions({
  location,
  accessToken,
}: {
  location: Location
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
        <LocationDialog
          location={location}
          accessToken={accessToken}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Edit location
            </DropdownMenuItem>
          }
        />
        <DeleteLocationDialog
          location={location}
          accessToken={accessToken}
          trigger={
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => event.preventDefault()}
            >
              Delete location
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
