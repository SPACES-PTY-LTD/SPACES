import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type Industry = { title: string; slug: string; text: string };

export function IndustryExplorer({ industries }: { industries: Industry[] }) {
    return (
        <div className="industry-mosaic">
            {industries.map(industry => (
                <Link className="industry-tile" id={industry.slug} key={industry.slug} href={`/industries/${industry.slug}`}>
                    <Image
                        src={`/images/marketing/industry-${industry.slug}.webp`}
                        alt=""
                        fill
                        sizes="(max-width: 600px) 88vw, (max-width: 1000px) 44vw, 40vw"
                    />
                    <div className="industry-tile-copy">
                        <h3>{industry.title}<ArrowUpRight size={24} aria-hidden="true" /></h3>
                        <p>{industry.text}</p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
