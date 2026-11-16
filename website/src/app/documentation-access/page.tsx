import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { documentationPassword, safeDocumentationDestination } from "@/lib/documentation/access";
import { DocumentationPasswordForm } from "./password-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Documentation access | Spaces Digital", robots: { index: false, follow: false } };
export default async function DocumentationAccess({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    const password = documentationPassword();
    const destination = safeDocumentationDestination((await searchParams).next);
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-16 text-slate-900">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <Link href="/" className="text-sm font-medium text-violet-700">← Back to Spaces</Link>
            <LockKeyhole size={32} strokeWidth={1.5} className="mb-6 mt-10 text-violet-700" aria-hidden="true" />
            <h1 className="text-3xl font-medium tracking-tight">Documentation access</h1>
            <p className="mt-4 leading-7 text-slate-600">Our integrations and API documentation are available by invitation. Enter your password to continue.</p>
            {password ? <DocumentationPasswordForm length={password.length} destination={destination} /> : <p role="status" className="mt-8 rounded-xl bg-slate-50 p-4 text-sm leading-6">Documentation access is not configured yet. Please contact our team.</p>}
            <p className="mt-6 text-sm text-slate-500">Need access? <Link href="/contact" className="font-medium text-violet-700 underline underline-offset-4">Contact the team</Link></p>
        </section>
    </main>;
}
