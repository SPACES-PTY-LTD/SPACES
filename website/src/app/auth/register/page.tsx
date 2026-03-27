import Link from "next/link"
import { GalleryVerticalEnd, MapPinned, Route, ShieldCheck } from "lucide-react"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
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
            <div className="w-full max-w-xl">
              <RegisterForm />
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
                Faster onboarding
              </p>
              <h2 className="text-4xl font-semibold leading-tight">
                Launch a delivery workspace with routing, tracking, and proof of delivery ready.
              </h2>
              <p className="text-base leading-7 text-white/72">
                Start with a clean operations hub built for dispatch teams, drivers, and customer visibility.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">First-week outcomes</p>
                    <p className="text-3xl font-semibold">3x faster</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-400/15 px-3 py-2 text-sm font-medium text-emerald-100">
                    Team setup
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-black/20 p-4">
                    <Route className="mb-3 size-5 text-cyan-200" />
                    <p className="text-sm text-white/65">Routes published</p>
                    <p className="mt-1 text-lg font-semibold">Day 1</p>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-4">
                    <MapPinned className="mb-3 size-5 text-cyan-200" />
                    <p className="text-sm text-white/65">Live tracking</p>
                    <p className="mt-1 text-lg font-semibold">Built in</p>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-4">
                    <ShieldCheck className="mb-3 size-5 text-cyan-200" />
                    <p className="text-sm text-white/65">POD workflow</p>
                    <p className="mt-1 text-lg font-semibold">Ready</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
