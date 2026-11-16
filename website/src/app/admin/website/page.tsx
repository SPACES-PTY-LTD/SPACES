import { requireSuperAdmin } from "@/lib/auth";
import { WebsiteManager } from "@/components/website-admin/manager";
export const metadata = {
    title: "Website management",
    robots: { index: false, follow: false },
};
export default async function Page() {
    const s = await requireSuperAdmin();
    return <WebsiteManager token={s.accessToken} />;
}
