"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Pencil, Play, Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteListingAction, setListingStatusAction } from "@/lib/actions/listings";
import type { ListingStatus } from "@/lib/domain";
import { canDeleteListing, canEditListing, listingActionsFrom, type ListingAction } from "@/lib/exchange/transitions";

const ACTION_ICONS = { publish: Send, pause: Pause, resume: Play } as const;

/** Edit / publish / pause / resume / delete for one of the provider's listings. */
export function MyListingActions({ id, status, title }: { id: string; status: ListingStatus; title: string }) {
  const t = useTranslations("myListings");
  const tErr = useTranslations("formErrors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Expired listings are republished by editing them with a new window.
  const actions = listingActionsFrom(status).filter((a) => !(a === "publish" && status === "expired"));

  function run(action: ListingAction) {
    startTransition(async () => {
      const result = await setListingStatusAction(id, action);
      if (!result.ok) {
        toast.error(tErr(result.error));
        return;
      }
      toast.success(t(`done.${action}`));
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteListingAction(id);
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(tErr(result.error));
        return;
      }
      toast.success(t("done.delete"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canEditListing(status) ? (
        <Button asChild variant="outline" size="sm" className="h-10 rounded-full px-4">
          <Link href={`/listings/${id}/edit`}>
            <Pencil aria-hidden className="size-4" />
            {status === "expired" ? t("actions.republish") : t("actions.edit")}
          </Link>
        </Button>
      ) : null}
      {actions.map((a) => {
        const Icon = ACTION_ICONS[a];
        return (
          <Button key={a} variant="outline" size="sm" className="h-10 rounded-full px-4" disabled={pending} onClick={() => run(a)}>
            <Icon aria-hidden className="size-4" />
            {t(`actions.${a}`)}
          </Button>
        );
      })}
      {canDeleteListing(status) ? (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-10 rounded-full px-4 text-wl-danger" disabled={pending}>
              <Trash2 aria-hidden className="size-4" />
              {t("actions.delete")}
            </Button>
          </DialogTrigger>
          <DialogContent closeLabel={tc("close")}>
            <DialogHeader>
              <DialogTitle>{t("deleteTitle")}</DialogTitle>
              <DialogDescription>{t("deleteBody", { title })}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">{tc("cancel")}</Button>
              </DialogClose>
              <Button className="bg-wl-danger text-wl-on-inverse hover:bg-wl-danger/90" disabled={pending} onClick={remove}>
                {t("actions.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
