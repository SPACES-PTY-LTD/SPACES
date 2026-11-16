import Image from "next/image";
export const marketingVisuals: Record<
    string,
    { file: string; alt: string; ui?: boolean }
> = {
    "hero-scheduling": {
        file: "platform-hero-scheduling.png",
        alt: "Dispatch planning board with vehicle lanes and assigned shipment cards.",

        ui: true,
    },
    "hero-tracking": {
        file: "platform-hero-tracking.png",
        alt: "Vehicle journey map with a recorded route and last-position marker.",

        ui: true,
    },
    "hero-driver-app": {
        file: "platform-hero-driver-app.png",
        alt: "Driver phone showing assigned runs beside a delivery-note capture card.",

        ui: true,
    },
    "hero-documents": {
        file: "platform-hero-documents.png",
        alt: "Delivery note connected to a shipment document-review panel.",

        ui: true,
    },
    "hero-automation": {
        file: "platform-hero-automation.png",
        alt: "Depot geofence with arrival and departure event cards.",

        ui: true,
    },
    "hero-reporting": {
        file: "platform-hero-reporting.png",
        alt: "Operations reports for waiting time, shipments and delivery documents.",

        ui: true,
    },
    "hero-integrations": {
        file: "platform-hero-integrations.png",
        alt: "Spaces hub connected to tracking, shipment and API cards.",

        ui: true,
    },

    driver: {
        file: "carousel-driver-transparent.png",
        alt: "Illustrative driver app showing assigned work and delivery activity.",

        ui: true,
    },
    fleet: {
        file: "connected-fleet.webp",
        alt: "Illustration of a distribution depot, freight truck and delivery van connected by route lines.",

    },
    documents: {
        file: "feature-documents-transparent.png",
        alt: "Illustrative document review component linking delivery-note fields to shipment details.",

        ui: true,
    },
    delivery: {
        file: "delivery-network.webp",
        alt: "Illustration of delivery vans connecting a depot, shops and residential destinations.",

    },
    schedule: {
        file: "feature-schedule-transparent.png",
        alt: "Illustrative run card showing a driver assigned to a planned run and shipment.",

        ui: true,
    },
    monitor: {
        file: "feature-tracking-transparent.png",
        alt: "Illustrative fleet visibility component showing a recorded journey and vehicle position.",

        ui: true,
    },
    reporting: {
        file: "feature-reporting-transparent.png",
        alt: "Illustrative reporting component showing sample bars and document and waiting-time exceptions.",

        ui: true,
    },
    api: {
        file: "feature-api-transparent.png",
        alt: "Illustrative API connection linking business systems with shipments, quotes and webhooks.",

        ui: true,
    },
};
export function visualForSlug(slug: string) {
    if (slug.includes("scheduling")) return "schedule";
    if (slug.includes("tracking") || slug.includes("automation"))
        return "monitor";
    if (slug.includes("documents") || slug.includes("driver-app"))
        return "documents";
    if (slug.includes("integrations")) return "api";
    if (slug.includes("courier") || slug.includes("retail")) return "delivery";
    if (slug.includes("reporting")) return "reporting";
    if (slug.startsWith("industries/")) return "fleet";
    return undefined;
}
export function MarketingVisual({
    name,
    priority = false,
}: {
    name: string;
    priority?: boolean;
}) {
    const visual = marketingVisuals[name];
    if (!visual) return null;
    return (
        <figure
            className={`marketing-visual ${visual.ui ? "is-feature-ui" : "is-illustration"}`}
        >
            <div className="visual-stage">
                <Image
                    src={`/images/marketing/${visual.file}`}
                    alt={visual.alt}
                    width={1440}
                    height={960}
                    sizes="(max-width: 760px) 92vw, 55vw"
                    priority={priority}
                />
            </div>
        </figure>
    );
}
