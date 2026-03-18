"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"

export type PlaceSelection = {
  name: string
  formattedAddress: string
  addressLine1: string
  addressLine2: string
  town: string
  city: string
  province: string
  postCode: string
  country: string
  latitude: number | null
  longitude: number | null
  googlePlaceId: string
}

type PlaceSuggestion = google.maps.places.AutocompletePrediction

export function PlacesSuggestions({
  onChange,
  countryCode = "za",
  placeholder = "Start typing an address",
  resetKey,
  initialQuery = "",
}: {
  onChange: (selection: PlaceSelection) => void
  countryCode?: string
  placeholder?: string
  resetKey?: string | number | boolean
  initialQuery?: string
}) {
  const [query, setQuery] = React.useState("")
  const [suggestions, setSuggestions] = React.useState<PlaceSuggestion[]>([])
  const [suppressSuggestions, setSuppressSuggestions] = React.useState(false)
  const [placesReady, setPlacesReady] = React.useState(false)
  const [placesLoading, setPlacesLoading] = React.useState(false)
  const [placesError, setPlacesError] = React.useState<string | null>(null)
  const autocompleteServiceRef =
    React.useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceRef = React.useRef<google.maps.places.PlacesService | null>(
    null
  )
  const sessionTokenRef =
    React.useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  React.useEffect(() => {
    setQuery(initialQuery)
    setSuggestions([])
    setSuppressSuggestions(false)
  }, [initialQuery, resetKey])

  React.useEffect(() => {
    let cancelled = false
    loadGoogleMaps(["places"])
      .then(() => {
        if (cancelled) return
        if (!autocompleteServiceRef.current) {
          autocompleteServiceRef.current =
            new google.maps.places.AutocompleteService()
        }
        if (!placesServiceRef.current) {
          placesServiceRef.current = new google.maps.places.PlacesService(
            document.createElement("div")
          )
        }
        sessionTokenRef.current =
          new google.maps.places.AutocompleteSessionToken()
        setPlacesReady(true)
        setPlacesError(null)
      })
      .catch((error) => {
        if (cancelled) return
        console.error("Failed to load Google Places", error)
        setPlacesError(
          error instanceof Error ? error.message : "Failed to load Google Places."
        )
        setPlacesReady(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!placesReady) return
    if (!autocompleteServiceRef.current) return
    if (suppressSuggestions) return
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      setPlacesLoading(false)
      return
    }
    const timeoutId = window.setTimeout(() => {
      setPlacesLoading(true)
      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: trimmed,
          types: ["address"],
          componentRestrictions: { country: countryCode },
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        (predictions, status) => {
          setPlacesLoading(false)
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions
          ) {
            setSuggestions([])
            return
          }
          setSuggestions(predictions)
        }
      )
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [countryCode, placesReady, query, suppressSuggestions])

  const handleSelect = (suggestion: PlaceSuggestion) => {
    if (!placesServiceRef.current) return
    setPlacesLoading(true)
    setSuppressSuggestions(true)
    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: [
          "address_components",
          "formatted_address",
          "geometry",
          "name",
          "place_id",
        ],
        sessionToken: sessionTokenRef.current ?? undefined,
      },
      (place, status) => {
        setPlacesLoading(false)
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !place
        ) {
          setPlacesError("Failed to load place details.")
          return
        }

        const components = place.address_components ?? []
        const getComponent = (type: string) =>
          components.find((component) => component.types.includes(type))
            ?.long_name ?? ""

        const streetNumber = getComponent("street_number")
        const route = getComponent("route")
        const subpremise = getComponent("subpremise")
        const neighborhood = getComponent("neighborhood")
        const sublocality =
          getComponent("sublocality") || getComponent("sublocality_level_1")
        const locality =
          getComponent("locality") || getComponent("postal_town")
        const province = getComponent("administrative_area_level_1")
        const postCode = getComponent("postal_code")
        const country = getComponent("country")

        const addressLine1 =
          [streetNumber, route].filter(Boolean).join(" ").trim() ||
          place.formatted_address ||
          suggestion.description

        const latitude = place.geometry?.location?.lat() ?? null
        const longitude = place.geometry?.location?.lng() ?? null

        const formattedAddress = place.formatted_address || suggestion.description
        setQuery(formattedAddress)
        setSuggestions([])
        sessionTokenRef.current =
          new google.maps.places.AutocompleteSessionToken()
        setPlacesError(null)
        onChange({
          name:
            place.name ||
            suggestion.structured_formatting?.main_text ||
            addressLine1,
          formattedAddress,
          addressLine1,
          addressLine2: subpremise,
          town: sublocality || neighborhood,
          city: locality,
          province,
          postCode,
          country,
          latitude,
          longitude,
          googlePlaceId: place.place_id || suggestion.place_id,
        })
      }
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setSuppressSuggestions(false)
            setQuery(event.target.value)
          }}
          disabled={!placesReady && Boolean(placesError)}
        />
        {suggestions.length > 0 ? (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow">
            <div className="max-h-56 overflow-y-auto py-1 text-sm">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-muted"
                  onClick={() => handleSelect(suggestion)}
                >
                  <div className="font-medium">
                    {suggestion.structured_formatting?.main_text ??
                      suggestion.description}
                  </div>
                  {suggestion.structured_formatting?.secondary_text ? (
                    <div className="text-xs text-muted-foreground">
                      {suggestion.structured_formatting.secondary_text}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {placesLoading ? (
        <div className="text-xs text-muted-foreground">
          Searching Google Places...
        </div>
      ) : null}
      {placesError ? (
        <div className="text-xs text-destructive">
          {placesError.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
            ? "Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable address search."
            : placesError}
        </div>
      ) : null}
    </div>
  )
}
