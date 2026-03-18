import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ErrorMessage } from "@/components/common/error-message"
import { isApiErrorResponse } from "@/lib/api/client"
import { getQuote } from "@/lib/api/quotes"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { StatusBadge } from "@/components/common/status-badge"
import moment from "moment"
import { QuoteOptionBooking } from "@/components/quotes/quote-option-booking"

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ quoteId: string }>
}) {
  const { quoteId } = await params
  const session = await requireAuth()
  const quote = await getQuote(quoteId, session.accessToken, {
    merchant_id: getScopedMerchantId(session),
  })
  if (isApiErrorResponse(quote)) {
    return (
      <ErrorMessage
        title="Quote"
        description="Quote breakdown and booking readiness."
        message={quote.message}
      />
    )
  }
  const options = quote.options ?? []
  const isBooked = String(quote.status ?? "").toLowerCase() === "booked"
  const selectedOptionId = quote.selected_option?.quote_option_id

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Quotes", href: AdminLinks.quotes },
          { label: quote.quote_id },
        ]}
      />
      <PageHeader
        title={`Quote ${quote.quote_id}`}
        description="Quote breakdown and booking readiness."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Order Ref</div>
            <div className="text-sm font-medium">
              {quote.merchant_order_ref ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusBadge status={String(quote.status ?? "pending")} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Requested</div>
            <div className="text-sm font-medium">
              {quote.requested_at
                ? moment(quote.requested_at).format("YYYY-MM-DD HH:mm")
                : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Expires</div>
            <div className="text-sm font-medium">
              {quote.expires_at
                ? moment(quote.expires_at).format("YYYY-MM-DD HH:mm")
                : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Merchant</span>
            {quote.merchant_id ? (
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={AdminRoute.merchantDetails(quote.merchant_id)}
              >
                {quote.merchant_id}
              </a>
            ) : (
              <span className="font-medium">-</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Shipment ID</span>
            {quote.shipment_id ? (
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={AdminRoute.shipmentDetails(quote.shipment_id)}
              >
                {quote.shipment_id}
              </a>
            ) : (
              <span className="font-medium">-</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Environment ID</span>
            <span className="font-medium">
              {quote.environment_id ?? "-"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrier</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>ETA From</TableHead>
                <TableHead>ETA To</TableHead>
                <TableHead>Max Weight (kg)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No quote options available.
                  </TableCell>
                </TableRow>
              ) : (
                options.map((option) => (
                  <TableRow key={option.quote_option_id}>
                    <TableCell>{option.carrier_code}</TableCell>
                    <TableCell>{option.service_code}</TableCell>
                    <TableCell>
                      {option.currency} {Number(option.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {option.currency} {Number(option.tax_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {option.currency} {Number(option.total_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {option.eta_from
                        ? moment(option.eta_from).format("YYYY-MM-DD HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {option.eta_to
                        ? moment(option.eta_to).format("YYYY-MM-DD HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {option.rules?.max_weight_kg ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isBooked ? (
                        option.quote_option_id === selectedOptionId ? (
                          <span className="text-xs text-muted-foreground">
                            Booked
                          </span>
                        ) : null
                      ) : (
                        <QuoteOptionBooking
                          shipmentId={quote.shipment_id}
                          option={option}
                          accessToken={session.accessToken}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
