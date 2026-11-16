"use client";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Menu, X, CalendarDays, MapPinned, Smartphone, FileCheck2, MapPin, ChartNoAxesCombined, Plug, Truck, Warehouse, Package, Store, BookOpen, LifeBuoy, Code2, Fuel, Building2, BriefcaseBusiness, MessagesSquare, CircleHelp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
export type NavItem = {
    label: string;
    href: string;
    children?: { label: string; href: string; description?: string; group?: string }[];
};
const navIcons = { faq: CircleHelp, company: Building2, careers: BriefcaseBusiness, contact: MessagesSquare, "fuel-depots": Fuel, scheduling: CalendarDays, tracking: MapPinned, "driver-app": Smartphone, documents: FileCheck2, automation: MapPin, reporting: ChartNoAxesCombined, integrations: Plug, "road-freight": Truck, "wholesale-distribution": Warehouse, "courier-operations": Package, "retail-delivery": Store, blog: BookOpen, support: LifeBuoy, docs: Code2 };
function NavIcon({ href }: { href: string }) {
    const key = href.split(/[\/#]/).filter(Boolean).pop() as keyof typeof navIcons;
    const Icon = navIcons[key] ?? BookOpen;
    return <Icon size={21} strokeWidth={1.6} aria-hidden="true" />;
}
export function MarketingNavigation({ items }: { items: NavItem[] }) {
    const [open, setOpen] = useState<string | null>(null);
    const [mobile, setMobile] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearLeave = () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); };
    useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);
    useEffect(() => {
        setOpen(null);
        setMobile(false);
    }, [pathname]);
    useEffect(() => {
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) {
                setOpen(null);
                setMobile(false);
            }
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, []);
    const close = () => {
        setOpen(null);
        setMobile(false);
    };
    return (
        <div
            className="navigation"
            ref={root}
            onPointerEnter={clearLeave}
            onPointerLeave={(event) => {
                if (event.pointerType !== "mouse" || !window.matchMedia("(min-width: 1101px)").matches) return;
                clearLeave();
                leaveTimer.current = setTimeout(() => {
                    if (!root.current?.contains(document.activeElement)) setOpen(null);
                }, 160);
            }}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    if (open)
                        root.current
                            ?.querySelector<HTMLButtonElement>(
                                `[data-nav="${open}"]`,
                            )
                            ?.focus();
                    else
                        root.current
                            ?.querySelector<HTMLButtonElement>(".mobile-toggle")
                            ?.focus();
                    setOpen(null);
                    if (!open) setMobile(false);
                }
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) close();
            }}
        >
            <button
                className="mobile-toggle"
                aria-expanded={mobile}
                aria-controls="main-navigation"
                onClick={() => {
                    setMobile(!mobile);
                    setOpen(null);
                }}
            >
                {mobile ? <>Close <X size={16} aria-hidden="true" /></> : <>Menu <Menu size={16} aria-hidden="true" /></>}
            </button>
            <nav
                id="main-navigation"
                className={`main-navigation ${mobile ? "is-mobile-open" : ""}`}
                aria-label="Main navigation"
            >
                {items.map((item) => (
                    <div className="nav-item" key={item.href} onPointerEnter={(event) => {
                        if (event.pointerType === "mouse" && window.matchMedia("(min-width: 1101px)").matches) {
                            clearLeave(); setOpen(item.children?.length ? item.label : null);
                        }
                    }}>
                        {item.children?.length ? (
                            <>
                                <button
                                    data-nav={item.label}
                                    className="nav-trigger"
                                    aria-expanded={open === item.label}
                                    aria-controls={`nav-${item.label}`}
                                    onKeyDown={(event) => {
                                        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(item.label); requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>(`#nav-${item.label} a`)?.focus()); }
                                    }}
                                    onClick={(event) => {
                                        const desktopPointer = event.detail > 0 && window.matchMedia("(min-width: 1101px) and (hover: hover)").matches;
                                        setOpen(desktopPointer ? item.label : open === item.label ? null : item.label);
                                    }}
                                >
                                    {item.label}
                                    <ChevronDown className="nav-chevron" size={14} aria-hidden="true" />
                                </button>
                                <div
                                    id={`nav-${item.label}`}
                                    className="nav-dropdown"
                                    hidden={open !== item.label}
                                >
                                    <div className={`nav-menu-columns ${item.children.some(child => child.group) ? "is-grouped" : "is-flat"}`}>
                                        {[...new Set(item.children.map(child => child.group ?? item.label))].map(group => (
                                            <section className="nav-menu-group" key={group} aria-label={group}>
                                                <h2>{group}</h2>
                                                <div className="nav-menu-items">{item.children!.filter(child => (child.group ?? item.label) === group).map(child => (
                                                    <Link href={child.href} key={child.href} onClick={close}>
                                                        <span className="nav-icon"><NavIcon href={child.href} /></span>
                                                        <span className="nav-link-copy"><strong>{child.label}</strong>{child.description && <small>{child.description}</small>}</span>
                                                    </Link>
                                                ))}</div>
                                            </section>
                                        ))}
                                    </div>
                                    <div className="nav-overview"><Link href={item.href} onClick={close}>View {item.label.toLowerCase()} overview <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
                                </div>
                            </>
                        ) : (
                            <Link
                                className="nav-direct"
                                href={item.href}
                                onClick={close}
                            >
                                {item.label}
                            </Link>
                        )}
                    </div>
                ))}
                <div className="mobile-utilities">
                    <Link href="/support" onClick={close}>
                        Support centre
                    </Link>
                    <Link href="/auth/login" onClick={close}>
                        Log in
                    </Link>
                </div>
            </nav>
        </div>
    );
}
