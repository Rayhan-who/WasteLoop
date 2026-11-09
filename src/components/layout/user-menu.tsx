"use client";

import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";

/** Signed-in account menu in the header (desktop). */
export function UserMenu({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const t = useTranslations("userMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("label", { name })}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-wl-chrome-soft px-3 text-sm text-wl-on-chrome hover:bg-wl-chrome-soft"
      >
        <UserRound aria-hidden className="size-4" />
        <span className="max-w-40 truncate">{name}</span>
        <ChevronDown aria-hidden className="size-4 text-wl-on-chrome-dim" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="truncate text-wl-ink-soft">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11">
          <Link href="/dashboard">
            <LayoutDashboard aria-hidden className="size-4" />
            {t("dashboard")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11">
          <Link href="/settings">
            <Settings aria-hidden className="size-4" />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild className="min-h-11">
            <Link href="/admin">
              <ShieldCheck aria-hidden className="size-4" />
              {t("admin")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild className="min-h-11 w-full">
            <button type="submit">
              <LogOut aria-hidden className="size-4" />
              {t("signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
