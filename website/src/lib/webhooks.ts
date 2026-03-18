export type WebhookEventTypeOption = {
  value: string
  label: string
  description: string
}

export const AVAILABLE_WEBHOOK_EVENT_TYPES: WebhookEventTypeOption[] = [
  {
    value: "tracking.updated",
    label: "Tracking Updated",
    description: "Sent when carrier tracking updates are received for a shipment.",
  },
]
