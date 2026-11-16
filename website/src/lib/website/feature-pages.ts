import { features } from "./catalogue";
export type FeaturePage = {
    headline: string; intro: string; problem: string; context: string;
    benefits: [string, string][];
    chapters: { title: string; body: string; visual: string; points: string[] }[];
    steps: [string, string][];
    faqs: [string, string][];
    related: string[];
};
export const featurePages: Record<(typeof features)[number]["id"], FeaturePage> = {
    scheduling: {
        headline: "Give every shipment a place in the plan.",
        intro: "Bring shipments, vehicles and drivers into a shared run schedule. Help your dispatch team see the work ahead and keep assignments connected to execution.",
        problem: "A dispatch plan needs more than a spreadsheet.",
        context: "When assignments sit in separate lists, it takes extra effort to understand which vehicle is doing the work and what still needs attention. Spaces brings those operational records together around the run.",
        benefits: [["Clear assignments", "Associate shipments with runs and their assigned resources."], ["A shared schedule", "Give the team a common view of planned operational work."], ["Connected oversight", "Follow a run from planning into its operational records."]],
        chapters: [
            { title: "Build the run around the work.", body: "Start with shipments and organise them into runs. Review the planned work together with the vehicle and driver assignments before dispatch.", visual: "schedule", points: ["Shipment-to-run assignment", "Driver and vehicle coordination", "Schedules and planned work"] },
            { title: "Keep the plan connected to the road.", body: "Planning and execution belong in the same workflow. Use run records alongside available tracking and delivery documents to understand what happened after dispatch.", visual: "monitor", points: ["Run-level operational context", "Connected vehicle visibility where configured", "Related delivery records"] },
        ],
        steps: [["Review shipments", "Identify the work that needs to be scheduled."], ["Organise the run", "Coordinate shipments, a vehicle and a driver."], ["Follow the work", "Use operational records to review progress and exceptions."]],
        faqs: [["Does Spaces automatically optimise routes?", "This page describes route planning, scheduling and run management. Automatic route optimisation is not a verified capability being offered here."], ["Can we use our own operational workflow?", "Bring a typical day’s shipments and dispatch process to the demo. We can show how the existing assignment and run workflows fit your operation."], ["Do we need a tracking integration?", "Tracking is a separate connected capability. Vehicle visibility depends on an appropriate provider integration and the data it supplies."]], related: ["tracking", "driver-app", "documents"],
    },
    tracking: {
        headline: "Put vehicle movements in operational context.",
        intro: "Follow connected vehicle positions and review recorded journeys alongside the work your fleet is carrying out. Give dispatchers a clearer starting point for investigating exceptions.",
        problem: "A position on a map is only part of the story.",
        context: "Dispatchers need to connect vehicle movements with the run, the shipment and the places where work happens. Spaces brings available tracking information into the operational workflow.",
        benefits: [["Fleet visibility", "See positions supplied by connected tracking providers."], ["Journey context", "Review recorded movement when investigating a run."], ["Focused follow-up", "Use location and reporting context to investigate exceptions."]],
        chapters: [
            { title: "See the fleet through your connected provider.", body: "Use available vehicle information to support dispatch decisions. The freshness and detail of positions depend on your provider, connection and reporting frequency.", visual: "monitor", points: ["Connected vehicle positions", "Operational monitoring", "Provider-dependent data availability"] },
            { title: "Review the journey behind an exception.", body: "Recorded journeys provide context for follow-up. Combine the movement record with available waiting-time and speeding reports when reviewing what needs attention.", visual: "reporting", points: ["Recorded journey review", "Waiting-time context", "Speeding reports where data is available"] },
        ], steps: [["Confirm the connection", "Review your tracking provider and vehicle setup."], ["Follow available positions", "Use connected vehicle data in operational monitoring."], ["Investigate an exception", "Review recorded movement and related reports."]],
        faqs: [["Will every vehicle update in real time?", "Update frequency and completeness depend on the tracking provider and connection. Spaces cannot display positions that the provider has not supplied."], ["Which provider should we discuss in the demo?", "Bring the name of your current tracking provider and the vehicles you want to connect. Spaces includes integrations for MiX/Powerfleet and Fleetboard; compatibility and configuration need to be confirmed for your deployment."], ["Does a location event prove delivery?", "No. A vehicle visit gives location context. Delivery documents and operational review remain separate parts of the workflow."]], related: ["automation", "reporting", "scheduling"],
    },
    "driver-app": {
        headline: "Connect the driver’s day with the office.",
        intro: "Give drivers access to assigned runs and a way to upload delivery notes. Keep field activity connected to the records your operations team reviews.",
        problem: "Paperwork should stay connected to the job.",
        context: "A delivery note sent separately from the run creates another piece of information for the office to reconcile. Spaces connects driver uploads with the delivery-document workflow.",
        benefits: [["Assigned work", "Drivers can access the runs assigned to them."], ["Field uploads", "Delivery-note uploads bring paperwork into the system."], ["Office review", "Uploaded records feed the document review workflow."]],
        chapters: [
            { title: "Start with the assigned run.", body: "Keep the driver’s operational work connected to the run planned by dispatch. Use the demo to walk through the current mobile experience with your team’s working practices.", visual: "driver", points: ["Assigned runs", "Driver-facing mobile workflow", "Connection to dispatch planning"] },
            { title: "Bring delivery notes back into the workflow.", body: "Drivers upload delivery notes for the office to review. The review process matters: an uploaded image is not the same as a checked and correctly associated shipment record.", visual: "documents", points: ["Delivery-note uploads", "Document review", "Shipment association after review"] },
        ], steps: [["Assign the run", "Dispatch coordinates the driver’s planned work."], ["Open assigned work", "The driver accesses the relevant run in the app."], ["Upload and review", "Delivery-note uploads enter the office review workflow."]],
        faqs: [["Does this include electronic signatures?", "This page describes delivery-note uploads. A separate electronic-signature capability has not been verified and is not included in this claim."], ["Does the app work offline?", "Offline operation is not promised here. We will demonstrate the current mobile workflow and discuss connectivity requirements for your operating environment."], ["Can we see the app before deciding?", "Yes. Book a demo and ask to walk through assigned runs, delivery-note uploads and the corresponding office review process."]], related: ["scheduling", "documents", "reporting"],
    },
    documents: {
        headline: "Keep delivery paperwork with the shipment.",
        intro: "Capture, import and review delivery documents in a connected workflow. Give the office a clearer way to associate records with shipments and follow up on missing paperwork.",
        problem: "A delivered shipment still needs a usable record.",
        context: "Documents arriving through separate channels can be difficult to reconcile. Spaces brings capture, review and shipment association into the operational process, while keeping the need for human review clear.",
        benefits: [["Connected records", "Associate delivery documents with the relevant shipment."], ["A review workflow", "Check imports and uploads before relying on the record."], ["Completeness checks", "Use document reports to identify follow-up work."]],
        chapters: [
            { title: "Capture the document. Keep the context.", body: "Bring delivery-note uploads and document imports into the system. Review the document alongside shipment information so the record is useful to the office.", visual: "documents", points: ["Document capture and imports", "Delivery-note uploads", "Review and shipment association"] },
            { title: "Make missing paperwork visible.", body: "Use available document coverage and missing-document reports to identify what still needs attention. Follow up using the shipment and run context rather than an isolated file.", visual: "reporting", points: ["Document coverage", "Missing-document review", "Operational follow-up"] },
        ], steps: [["Capture or import", "Bring a delivery document into the workflow."], ["Review the record", "Check the uploaded information and shipment association."], ["Follow up", "Review document completeness and outstanding records."]],
        faqs: [["Is an upload automatically a verified proof of delivery?", "No. Uploaded documents require review. Document capture does not independently verify delivery, authenticity or a recipient signature."], ["Can documents be linked to shipments?", "Yes. Shipment association is part of the document review workflow. Correct association should be checked before using the record for follow-up."], ["Can we identify missing documents?", "Available document reports cover missing records and coverage. The usefulness of the report depends on the shipment and document data in your system."]], related: ["driver-app", "reporting", "scheduling"],
    },
    automation: {
        headline: "Give arrivals and departures a place in the workflow.",
        intro: "Use geofences and supported location events to connect vehicle visits with operational follow-up. Build around the locations that matter to your fleet.",
        problem: "A location boundary needs operational meaning.",
        context: "A depot, customer site or delivery location can represent an important moment in a run. Supported location workflows help bring that context into the system, with behaviour determined by the configured rules and tracking data.",
        benefits: [["Defined locations", "Use geofences around relevant operational sites."], ["Visit context", "Support arrival and departure workflows with location events."], ["Configured actions", "Apply supported rules to your operational process."]],
        chapters: [
            { title: "Start with places your team recognises.", body: "Define operational locations and their geofences. For example, a depot boundary can provide context for a vehicle’s arrival or departure when the tracking integration supplies the required events.", visual: "monitor", points: ["Operational locations", "Geofence boundaries", "Tracking integration requirements"] },
            { title: "Connect events to supported actions.", body: "Review the available conditions and actions against your process. Location events can support operational workflows, but they should not be treated as independent proof that a delivery was completed.", visual: "schedule", points: ["Configured arrival/departure workflows", "Supported conditions and actions", "Operational review of exceptions"] },
        ], steps: [["Define the location", "Identify the site and appropriate boundary."], ["Configure the workflow", "Choose supported conditions and actions for that location."], ["Verify with real events", "Check how the configured integration reports vehicle visits."]],
        faqs: [["Does every tracking provider support the same events?", "No. Event availability and timing depend on the provider and configuration. Verify the intended workflow against your connected integration."], ["Does entering a geofence mark a delivery as proven?", "No. Location events provide context and may support configured actions; they do not independently prove a recipient handover or delivery-document completeness."], ["Can we test a depot workflow in the demo?", "Bring a typical arrival or departure process. We can explain the existing location conditions, supported actions and integration requirements."]], related: ["tracking", "scheduling", "reporting"],
    },
    reporting: {
        headline: "Turn operational records into focused follow-up.",
        intro: "Review shipments, waiting time, speeding, vehicles and delivery documents. Give your team a clearer view of the exceptions that need investigation.",
        problem: "More records should mean clearer decisions.",
        context: "Operational data is most useful when it helps someone take the next step. Spaces brings existing reports together with the shipment, vehicle and document context behind the numbers.",
        benefits: [["Shipment oversight", "Review shipment information across operational work."], ["Vehicle context", "Investigate waiting-time, speeding and vehicle records."], ["Document visibility", "Identify gaps in delivery-document coverage."]],
        chapters: [
            { title: "Review the exceptions behind the day.", body: "Use available shipment, waiting-time, speeding and vehicle reports to investigate operational issues. Tracking-derived results depend on the information supplied by the connected provider.", visual: "reporting", points: ["Shipment reporting", "Waiting-time and speeding reports", "Vehicle reports"] },
            { title: "Bring document completeness into the review.", body: "Missing paperwork can leave an operational task unfinished. Review document reports alongside shipment records to decide where the team needs to follow up.", visual: "documents", points: ["Missing-document reporting", "Document coverage", "Shipment-level context"] },
        ], steps: [["Choose the report", "Start with the operational question you need to answer."], ["Review the records", "Consider the available data and its completeness."], ["Investigate and follow up", "Use related shipment, vehicle or document context with the team."]],
        faqs: [["Which reports are available?", "The existing system includes shipment, waiting-time, speeding, vehicle and document reports. A demo can show the reports relevant to your workflow."], ["Are the figures guaranteed to be complete?", "No. Reports reflect the data recorded in your system and supplied by integrations. Missing or delayed records affect the results."], ["Does Spaces predict future performance?", "This page describes operational reporting and review. It does not claim predictive analytics or guaranteed performance improvements."]], related: ["documents", "tracking", "automation"],
    },
    integrations: {
        headline: "Connect your systems to the operational workflow.",
        intro: "Explore supported tracking integrations and the merchant API. Start with the interfaces that exist today and verify the connection your operation needs.",
        problem: "Integration starts with a clear connection plan.",
        context: "A useful integration needs more than a provider name. It needs the right access, compatible data and an agreed workflow. Spaces provides existing connection points that can be reviewed against your requirements.",
        benefits: [["Tracking connections", "Review available provider integrations and their setup."], ["Developer reference", "Use existing API documentation as the technical starting point."], ["Clear boundaries", "Distinguish supported interfaces from future integration requests."]],
        chapters: [
            { title: "Bring your tracking provider into the conversation.", body: "Spaces includes integrations for MiX/Powerfleet and Fleetboard. Confirm your provider, account access, vehicle identifiers and deployment compatibility before relying on a connection.", visual: "monitor", points: ["Supported provider connections", "Account and vehicle configuration", "Deployment compatibility checks"] },
            { title: "Build against the documented interfaces.", body: "The public developer documentation explains the merchant API. Use it to review available resources, authentication and request formats before planning an integration.", visual: "api", points: ["Existing developer documentation", "Merchant API access", "Documented request and response formats"] },
        ], steps: [["Describe the workflow", "Identify the system, data and operational outcome you need."], ["Check the interface", "Review the existing provider connection or API documentation."], ["Verify the setup", "Confirm access and compatibility in the intended deployment."]],
        faqs: [["Can you connect any tracking provider?", "No universal compatibility is promised. Spaces includes integrations for MiX/Powerfleet and Fleetboard; other connections require a separate review."], ["Where can developers find the API documentation?", "Use the Developer documentation link on this page to review the existing merchant API and its available resources."], ["Does a listed integration mean an official partnership?", "No. Listing an integration describes a technical connection, not a partnership or endorsement by the provider."]], related: ["tracking", "automation", "scheduling"],
    },
};
export function platformFeature(slug: string) {
    return features.find(feature => `platform/${feature.id}` === slug);
}
