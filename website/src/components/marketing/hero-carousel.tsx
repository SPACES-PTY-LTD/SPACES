"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const slides = [
    {
        title: "People behind every delivery",
        image: "carousel-driver-photo.webp",
        photo: true,
        alt: "Generated logistics scene of a driver checking assigned work beside a parked delivery truck.",
    },
    {
        title: "Plan the working day",
        image: "feature-schedule-transparent.png",
        photo: false,
        alt: "Illustrative run assignment connecting a driver, vehicle and shipment.",
    },
    {
        title: "Keep dispatch connected",
        image: "carousel-dispatch-photo.webp",
        photo: true,
        alt: "Generated logistics scene of dispatchers reviewing work in an office overlooking a loading yard.",
    },
    {
        title: "Follow the journey",
        image: "feature-tracking-transparent.png",
        photo: false,
        alt: "Illustrative vehicle position and recorded journey on a map.",
    },
    {
        title: "From depot to destination",
        image: "delivery-network.webp",
        photo: true,
        alt: "Illustration of delivery vehicles connecting a depot and delivery destinations.",
    },
    {
        title: "Keep drivers connected",
        image: "carousel-driver-transparent.png",
        photo: false,
        alt: "Illustrative mobile workflow for assigned runs and delivery-note uploads.",
    },
    {
        title: "Connect the fleet",
        image: "connected-fleet.webp",
        photo: true,
        alt: "Illustration of trucks and delivery vehicles connected around a distribution depot.",
    },
    {
        title: "Review operational exceptions",
        image: "feature-reporting-transparent.png",
        photo: false,
        alt: "Illustrative operational reports showing document and waiting-time exceptions.",
    },
    {
        title: "Connect your systems",
        image: "feature-api-transparent.png",
        photo: false,
        alt: "Illustrative merchant API connecting operational systems and shipment records.",
    },
    {
        title: "Bring the records together",
        image: "feature-documents-transparent.png",
        photo: false,
        alt: "Illustrative delivery document with shipment fields ready for review.",
    },
];

export function HeroCarousel() {
    const track = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [hovered, setHovered] = useState(false);
    const reduced = useRef(false);
    useEffect(() => {
        const preference = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );
        const update = () => {
            reduced.current = preference.matches;
            setPlaying(!preference.matches);
        };
        update();
        preference.addEventListener("change", update);
        return () => preference.removeEventListener("change", update);
    }, []);
    const cycleWidth = useRef(0);
    useEffect(() => {
        const rail = track.current;
        if (!rail) return;
        const measure = () => {
            const first = rail.children[0] as HTMLElement;
            const repeat = rail.children[slides.length] as HTMLElement;
            const previous = cycleWidth.current;
            const phase = previous
                ? (rail.scrollLeft % previous) / previous
                : 0;
            cycleWidth.current = repeat.offsetLeft - first.offsetLeft;
            rail.scrollLeft = cycleWidth.current * (1 + phase);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(rail);
        return () => observer.disconnect();
    }, []);
    function move(direction: number) {
        setPlaying(false);
        const rail = track.current;
        if (!rail) return;
        const step = cycleWidth.current / slides.length;
        rail.scrollLeft += direction * step;
    }
    useEffect(() => {
        if (!playing || hovered) return;
        let frame = 0;
        let previous = 0;
        let position = track.current?.scrollLeft ?? 0;
        const tick = (time: number) => {
            const rail = track.current;
            if (rail && cycleWidth.current && !document.hidden) {
                const elapsed = previous ? Math.min(time - previous, 50) : 0;
                position += elapsed * 0.035;
                // Identical copies make this reset invisible at the loop boundary.
                if (position >= cycleWidth.current * 2)
                    position -= cycleWidth.current;
                rail.scrollLeft = position;
            }
            previous = time;
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing, hovered]);
    return (
        <section
            className="landing-gallery"
            aria-label="Spaces logistics in action"
            aria-roledescription="carousel"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setPlaying(false)}
        >
            <div
                className="landing-gallery-track"
                ref={track}
                tabIndex={0}
                aria-label="Logistics image gallery. Use left and right arrow keys to browse."
                onTouchStart={() => setPlaying(false)}
                onWheel={() => setPlaying(false)}
                onKeyDown={(event) => {
                    if (
                        event.key === "ArrowRight" ||
                        event.key === "ArrowLeft"
                    ) {
                        event.preventDefault();
                        move(event.key === "ArrowRight" ? 1 : -1);
                    }
                }}
                onScroll={() => {
                    const rail = track.current;
                    const cycle = cycleWidth.current;
                    if (!rail || !cycle) return;
                    if (rail.scrollLeft < cycle) rail.scrollLeft += cycle;
                    else if (rail.scrollLeft >= cycle * 2)
                        rail.scrollLeft -= cycle;
                    setActive(
                        Math.floor(
                            (rail.scrollLeft % cycle) / (cycle / slides.length),
                        ) % slides.length,
                    );
                }}
            >
                {[...slides, ...slides, ...slides].map((slide, index) => (
                    <figure
                        className={`landing-gallery-card ${slide.photo ? "is-scene" : "is-ui"}`}
                        key={`${slide.title}-${index}`}
                        aria-hidden={
                            index < slides.length || index >= slides.length * 2
                        }
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${(index % slides.length) + 1} of ${slides.length}: ${slide.title}`}
                    >
                        <div className="landing-gallery-image">
                            <Image
                                src={`/images/marketing/${slide.image}`}
                                alt={slide.alt}
                                fill
                                sizes="(max-width: 760px) 78vw, 380px"
                                priority={
                                    index >= slides.length &&
                                    index < slides.length + 4
                                }
                            />
                        </div>

                    </figure>
                ))}
            </div>
            <div className="landing-gallery-footer">
                <p>
                    People. Planning. Movement. One connected operation.

                </p>
                <div className="landing-gallery-controls">
                    <span className="gallery-position" aria-live="off">
                        {String(Math.min(active + 1, slides.length)).padStart(
                            2,
                            "0",
                        )}{" "}
                        / {String(slides.length).padStart(2, "0")}
                    </span>
                    <button
                        type="button"
                        aria-label="Previous images"
                        onClick={() => move(-1)}
                    >
                        ←
                    </button>
                    <button
                        type="button"
                        aria-label={playing ? "Pause gallery" : "Play gallery"}
                        onClick={() => setPlaying(!playing)}
                    >
                        {playing ? "Ⅱ" : "▶"}
                    </button>
                    <button
                        type="button"
                        aria-label="Next images"
                        onClick={() => move(1)}
                    >
                        →
                    </button>
                </div>
            </div>
        </section>
    );
}
