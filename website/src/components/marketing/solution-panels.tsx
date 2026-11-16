"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, Building2, Check, FileText, MapPin, Package, Truck, Users } from "lucide-react";

const benefits = [
    { title: "Scalable solution", label: "Built around your team", description: "Bring vehicles, drivers and locations into one workspace as your operation grows. Organise responsibilities with role-based access.", href: "/platform" },
    { title: "Streamline fleet management", label: "Keep the work connected", description: "Plan runs, assign drivers and vehicles, and keep shipment documents together—from dispatch to delivery-note review.", href: "/platform/scheduling" },
    { title: "Useful Reporting", label: "Know what needs attention", description: "Review shipment activity, waiting time, speeding and document coverage. Find exceptions that need your team’s follow-up.", href: "/platform/reporting" },
];

function FleetScene() {
    return <div className="solution-scene fleet-scene" aria-hidden="true">
        <div className="fleet-orbit orbit-outer" /><div className="fleet-orbit orbit-inner" />
        <svg className="fleet-connections" viewBox="0 0 320 320" fill="none">
            <path d="M160 160L66 70M160 160L260 100M160 160L76 253M160 160L248 248" />
            <path className="fleet-signal" d="M160 160L66 70M160 160L260 100M160 160L76 253M160 160L248 248" />
        </svg>
        <div className="fleet-hub"><span>spaces</span><small>One workspace</small></div>
        <div className="fleet-node node-vehicles"><Truck size={23} /><span>Vehicles</span></div>
        <div className="fleet-node node-team"><Users size={23} /><span>Your team</span></div>
        <div className="fleet-node node-depots"><Building2 size={23} /><span>Depots</span></div>
        <div className="fleet-node node-locations"><MapPin size={23} /><span>Locations</span></div>
    </div>;
}

function DispatchScene() {
    return <div className="solution-scene dispatch-scene" aria-hidden="true">
        <div className="dispatch-board">
            <div className="scene-window-top"><span /><span /><span /><b>Dispatch workspace</b></div>
            <div className="dispatch-lane-head"><span>Ready to plan</span><span>Assigned run</span></div>
            <div className="dispatch-lanes">
                <div className="dispatch-lane"><div className="shipment-placeholder" /><div className="shipment-placeholder" /></div>
                <div className="dispatch-lane"><div className="run-mini"><Truck size={17} /><span>Morning run</span></div><div className="assignment-target" /></div>
            </div>
            <div className="moving-shipment"><Package size={21} /><div><strong>Shipment</strong><span>Ready for dispatch</span></div><Check size={16} className="shipment-check" /></div>
        </div>
        <div className="dispatch-driver scene-float"><span className="scene-icon"><Users size={18} /></span><div><strong>Driver assigned</strong><small>Connected to the run</small></div><span className="scene-check"><Check size={14} /></span></div>
        <div className="dispatch-route"><MapPin size={15} /><span>Depot</span><i /><Truck size={18} /><i /><span>Delivery</span></div>
    </div>;
}

function ReportingScene() {
    return <div className="solution-scene reports-scene" aria-hidden="true">
        <div className="report-board">
            <div className="report-board-title"><BarChart3 size={19} /><strong>Operational overview</strong><span /></div>
            <div className="report-tabs"><span>Shipments</span><span>Waiting time</span></div>
            <div className="report-chart">{[48, 70, 54, 88, 64, 78, 56].map((height, i) => <i key={i} style={{ height: height + "%", animationDelay: `-${i * .45}s` }} />)}<div className="chart-scan" /></div>
            <div className="report-axis"><span>Review activity</span><span>Find exceptions</span></div>
        </div>
        <div className="report-alert scene-float"><span className="scene-icon"><FileText size={20} /></span><div><strong>Document review</strong><small>See what needs attention</small></div><span className="alert-pulse" /></div>
    </div>;
}

export function SolutionPanels() {
    const [visible, setVisible] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .1 });
        if (root.current) observer.observe(root.current);
        return () => observer.disconnect();
    }, []);
    return <div className="solution-showcase" ref={root} data-motion={!visible ? "paused" : "playing"}>
        <div className="solution-panels">
            {benefits.map((item, index) => <Link href={item.href} aria-labelledby={`solution-title-${index}`} className={`solution-panel solution-panel-${index + 1}`} key={item.title}>
                <div className="solution-panel-art">{index === 0 ? <FleetScene /> : index === 1 ? <DispatchScene /> : <ReportingScene />}</div>
                <div className="solution-panel-copy">
                    <p className="solution-panel-label">{item.label}</p><h3 id={`solution-title-${index}`}>{item.title}</h3><p>{item.description}</p>
                </div>
            </Link>)}
        </div>
    </div>;
}
