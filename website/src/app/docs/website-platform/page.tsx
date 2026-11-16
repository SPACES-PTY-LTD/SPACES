import { requireDocumentationAccess } from "@/lib/documentation/require-access"
import Link from "next/link";
export const metadata = { title: "Website and support API | Spaces Digital" };
const endpoints = [
    [
        "GET",
        "/website/content",
        "Published snapshots only. Optional kind and q filters. Drafts and tickets are excluded.",
    ],
    [
        "GET",
        "/website/pricing",
        "Approved active paid plans in ZAR, including vehicle allowances and VAT wording.",
    ],
    [
        "GET",
        "/website/demo/slots?date=YYYY-MM-DD",
        "Available UTC timestamps for a Johannesburg calendar date. No attendee data.",
    ],
    [
        "POST",
        "/website/demo/book",
        "Reserve starts_at with name, email, company and fleet_size; optional phone/message. Five requests per hour per IP.",
    ],
    [
        "POST",
        "/website/demo/manage",
        "Private token, action (cancel/reschedule), and starts_at for rescheduling. Tokens come from confirmation emails.",
    ],
    [
        "GET / POST",
        "/support/tickets",
        "List or create merchant tickets. Customer users must supply merchant_id (UUID).",
    ],
    [
        "GET / PATCH",
        "/support/tickets/{uuid}",
        "Read or update an authorised ticket. Customers may resolve it; only super admins assign staff.",
    ],
    [
        "POST",
        "/support/tickets/{uuid}/replies",
        "Send body and optional multipart attachments[]. Customer replies reopen resolved tickets.",
    ],
    [
        "GET",
        "/support/attachments/{uuid}",
        "Authorised private download. Never a public document URL.",
    ],
];
export default async function Page() {
  await requireDocumentationAccess("/docs")
    return (
        <article className="space-y-6">
            <h1 className="text-3xl font-semibold">Website and support API</h1>
            <p>
                These routes use the existing API base URL with the{" "}
                <code>/api/v1</code> prefix. Successful responses have a{" "}
                <code>data</code> property. Validation failures return HTTP 422
                with Laravel validation details.
            </p>
            <h2 className="text-xl font-semibold">Authentication boundaries</h2>
            <p>
                Website reads and demo booking are public. Support requires a
                personal web-admin user token and merchant access. Drivers and
                merchant environment API keys cannot use support tickets.
                Website content, pricing approval, calendar and mail management
                are restricted to super admins.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr>
                            <th className="p-3">Method</th>
                            <th className="p-3">Path</th>
                            <th className="p-3">Behaviour</th>
                        </tr>
                    </thead>
                    <tbody>
                        {endpoints.map(([method, path, description]) => (
                            <tr className="border-t" key={path}>
                                <td className="p-3">{method}</td>
                                <td className="p-3">
                                    <code>{path}</code>
                                </td>
                                <td className="p-3">{description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <h2 className="text-xl font-semibold">Booking and files</h2>
            <p>
                Fleet size values are 1–10, 11–20, 21–50, 51–100 and 100+.
                Booking conflicts return 422; expired private management tokens
                return 404 and inactive appointments return 409. Support uploads
                accept up to five PDF, JPEG or PNG files per reply, each at most
                10 MB.
            </p>
            <p>
                Super-admin management endpoints live under{" "}
                <code>/website/admin</code>. Use the Website workspace to author
                and preview content, publish explicitly, approve billing plan
                values and configure the shared calendar.
            </p>
            <Link href="/docs">← Developer documentation</Link>
        </article>
    );
}
