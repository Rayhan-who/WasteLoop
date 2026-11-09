"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logoutAction } from "@/lib/actions/auth";
import { LanguageSwitcher } from "./language-switcher";

export type NavItem = { href: string; label: string };

/** Mobile-first navigation drawer; large touch targets (§4.2). */
export function MobileNav({
  items,
  signedIn,
  openLabel,
  closeLabel,
  title,
  signOutLabel,
}: {
  items: NavItem[];
  signedIn: boolean;
  openLabel: string;
  closeLabel: string;
  title: string;
  signOutLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const itemClass = "flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-base text-wl-ink hover:bg-wl-chrome-soft";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={openLabel}
        className="inline-flex size-11 items-center justify-center rounded-full text-wl-on-chrome hover:bg-wl-chrome-soft md:hidden"
      >
        <Menu aria-hidden className="size-6" />
      </SheetTrigger>
      <SheetContent side="right" closeLabel={closeLabel} className="bg-wl-surface text-wl-ink">
        <SheetHeader>
          <SheetTitle className="text-wl-ink">{title}</SheetTitle>
        </SheetHeader>
        <nav aria-label={title} className="flex flex-col gap-1 px-4">
          {items.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={itemClass}>
              {item.label}
            </Link>
          ))}
          <LanguageSwitcher className="mt-2 min-h-12 justify-start text-base" />
          {signedIn ? (
            <form action={logoutAction} className="mt-2 border-t border-wl-border pt-2">
              <button type="submit" className={itemClass}>
                <LogOut aria-hidden className="size-5" />
                {signOutLabel}
              </button>
            </form>
          ) : null}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
