import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DOCUMENTATION_COOKIE, documentationPassword, safeDocumentationDestination, validDocumentationSession } from "./access";
export async function requireDocumentationAccess(destination: string) {
    if (!await validDocumentationSession((await cookies()).get(DOCUMENTATION_COOKIE)?.value, documentationPassword())) {
        redirect(`/documentation-access?next=${encodeURIComponent(safeDocumentationDestination(destination))}`);
    }
}
