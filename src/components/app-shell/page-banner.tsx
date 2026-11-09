import type { ReactNode } from "react";

/**
 * Black banner with a wave edge, from the post-login design. Eyebrow + large
 * title in white; optional content (stats, actions) on the right.
 */
export function PageBanner({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="relative bg-wl-inverse text-wl-on-inverse">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-8 pb-14 md:flex-row md:items-end md:justify-between md:px-8 md:pt-10">
        <div className="space-y-1">
          {eyebrow ? <p className="text-sm text-wl-on-inverse-dim">{eyebrow}</p> : null}
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">{title}</h1>
          {subtitle ? <p className="text-wl-on-inverse-dim">{subtitle}</p> : null}
        </div>
        {children}
      </div>
      {/* Wave edge into the page background. */}
      <svg aria-hidden viewBox="0 0 1440 48" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px block h-8 w-full text-wl-paper md:h-12">
        <path d="M0 48 C 360 0, 1080 64, 1440 12 L1440 48 Z" fill="currentColor" />
      </svg>
    </section>
  );
}
