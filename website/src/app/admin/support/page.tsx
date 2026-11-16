import { requireRole, getScopedMerchantId } from "@/lib/auth";
import { SupportManager } from "@/components/website-admin/support-manager";
export const metadata = {
    title: "Support tickets",
    robots: { index: false, follow: false },
};
export default async function Page() {
    const s = await requireRole(["user", "super_admin"]);
    return (
        <SupportManager
            token={s.accessToken}
            merchantId={getScopedMerchantId(s)}
            superAdmin={s.user.role === "super_admin"}
        />
    );
}
