export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-2xl font-medium text-wl-ink">{title}</h1>
      {subtitle ? <p className="text-wl-ink-soft">{subtitle}</p> : null}
    </div>
  );
}
