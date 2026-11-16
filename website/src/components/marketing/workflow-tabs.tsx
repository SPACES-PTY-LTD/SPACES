"use client";
import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { MarketingVisual } from "./visual";
const panels = [
    {
        label: "Plan",
        visual: "schedule",
        title: "Assign shipments, drivers and vehicles.",
        text: "Organise the work before it leaves the depot.",
        points: [
            "Assign shipments to runs.",
            "Connect drivers and vehicles to the plan.",
            "Review planned stops and unassigned work.",
        ],
    },
    {
        label: "Follow",
        visual: "monitor",
        title: "Review vehicle positions and journeys.",
        text: "Review operational progress alongside available tracking data.",
        points: [
            "Review positions from connected tracking sources.",
            "Explore recorded journeys and stops.",
            "Follow supported geofence arrival and departure events.",
        ],
    },
    {
        label: "Capture",
        visual: "documents",
        title: "Capture and review delivery notes.",
        text: "Connect driver uploads and office review to the shipment record.",
        points: [
            "Upload delivery-note documents.",
            "Review extracted shipment details.",
            "Associate reviewed documents with shipments.",
        ],
    },
    {
        label: "Review",
        visual: "reporting",
        title: "Find missing documents and operational exceptions.",
        text: "Review reports to decide which shipments, stops or records need attention.",
        points: [
            "Check delivery-document coverage.",
            "Review waiting-time and speeding reports.",
            "Investigate shipment and vehicle activity.",
        ],
    },
];
export function WorkflowTabs() {
    const [active, setActive] = useState(0);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    return (
        <div className="workflow-explorer">
            <div
                className="workflow-tabs"
                role="tablist"
                aria-label="Connected workflow"
            >
                {panels.map((panel, index) => (
                    <button
                        key={panel.label}
                        ref={(el) => {
                            tabs.current[index] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`workflow-tab-${index}`}
                        aria-controls={`workflow-panel-${index}`}
                        aria-selected={active === index}
                        tabIndex={active === index ? 0 : -1}
                        onClick={() => setActive(index)}
                        onKeyDown={(event) => {
                            let next = index;
                            if (event.key === "ArrowRight")
                                next = (index + 1) % panels.length;
                            else if (event.key === "ArrowLeft")
                                next =
                                    (index + panels.length - 1) % panels.length;
                            else if (event.key === "Home") next = 0;
                            else if (event.key === "End")
                                next = panels.length - 1;
                            else return;
                            event.preventDefault();
                            setActive(next);
                            tabs.current[next]?.focus();
                        }}
                    >
                        <span>0{index + 1}</span>
                        {panel.label}
                    </button>
                ))}
            </div>
            {panels.map((panel, index) => (
                <div
                    key={panel.label}
                    id={`workflow-panel-${index}`}
                    role="tabpanel"
                    aria-labelledby={`workflow-tab-${index}`}
                    hidden={active !== index}
                    tabIndex={0}
                    className="workflow-panel"
                >
                    <MarketingVisual name={panel.visual} />
                    <div>
                        <h3>{panel.title}</h3>
                        <p className="lede">{panel.text}</p>
                        <ul className="workflow-benefits">
                            {panel.points.map((point) => (
                                <li key={point}><span className="workflow-benefit-icon"><Check size={16} strokeWidth={2} aria-hidden="true" /></span><span>{point}</span></li>
                            ))}
                        </ul>
                    </div>
                </div>
            ))}
        </div>
    );
}
