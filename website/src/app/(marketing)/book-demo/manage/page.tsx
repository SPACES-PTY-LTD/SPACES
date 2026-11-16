import { PageIntro } from "@/components/marketing/shell";
import { DemoForm } from "@/components/marketing/demo-form";
export const metadata = {
    title: "Manage your demo | Spaces Digital",
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
};
export default function Page() {
    return (
        <>
            <PageIntro
                title="Manage your demo."
                description="Choose another available time or cancel your appointment."
            />
            <section className="section-wrap demo-manage">
                <DemoForm manage />
            </section>
        </>
    );
}
