import type { PublishedContent } from "./types";
export type BlogSection = { title: string; paragraphs: string[]; checklist: string[] };
export type BlogArticle = { slug: string; title: string; description: string; category: string; image: string; editorialDate: string; feature: string; sections: BlogSection[] };
export const libraryPublishedAt = "2026-10-30T08:00:00+02:00";
export const blogAuthor = "Spaces Digital Editorial Team";
export const blogPosts: BlogArticle[] = [
  {
    "slug": "blog/delivery-document-completeness",
    "title": "A delivery is only as clear as its documents",
    "description": "Build a practical document-review routine that connects delivery paperwork to the right shipment.",
    "category": "Delivery operations",
    "image": "/images/marketing/blog-documents.webp",
    "editorialDate": "2026-10-30",
    "feature": "documents",
    "sections": [
      {
        "title": "Define what complete means",
        "paragraphs": [
          "A file being uploaded does not necessarily mean a delivery record is complete. A photograph may be unreadable, a page may be missing, or the document may belong to another shipment. Define the documents your team expects for each workflow before deciding that a record is ready for review.",
          "Use one shared checklist across dispatch and the back office. Requirements can differ by customer, but reviewers should not have to reconstruct them from an email thread."
        ],
        "checklist": [
          "Check the shipment reference and delivery location.",
          "Confirm all required pages are present and readable.",
          "Check that the file is associated with the correct shipment."
        ]
      },
      {
        "title": "Review while the journey is still fresh",
        "paragraphs": [
          "Set aside a regular review window during the working day. An unclear delivery note is easier to investigate while the driver and dispatcher still remember the stop. Record what needs correcting and who will follow up, rather than simply asking for “the paperwork”.",
          "For example, if a two-page note arrives as one photograph, ask for the missing page against the same shipment reference. Avoid creating a second shipment just to store the additional document."
        ],
        "checklist": []
      },
      {
        "title": "Use capture and review as separate steps",
        "paragraphs": [
          "Spaces supports delivery-note uploads and document workflows that associate records with shipments. Treat capture as the start of the process: your team still needs to check legibility, completeness and context. Document imports also need the same review discipline.",
          "An uploaded document is not, by itself, evidence of an independently verified electronic signature. Keep your customer acceptance requirements separate from the fact that a file exists."
        ],
        "checklist": []
      },
      {
        "title": "Make the handover explicit",
        "paragraphs": [
          "At the end of a shift, pass on a short list of unresolved document issues with shipment references and owners. This gives the next team a concrete starting point and avoids repeated requests to drivers. Review recurring gaps weekly: the solution may be clearer instructions at dispatch rather than more reminders after delivery."
        ],
        "checklist": [
          "Keep original files where your retention policy requires them.",
          "Use approved channels for documents containing personal information.",
          "Escalate missing or disputed records through your agreed process."
        ]
      }
    ]
  },
  {
    "slug": "blog/understanding-depot-waiting-time",
    "title": "Where does the waiting time go?",
    "description": "Separate queueing, loading and delivery delays before deciding what to change.",
    "category": "Fleet visibility",
    "image": "/images/marketing/blog-waiting-time.webp",
    "editorialDate": "2026-10-23",
    "feature": "reporting",
    "sections": [
      {
        "title": "Agree on the clock you are measuring",
        "paragraphs": [
          "“Time at site” can include waiting outside the gate, a security check, loading, unloading and paperwork. It is not automatically a measure of inefficient driving or poor service. Agree which events define your reporting interval before comparing sites or vehicles.",
          "A geofence arrival and departure can help describe a visit, but they may not identify the exact start of loading. A large boundary can include a nearby road; an incomplete tracking feed can leave gaps."
        ],
        "checklist": []
      },
      {
        "title": "Add operational context",
        "paragraphs": [
          "Take a small sample of visits and compare recorded times with the dispatch record and the team’s explanation. Was an appointment changed? Was the receiving bay occupied? Did the vehicle arrive before the agreed window? These questions make the report useful for discussion.",
          "A hypothetical visit lasting ninety minutes might contain thirty minutes before the booked window and sixty minutes on site. Treating the entire period as avoidable delay would lead to the wrong conclusion."
        ],
        "checklist": [
          "Compare similar sites and delivery types.",
          "Check the source and timezone of timestamps.",
          "Separate missing data from a genuinely short visit."
        ]
      },
      {
        "title": "Turn a report into an action",
        "paragraphs": [
          "Spaces includes waiting-time reporting alongside shipment and vehicle reports. Use these records to identify visits worth investigating, then agree one operational change with the responsible team. This could be confirming receiving hours before dispatch or making paperwork available before the truck arrives.",
          "Keep a note of the change and review comparable visits afterwards. A change in the average is a prompt to investigate, not proof that one action caused an improvement."
        ],
        "checklist": []
      },
      {
        "title": "Keep the review constructive",
        "paragraphs": [
          "Start with the process rather than assigning blame. Drivers, dispatchers and receiving teams each see a different part of the visit. A short recurring review with a few concrete examples is more actionable than a large spreadsheet with no owner."
        ],
        "checklist": [
          "Choose an owner for each recurring issue.",
          "Record the next action and review date.",
          "Retain unusual visits in the explanation instead of silently removing them."
        ]
      }
    ]
  },
  {
    "slug": "blog/planning-a-dispatch-day",
    "title": "A calmer dispatch day starts before the first run",
    "description": "A practical sequence for preparing shipments, assigning runs and handing over exceptions.",
    "category": "Planning & dispatch",
    "image": "/images/marketing/blog-dispatch.webp",
    "editorialDate": "2026-10-16",
    "feature": "scheduling",
    "sections": [
      {
        "title": "Start with a reliable shipment list",
        "paragraphs": [
          "Before assigning work, check that each shipment has enough information for dispatch: a usable delivery location, the relevant reference and any operational instructions your team needs. A planning screen cannot resolve missing customer information on its own.",
          "Keep late additions visible. If a shipment arrives after the day’s plan is agreed, decide who can approve the change and who must be informed. This is especially useful when warehouse loading and driver preparation happen at different times."
        ],
        "checklist": []
      },
      {
        "title": "Build runs around real constraints",
        "paragraphs": [
          "Use Spaces scheduling and run management to organise shipments and assignments. Review the proposed work against vehicle availability, driver arrangements and known customer requirements. Describe this as route planning; do not assume that the system automatically optimises every route or checks every operating constraint.",
          "A hypothetical extra delivery may look close on a map but still conflict with a receiving window or require a different vehicle. Give dispatchers a clear way to raise these conflicts before departure."
        ],
        "checklist": [
          "Confirm the vehicle and driver assignment.",
          "Check the delivery sequence and location details.",
          "Resolve missing documents and special instructions."
        ]
      },
      {
        "title": "Make changes understandable",
        "paragraphs": [
          "When the plan changes, communicate the affected run and the specific change. “Use the latest schedule” is less helpful than identifying which shipment moved and why. Confirm that the people carrying out the work have the information they need.",
          "The driver app provides assigned-run workflows. Include a check of access and the assigned work in your departure routine; do not assume every driver has seen an update simply because dispatch has saved it."
        ],
        "checklist": []
      },
      {
        "title": "Close the day with an exception handover",
        "paragraphs": [
          "Review unfinished shipments, unresolved document issues and runs that need follow-up. Assign an owner and next action to each issue. A brief handover prevents the next shift from starting with a fresh investigation of the same problem."
        ],
        "checklist": [
          "Keep the shipment or run reference in every handover item.",
          "Distinguish confirmed facts from questions still being investigated.",
          "Use recurring exceptions to improve tomorrow’s preparation."
        ]
      }
    ]
  },
  {
    "slug": "blog/investigating-tracking-exceptions",
    "title": "From a map pin to a useful operational answer",
    "description": "Use vehicle tracking and recorded journeys with context, rather than treating every dot as the whole story.",
    "category": "Fleet visibility",
    "image": "/images/marketing/blog-tracking.webp",
    "editorialDate": "2026-10-09",
    "feature": "tracking",
    "sections": [
      {
        "title": "Ask a specific question",
        "paragraphs": [
          "A map is most useful when it helps answer a concrete operational question: did the vehicle reach the site, which journey should be reviewed, or when was the last usable position received? Start with that question rather than scanning every vehicle for something unusual.",
          "Spaces supports vehicle visibility and recorded-journey workflows where the required tracking integration is connected. Availability and freshness depend on the connected source and its data."
        ],
        "checklist": []
      },
      {
        "title": "Check freshness before drawing conclusions",
        "paragraphs": [
          "Look at the timestamp attached to the position. A last-known location describes a recorded observation; it does not guarantee that the vehicle is still there. Connectivity, device configuration and the provider’s reporting frequency can affect what you see.",
          "If a vehicle appears stationary, inspect the available journey context and ask whether the data is current. Contact the appropriate operational team through your normal process rather than interpreting a stale point as a confirmed breakdown."
        ],
        "checklist": [
          "Identify the vehicle and relevant run.",
          "Check the latest timestamp and reporting source.",
          "Look for gaps in the recorded journey."
        ]
      },
      {
        "title": "Connect the journey to the work",
        "paragraphs": [
          "Compare the journey with the shipment, intended stop and any available site events. A vehicle passing near a customer does not necessarily confirm delivery. Delivery documents and the team’s operational records may be needed to understand what happened.",
          "For a hypothetical disputed visit, gather the recorded journey, relevant timestamps and shipment documents together. Keep the uncertainty visible if the available evidence does not establish the sequence."
        ],
        "checklist": []
      },
      {
        "title": "Build a repeatable investigation routine",
        "paragraphs": [
          "Use a short template: question, records checked, confirmed findings, remaining uncertainty and next action. This makes investigations easier to hand over and helps distinguish a recurring data-quality issue from an operational exception.",
          "Before enabling a new tracking connection, confirm supported data, vehicle matching and access with the implementation team. A successful connection alone is not a guarantee that every operational view will have complete history."
        ],
        "checklist": []
      }
    ]
  },
  {
    "slug": "blog/clear-driver-document-uploads",
    "title": "Help drivers capture documents the office can use",
    "description": "A simple capture routine for readable delivery notes and fewer follow-up requests.",
    "category": "Driver workflows",
    "image": "/images/marketing/blog-driver.webp",
    "editorialDate": "2026-10-02",
    "feature": "driver-app",
    "sections": [
      {
        "title": "Make the instruction specific",
        "paragraphs": [
          "“Upload the note” leaves room for different interpretations. Explain which document is needed, which pages to capture and how the driver should identify the assigned work. Use a sample without customer information when training the team.",
          "Spaces provides assigned-run and delivery-note upload workflows in the driver app. Confirm the workflow enabled for your deployment during onboarding, including the access and connectivity needed to complete an upload."
        ],
        "checklist": []
      },
      {
        "title": "Capture when safely parked",
        "paragraphs": [
          "Document capture should happen when the vehicle is safely stationary in an appropriate place. Do not ask a driver to operate a phone while driving or while carrying out work that requires their full attention. Site rules may further restrict phone use.",
          "Place the paper on a stable surface with enough light. Check that the edges and all relevant details are visible. A second photograph is useful when it replaces an unreadable one; a collection of unexplained duplicates makes review harder."
        ],
        "checklist": [
          "Include the whole page and avoid covering details with a hand.",
          "Check glare, blur and dark shadows.",
          "Capture every required page in the correct order."
        ]
      },
      {
        "title": "Confirm the association and result",
        "paragraphs": [
          "Before finishing, check that the document belongs to the intended shipment or assigned work. Review the upload feedback. If there is an error, follow your agreed escalation process and retain the original document as required.",
          "Do not promise offline uploading or automatic background retries unless those behaviours have been verified for the deployed app. Drivers need clear instructions for connectivity problems rather than assumptions about what will sync later."
        ],
        "checklist": []
      },
      {
        "title": "Give useful feedback",
        "paragraphs": [
          "If the office requests a replacement, identify the exact issue: missing second page, unreadable reference or incorrect shipment association. Repeated problems should lead to a better capture instruction or a training example.",
          "Keep physical originals and personal information according to your company’s policies. Uploading a note does not replace every contractual requirement and should not be described as a separately verified signature service."
        ],
        "checklist": []
      }
    ]
  },
  {
    "slug": "blog/geofences-that-match-real-sites",
    "title": "Build geofences around the way your sites work",
    "description": "Make arrival and departure events easier to interpret with sensible boundaries and a review routine.",
    "category": "Fleet visibility",
    "image": "/images/marketing/blog-geofences.webp",
    "editorialDate": "2026-09-25",
    "feature": "automation",
    "sections": [
      {
        "title": "Choose the operational meaning first",
        "paragraphs": [
          "Decide what “arrived” means for the site. Entering a property, reaching a receiving yard and arriving at a loading bay are different events. A boundary should represent the event you want to observe, not simply look neat on a map.",
          "Spaces supports geofences and location-based arrival/departure workflows. These depend on the tracking data and configuration available to your deployment. They are operational signals rather than proof that a delivery was accepted."
        ],
        "checklist": []
      },
      {
        "title": "Watch the neighbouring roads",
        "paragraphs": [
          "A boundary that includes a public road may capture passing vehicles. A very tight boundary can miss legitimate visits when reported locations vary or positions arrive infrequently. Review the entrance, waiting area and nearby access roads together.",
          "For example, a depot queue may form outside the main gate. Decide whether that queue belongs in the definition of time at site. If it does not, explain that the recorded visit may exclude some waiting."
        ],
        "checklist": [
          "Check the gate and usual entry route.",
          "Review shared yards and neighbouring businesses.",
          "Identify where vehicles wait before admission."
        ]
      },
      {
        "title": "Validate with known visits",
        "paragraphs": [
          "After configuration, compare a sample of recorded events with visits your operations team understands. Check whether the timing is plausible and whether the boundary captures the intended activity. Adjust configuration through your normal authorised process.",
          "Do not tune the boundary solely to one unusual visit. Look at more than one vehicle and more than one day, while keeping device and reporting differences in mind."
        ],
        "checklist": []
      },
      {
        "title": "Keep an owner for site changes",
        "paragraphs": [
          "Entrances move, yards expand and temporary access arrangements appear. Give someone responsibility for reviewing the configuration when a site changes. A dated note about the boundary’s purpose helps the next administrator maintain it.",
          "Use events alongside shipments, journeys and documents. If a location event is missing, investigate the data and configuration before concluding that the visit never occurred."
        ],
        "checklist": []
      }
    ]
  },
  {
    "slug": "blog/wholesale-warehouse-to-dispatch-handover",
    "title": "Connect the warehouse handover to the delivery run",
    "description": "Keep references, assignments and documents aligned as goods move from warehouse to vehicle.",
    "category": "Industry workflows",
    "image": "/images/marketing/blog-wholesale.webp",
    "editorialDate": "2026-09-18",
    "feature": "scheduling",
    "sections": [
      {
        "title": "Agree on the shared reference",
        "paragraphs": [
          "Warehouse and transport teams may organise work differently. One thinks in orders and picked goods; the other thinks in shipments, stops and runs. Agree which reference follows the work across the handover so that both teams can locate the same delivery.",
          "Spaces can organise shipments into schedules and runs and associate delivery documents with shipments. It should not be presented as a replacement for a warehouse inventory system or proof that stock has been reconciled."
        ],
        "checklist": []
      },
      {
        "title": "Make readiness a real conversation",
        "paragraphs": [
          "Before dispatch, confirm whether the goods and required paperwork are ready. Identify partial loads, missing items and changed delivery instructions through the warehouse’s approved process. Avoid treating a scheduled departure as confirmation that the warehouse has finished preparing the load.",
          "In a hypothetical split order, two vehicles may carry different parts of the delivery. Preserve clear references and explain the split to the receiving team; do not rely on the driver to infer it from similar paperwork."
        ],
        "checklist": [
          "Confirm the shipment and customer location.",
          "Identify changes to the planned load.",
          "Check the assigned run, vehicle and supporting documents."
        ]
      },
      {
        "title": "Keep execution visible",
        "paragraphs": [
          "Once work is assigned, dispatch needs a practical way to follow progress and identify issues requiring attention. Vehicle visibility depends on the configured tracking integration, while driver and document workflows provide another part of the operational record.",
          "Keep those sources distinct. A vehicle at a site is not the same as a confirmed stock receipt, and a document upload may still need review."
        ],
        "checklist": []
      },
      {
        "title": "Reconcile the handover at day end",
        "paragraphs": [
          "Use the shipment references to review unresolved deliveries and missing paperwork with the warehouse and back office. Assign responsibility for investigating discrepancies rather than placing every issue in a general “transport” bucket.",
          "Look for recurring causes such as last-minute reference changes or unclear partial-delivery instructions. A small improvement to the handover can make the whole record easier to understand without adding a new form for every department."
        ],
        "checklist": []
      }
    ]
  },
  {
    "slug": "blog/fuel-depot-transport-coordination",
    "title": "A clearer transport record for fuel-depot teams",
    "description": "Connect dispatch, vehicle journeys and delivery paperwork while keeping specialist fuel controls separate.",
    "category": "Industry workflows",
    "image": "/images/marketing/blog-fuel.webp",
    "editorialDate": "2026-09-11",
    "feature": "documents",
    "sections": [
      {
        "title": "Separate transport coordination from fuel controls",
        "paragraphs": [
          "Fuel-depot operations involve specialist equipment, procedures and responsibilities. A transport platform can help organise the movement and its records, but that does not establish loading safety, product quality, quantity accuracy or regulatory compliance.",
          "Spaces supports planning, run assignments, available vehicle tracking and delivery-document workflows. It is not being offered here as a tank-level, fuel-metering, compartment-management or hazardous-goods compliance system."
        ],
        "checklist": []
      },
      {
        "title": "Create a connected dispatch record",
        "paragraphs": [
          "Start with the shipment reference, destination and assigned run. Keep the transport instructions your team is authorised to use accessible through the agreed workflow. Specialist product, loading and safety checks remain within the depot’s approved systems and procedures.",
          "For example, a destination change should trigger an operational review by the responsible team. Moving a stop in a transport plan does not itself approve a change to a loading instruction or delivery authorisation."
        ],
        "checklist": [
          "Confirm the delivery reference and destination.",
          "Check the run and vehicle assignment.",
          "Identify which specialist records must be handled elsewhere."
        ]
      },
      {
        "title": "Use location data with clear limits",
        "paragraphs": [
          "Where a supported tracking connection is configured, vehicle visibility and recorded journeys can help dispatch investigate progress. Geofences may provide site-arrival context, subject to the source data and configuration.",
          "Neither a map position nor a site event confirms a transfer quantity, product identity or successful unloading. Keep the distinction explicit in reports and in conversations with customers."
        ],
        "checklist": []
      },
      {
        "title": "Bring paperwork into the review",
        "paragraphs": [
          "Associate relevant uploaded delivery documents with the shipment so the back office can find and review them. Check legibility, references and completeness through your internal process. Capture must follow site rules, including restrictions on phones and other equipment.",
          "Use a product walkthrough to confirm how Spaces fits your transport workflow and where specialist systems remain necessary. Discuss integration requirements before assuming that a depot system or instrument can connect."
        ],
        "checklist": []
      }
    ]
  },
  {
    "slug": "blog/weekly-fleet-operations-review",
    "title": "Five questions for a useful weekly operations review",
    "description": "Turn shipment, waiting-time, vehicle and document reports into a manageable action list.",
    "category": "Operational improvement",
    "image": "/images/marketing/blog-reporting.webp",
    "editorialDate": "2026-09-04",
    "feature": "reporting",
    "sections": [
      {
        "title": "Begin with questions, not a dashboard export",
        "paragraphs": [
          "A useful review answers a small set of operational questions. Which shipments still need attention? Where did visits take longer than expected? Which documents remain incomplete? Which vehicle records need investigation? What did we change after last week’s review?",
          "Spaces includes shipment, waiting-time, speeding, vehicle and document reporting. Choose reports that answer your current question instead of assuming every available measure belongs in the meeting."
        ],
        "checklist": []
      },
      {
        "title": "Check the meaning behind the number",
        "paragraphs": [
          "Confirm the reporting period, filters and data source. A count of missing documents depends on which documents are expected; a waiting-time figure depends on the events used to define a visit. Comparisons are useful only when those definitions are understood.",
          "Treat a speeding record as something to review with the relevant source and operational context. Do not turn an isolated record into a conclusion about a person without checking it through your established process."
        ],
        "checklist": [
          "Use a consistent reporting period.",
          "State what is included and excluded.",
          "Separate data-quality problems from operational findings."
        ]
      },
      {
        "title": "Pick a few examples to investigate",
        "paragraphs": [
          "Select representative cases rather than only the largest number. One unusual visit may explain a spike, while repeated smaller delays may point to a more persistent problem. Add the run, shipment or vehicle reference so that someone else can reproduce the investigation.",
          "A hypothetical document backlog might come from late uploads, unreadable files or incorrect associations. Each cause calls for a different action; a single backlog total cannot tell you which process to change."
        ],
        "checklist": []
      },
      {
        "title": "Leave with owners and a review date",
        "paragraphs": [
          "For each agreed action, record the owner, next step and date for review. At the next meeting, check whether the action happened and what the comparable records show. Avoid presenting a short-term change as a guaranteed improvement.",
          "Keep the meeting focused on decisions the team can make. Larger system, supplier or customer issues may need a separate discussion with the right people and evidence."
        ],
        "checklist": []
      }
    ]
  },
  {
    "slug": "blog/prepare-for-a-fleet-integration",
    "title": "Before connecting a tracking provider, ask these questions",
    "description": "Prepare your vehicle mapping, access and data expectations for a more useful integration discussion.",
    "category": "Product guidance",
    "image": "/images/marketing/blog-integrations.webp",
    "editorialDate": "2026-08-28",
    "feature": "integrations",
    "sections": [
      {
        "title": "Describe the outcome you need",
        "paragraphs": [
          "Start with the operational question the connection should answer. Do you need vehicle positions, recorded journeys or information for a specific report? A provider having an API does not mean every desired workflow is supported by the current Spaces integration.",
          "Use the integrations page and existing developer documentation to discuss supported connections. Confirm the provider, deployment requirements and available data with the implementation team before promising a capability to customers."
        ],
        "checklist": []
      },
      {
        "title": "Prepare clean vehicle matching",
        "paragraphs": [
          "The same vehicle may have different identifiers in your fleet records and the provider’s system. Prepare an authorised mapping and decide who maintains it when vehicles or devices change. Incorrect matching can make otherwise valid tracking data misleading.",
          "Avoid sending credentials in ordinary messages or adding them to a spreadsheet used for operational handover. Use the approved configuration process and limit access to the people who need it."
        ],
        "checklist": [
          "List the vehicles included in the connection.",
          "Confirm the corresponding provider identifiers.",
          "Assign an owner for changes and access reviews."
        ]
      },
      {
        "title": "Agree on freshness and history",
        "paragraphs": [
          "Ask how often data becomes available, which historical records can be retrieved and what happens when the source is unavailable. These details determine how the operational team should interpret a last-known location or a gap in a journey.",
          "Spaces uses encrypted integration settings where implemented, but that fact alone should not be expanded into a claim about universal encryption or every external provider’s security. Review each connection’s actual handling and permissions."
        ],
        "checklist": []
      },
      {
        "title": "Validate the workflow after connection",
        "paragraphs": [
          "Test a small, authorised sample of vehicles and known journeys. Check that the vehicle identity, timestamps and available records are consistent with the source. Then verify the operational views that depend on the connection, rather than stopping at a successful connection message.",
          "Document who investigates missing data and how users should report it. Include the relevant vehicle and time range, without sharing secrets or unnecessary personal information. Revisit the mapping and access when your fleet or provider configuration changes."
        ],
        "checklist": []
      }
    ]
  }
];
export function blogArticle(slug: string) { return blogPosts.find(post => post.slug === slug); }
export function blogContent(): PublishedContent[] {
 return blogPosts.map((post, index) => ({ id: -1000-index, kind: "blog", slug: post.slug, published_at: libraryPublishedAt, content: { title: post.title, description: post.description, body: "", author: blogAuthor, category: post.category, image: post.image, image_alt: `Illustrative logistics scene for ${post.title}` } }));
}
// Only pass the public endpoint's published records here, never admin draft records.
// A published CMS article with the same slug supersedes its built-in version.
export function withBlogLibrary(published: PublishedContent[] | null): PublishedContent[] {
 return [...new Map([...blogContent(), ...(published ?? [])].map(post => [post.slug, post])).values()];
}
export function formatArticleDate(date: string) { return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(date)); }
