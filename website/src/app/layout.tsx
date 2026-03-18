import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { Providers } from "@/components/providers"
import "./globals.css"

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Pick n Drop"

export const metadata: Metadata = {
  title: `${appName} | Logistics Operations Platform`,
  description:
    "Unified operations for merchants, carriers, and dispatch teams.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          "min-h-screen bg-sidebar font-sans text-foreground antialiased"
        )}
      >
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
