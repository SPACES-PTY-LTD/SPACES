import { redirect } from "next/navigation";

// Keep old pricing links useful while public pricing is withdrawn.
export default function Pricing() {
    redirect("/contact");
}
