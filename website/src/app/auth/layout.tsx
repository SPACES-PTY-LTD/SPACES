export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background">
      <div className="mx-auto min-h-screen flex justify-center items-center">
        <div className="max-w-xl w-full">{children}</div>
      </div>
    </div>
  )
}
