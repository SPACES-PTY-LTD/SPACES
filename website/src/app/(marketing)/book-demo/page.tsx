import { CalendarDays, FileCheck2, Radar } from "lucide-react";
import { DemoForm } from "@/components/marketing/demo-form";
import { MarketingVisual } from "@/components/marketing/visual";
import { publicData } from "@/lib/website/public";
export const metadata = { title: "Book a demo | Spaces Digital", description: "Explore planning, dispatch, delivery documents and operational visibility in a 30-minute Spaces walkthrough." };
export default async function Page() {
    const contacts = await publicData<Record<string, string>>("contact");
    return <section className="demo-layout section-wrap">
        <div className="demo-agenda"><p className="eyebrow">Let’s explore your operation</p><h1>See how the work connects.</h1><p>A focused, 30-minute walkthrough of Spaces, shaped around your fleet and the work your team does every day.</p>
            <ol><li><CalendarDays aria-hidden="true" /><strong>Planning & dispatch</strong><span>Explore shipment assignments, schedules and run management.</span></li><li><FileCheck2 aria-hidden="true" /><strong>Drivers & delivery records</strong><span>Connect assigned runs with delivery-note uploads and document review.</span></li><li><Radar aria-hidden="true" /><strong>Operational visibility</strong><span>Discuss tracking integrations, reports and the exceptions you need to follow up.</span></li></ol>
            <MarketingVisual name="schedule" />
        </div><DemoForm salesEmail={contacts?.sales_email} />
    </section>;
}
