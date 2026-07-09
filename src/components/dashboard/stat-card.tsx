import Link from "next/link"

export function StatCard({
  label, value, href,
}: {
  label: string
  value: number | string
  href?: string
}) {
  const content = (
    <div className="rounded-lg border border-black/5 bg-white p-4 transition-colors hover:border-primary/30">
      <p className="text-xs uppercase tracking-wide text-foreground/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
