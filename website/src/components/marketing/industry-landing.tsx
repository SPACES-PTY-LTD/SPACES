import { industries } from "@/lib/website/catalogue";
import { industryPages } from "@/lib/website/industry-pages";
import type { PublishedContent } from "@/lib/website/types";
import { SolutionLanding } from "./feature-landing";
export function IndustryLanding({ industry, editorial }: { industry: (typeof industries)[number]; editorial?: PublishedContent }) {
    return <SolutionLanding feature={{ ...industry, visual: "fleet" }} page={industryPages[industry.id]} industryPhoto={`/images/marketing/industry-${industry.id}.webp`} editorial={editorial} />;
}
