import type { PublishedContent } from "./types";

export const features = [
    { id: "scheduling", title: "Scheduling & runs", group: "Planning", visual: "schedule", description: "Assign shipments to runs and coordinate drivers, vehicles and schedules.", detail: "Bring shipment assignments and run oversight together so dispatchers can review the work before it leaves the depot." },
    { id: "tracking", title: "Fleet tracking", group: "Execution", visual: "monitor", description: "Follow vehicle positions and review recorded journeys.", detail: "Give dispatchers context for operational exceptions. Tracking depends on connected tracking providers and the data they supply." },
    { id: "driver-app", title: "Driver app", group: "Execution", visual: "documents", description: "Keep assigned runs and delivery-note uploads close to the driver.", detail: "Connect work in the field with the office through assigned runs and uploaded delivery documents." },
    { id: "documents", title: "Delivery documents", group: "Execution", visual: "documents", description: "Capture, import and review documents against shipments.", detail: "Keep delivery records associated with the right shipment and identify missing paperwork. Document uploads do not imply electronic signature capture." },
    { id: "automation", title: "Location automation", group: "Execution", visual: "monitor", description: "Use geofences to support arrival and departure workflows.", detail: "Define operational locations and use supported tracking events to understand visits. Availability depends on tracking integration and configuration." },
    { id: "reporting", title: "Reporting & analytics", group: "Oversight", visual: "reporting", description: "Review shipments, waiting time, speeding, vehicles and documents.", detail: "Use operational reports to investigate exceptions and follow up with the team using the records available in your system." },
    { id: "integrations", title: "Integrations & API", group: "Oversight", visual: "api", description: "Connect supported systems and explore the existing API.", detail: "Discuss your tracking provider and integration requirements during a demo. Developer documentation describes the available interfaces." },
] as const;
export const industries = [
    { id: "road-freight", title: "Road freight", description: "Coordinate shipments, runs and delivery records across your transport operation.", detail: "Plan assignments, follow connected vehicles and review waiting time and delivery documents when a run needs attention." },
    { id: "wholesale-distribution", title: "Wholesale distribution", description: "Connect depot planning with drivers and customer delivery paperwork.", detail: "Organise shipments into runs, give drivers their assignments and review documents against each shipment." },
    { id: "courier-operations", title: "Courier operations", description: "Keep dispatch, drivers and shipment records connected throughout the day.", detail: "Review assigned runs, investigate journey exceptions and follow up on missing delivery-note uploads." },
    { id: "retail-delivery", title: "Retail delivery", description: "Follow deliveries from dispatch through to document review.", detail: "Coordinate vehicle assignments, monitor supported location events and keep delivery records together for operational follow-up." },
    { id: "fuel-depots", title: "Fuel depots", description: "Connect depot dispatch, tanker runs and delivery-document follow-up.", detail: "Coordinate assigned runs, review connected vehicle journeys and use supported location events to understand depot visits." },
] as const;
export function catalogueHref(section: "platform" | "industries", id: string, content: PublishedContent[] | null) {
    const slug = `${section}/${id}`;
    if (section === "platform" && features.some(feature => feature.id === id)) return `/${slug}`;
    if (section === "industries" && industries.some(industry => industry.id === id)) return `/${slug}`;
    return content?.some((page) => page.slug === slug) ? `/${slug}` : `/${section}#${id}`;
}
