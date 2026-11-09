"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "./language-switcher";

export type NavItem = { href: string; label: string };

/** Mobile-first navigation drawer; large touch targets (§4.2). */
export function MobileNav({
  items,
  openLabel,
  closeLabel,
  title,
}: {
  items: NavItem[];
  openLabel: string;
  closeLabel: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={openLabel}
        className="inline-flex size-11 items-center justify-center rounded-md text-wl-on-chrome hover:bg-wl-chrome-soft md:hidden"
      >
        <Menu aria-hidden className="size-6" />
      </SheetTrigger>
      <SheetContent side="right" closeLabel={closeLabel} className="bg-wl-chrome text-wl-on-chrome">
        <SheetHeader>
          <SheetTitle className="text-wl-on-chrome">{title}</SheetTitle>
        </SheetHeader>
        <nav aria-label={title} className="flex flex-col gap-1 px-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center rounded-md px-3 text-base text-wl-on-chrome hover:bg-wl-chrome-soft"
            >
              {item.label}
            </Link>
          ))}
          <LanguageSwitcher className="mt-2 min-h-12 justify-start text-base" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
