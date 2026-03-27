import Link from "next/link"
import { redirect } from "next/navigation"
import { GalleryVerticalEnd, MapPinned, Route, ShieldCheck } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"
import { getSession } from "@/lib/auth"

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect("/admin")
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Spaces Digital"

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-background">
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-8 p-6 md:p-10">
          <div className="flex justify-center md:justify-start">
            <Link href="/" className="flex items-center gap-3 font-medium text-foreground">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <span>{appName}</span>
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-lg">
              <LoginForm />
            </div>
          </div>
        </div>

        <div className="relative hidden overflow-hidden bg-muted lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#0f766e_0%,#0f172a_48%,#020617_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_30%,transparent_70%,rgba(255,255,255,0.06))]" />
          <div className="absolute -left-24 top-16 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute bottom-12 right-12 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between p-12 text-white">
            <div className="max-w-md space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-white/70">
                Dispatch control
              </p>
              <h2 className="text-4xl font-semibold leading-tight">
                Manage routes, track drivers, and keep every shipment.
              </h2>
              <p className="text-base leading-7 text-white/72">
                One place for dispatch planning, live fleet visibility, and driver communication. {appName} gives you the tools to keep your fleet on track and your customers happy.
              </p>
            </div>

            <div className="space-y-4">
             
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
