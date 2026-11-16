import type { Metadata } from "next";
import { FaqBrowser } from "@/components/marketing/faq-browser";
export const metadata: Metadata = {
    title: "Frequently asked questions | Spaces Digital",
    description: "Answers about Spaces logistics software, planning, driver workflows, tracking integrations, documents and customer support.",
    alternates: { canonical: "/faq" },
};
export default function FaqPage() { return <FaqBrowser />; }
