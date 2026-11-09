/** Centred single-column layout for the auth pages. Mobile-first: full width, generous spacing. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md rounded-xl border border-wl-border bg-wl-surface p-6 sm:p-8">{children}</div>
    </div>
  );
}
