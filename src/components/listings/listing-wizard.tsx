"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Crosshair, Lock, Search, ShieldAlert, Sparkles } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { applyServerErrors } from "@/components/forms/apply-server-errors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createListingAction,
  geocodeAction,
  getListingSuggestionsAction,
  getPriceSuggestionAction,
  reverseGeocodeAction,
  updateListingAction,
  type PriceHint,
  type Suggestion,
} from "@/lib/actions/listings";
import type { FormErrorCode } from "@/lib/actions/result";
import { localInputToIso, presetWindow, toLocalInputValue, type WindowPreset } from "@/lib/datetime";
import { WASTE_STREAM_STYLES } from "@/lib/design/streams";
import { LISTING_OFFER_TYPES, QUANTITY_UNITS, WASTE_TYPES, type WasteType } from "@/lib/domain";
import type { GeocodeResult } from "@/lib/geo/geocode";
import type { LatLng } from "@/lib/geo/bounds";
import { LISTING_STEP_FIELDS, listingSchema, type ListingData, type ListingInput } from "@/lib/validation/listing";
import { cn } from "@/lib/utils";
import { PhotoUploader } from "./photo-uploader";
import { Quantity } from "./listing-bits";
import { StreamChip } from "./stream-chip";

// Leaflet touches `window`, so the map only renders in the browser.
const LocationPicker = dynamic(() => import("@/components/map/location-picker"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 rounded-2xl bg-wl-chrome-soft sm:h-80" />,
});

export type WizardMode =
  | { kind: "create" }
  | { kind: "edit"; listingId: string; status: "draft" | "available" | "paused" | "expired" };

const STEPS = ["what", "where", "how"] as const;
const PRESETS: WindowPreset[] = ["tonight", "24h", "3d", "7d"];

/**
 * Three-step listing wizard (§4.2): what it is → where and when → how it's
 * offered. One form across all steps; each step validates only its own
 * fields before moving on. Designed to be finished in under a minute.
 */
export function ListingWizard({ userId, mode, initial }: { userId: string; mode: WizardMode; initial?: Partial<ListingInput> }) {
  const t = useTranslations("listingForm");
  const tStreams = useTranslations("streams");
  const tOffer = useTranslations("offerTypes");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<FormErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const [categoryHint, setCategoryHint] = useState<Suggestion<WasteType>>(null);
  const [priceHint, setPriceHint] = useState<PriceHint>(null);
  // Auto-fill the public area label from the map only for new listings, and only until the provider types their own.
  const autoAreaAllowed = !initial?.pickupAreaLabel;
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [defaults] = useState(() => presetWindow("24h"));
  const form = useForm<ListingInput, unknown, ListingData>({
    resolver: zodResolver(listingSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      description: "",
      quantityUnit: "kg",
      photoPaths: [],
      pickupAreaLabel: "",
      pickupAddressExact: "",
      availableFrom: toLocalInputValue(defaults.from),
      availableUntil: toLocalInputValue(defaults.until),
      offerType: "free",
      priceAmount: null,
      ...initial,
    },
  });
  const { errors } = form.formState;
  const [wasteType, offerType, quantityValue, quantityUnit, lat, lng, title, areaLabel, from, until] = useWatch({
    control: form.control,
    name: ["wasteType", "offerType", "quantityValue", "quantityUnit", "pickupLat", "pickupLng", "title", "pickupAreaLabel", "availableFrom", "availableUntil"],
  });
  const point: LatLng | null = typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;

  // Move focus to the step heading so keyboard and screen-reader users land at the top.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // FR-7.4 fallback: recent median price for this stream and unit (only for sale listings).
  useEffect(() => {
    if (offerType !== "for_sale" || !wasteType || !quantityUnit) return;
    let cancelled = false;
    getPriceSuggestionAction({ wasteType, unit: quantityUnit, quantity: Number(quantityValue) || 0 }).then((hint) => {
      if (!cancelled) setPriceHint(hint);
    });
    return () => {
      cancelled = true;
    };
  }, [offerType, wasteType, quantityUnit, quantityValue]);

  const setPoint = useCallback(
    (p: LatLng) => {
      form.setValue("pickupLat", p.lat, { shouldValidate: true, shouldDirty: true });
      form.setValue("pickupLng", p.lng, { shouldValidate: true, shouldDirty: true });
      const canAutoFill = () => autoAreaAllowed && !form.getFieldState("pickupAreaLabel").isDirty;
      if (canAutoFill()) {
        reverseGeocodeAction(p.lat, p.lng).then((label) => {
          if (label && canAutoFill()) form.setValue("pickupAreaLabel", label, { shouldValidate: true });
        });
      }
    },
    [form, autoAreaAllowed],
  );

  async function next() {
    const ok = await form.trigger([...LISTING_STEP_FIELDS[step]], { shouldFocus: true });
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit(publish: boolean) {
    setFormError(null);
    void form.handleSubmit((data) => {
      startTransition(async () => {
        const payload: ListingInput = {
          ...data,
          availableFrom: localInputToIso(data.availableFrom),
          availableUntil: localInputToIso(data.availableUntil),
        };
        const result =
          mode.kind === "create" ? await createListingAction(payload, publish) : await updateListingAction(mode.listingId, payload, publish);
        if (!result.ok) {
          setFormError(result.error);
          applyServerErrors(form, result);
          // Jump back to the first step that has a server-reported error.
          const firstBad = LISTING_STEP_FIELDS.findIndex((fields) => fields.some((f) => result.fieldErrors?.[f]));
          if (firstBad >= 0) setStep(firstBad);
          return;
        }
        toast.success(t(publish ? "toastPublished" : mode.kind === "create" ? "toastDraft" : "toastSaved"));
        router.push(`/my-listings`);
        router.refresh();
      });
    })();
  }

  const showPublishPair = mode.kind === "create" || mode.status === "draft" || mode.status === "expired";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Progress */}
      <ol className="grid grid-cols-3 gap-2" aria-label={t("progressLabel")}>
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="space-y-1.5">
            <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-wl-inverse" : "bg-wl-grey-200")} />
            <span className={cn("flex items-center gap-1 text-xs sm:text-sm", i === step ? "font-medium text-wl-ink" : "text-wl-ink-muted")}>
              {i < step ? <Check aria-hidden className="size-3.5" /> : null}
              {t(`steps.${s}`)}
            </span>
          </li>
        ))}
      </ol>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) void next();
        }}
        className="space-y-6 rounded-3xl border border-wl-border bg-wl-surface p-5 sm:p-8"
      >
        <div>
          <p className="text-sm text-wl-ink-muted">{t("stepOf", { step: step + 1, total: STEPS.length })}</p>
          <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-medium tracking-tight focus:outline-none">
            {t(`titles.${STEPS[step]}`)}
          </h2>
        </div>

        <FormError code={formError} />

        {/* ---------------- Step 1: what it is ---------------- */}
        {step === 0 ? (
          <div className="space-y-6">
            <Controller
              control={form.control}
              name="wasteType"
              render={({ field }) => (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{t("category")}</legend>
                  {categoryHint ? (
                    <p className="flex items-start gap-2 rounded-xl bg-wl-chrome-soft p-3 text-sm">
                      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
                      <span>
                        {t("aiSuggestion", { category: tStreams(categoryHint.value) })} <span className="text-wl-ink-soft">{categoryHint.explanation}</span>
                      </span>
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {WASTE_TYPES.map((type) => {
                      const style = WASTE_STREAM_STYLES[type];
                      const Icon = style.icon;
                      const checked = field.value === type;
                      return (
                        <label
                          key={type}
                          className={cn(
                            "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center text-sm transition-colors",
                            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wl-ink",
                            checked ? "border-wl-ink bg-wl-chrome-soft font-medium" : "border-wl-border hover:border-wl-grey-300",
                          )}
                        >
                          <input
                            type="radio"
                            name={field.name}
                            value={type}
                            checked={checked}
                            onChange={() => field.onChange(type)}
                            onBlur={field.onBlur}
                            className="sr-only"
                          />
                          <Icon aria-hidden className={cn("size-7", style.iconColor)} />
                          {tStreams(type)}
                        </label>
                      );
                    })}
                  </div>
                  <p aria-live="polite" className="text-sm text-wl-danger">
                    {errors.wasteType ? t("errors.category") : null}
                  </p>
                </fieldset>
              )}
            />

            <Controller
              control={form.control}
              name="photoPaths"
              render={({ field }) => (
                <PhotoUploader
                  userId={userId}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  error={errors.photoPaths?.message}
                  onFirstUpload={(path) => {
                    // FR-3.6 / FR-3.7 advisory suggestions (deferred ML; null today).
                    getListingSuggestionsAction(path, form.getValues("wasteType") ?? null).then((s) => {
                      setCategoryHint(s.category);
                      if (s.category && !form.getValues("wasteType")) form.setValue("wasteType", s.category.value, { shouldValidate: true });
                      if (s.quantity && !form.getValues("quantityValue")) {
                        form.setValue("quantityValue", s.quantity.value.value, { shouldValidate: true });
                        form.setValue("quantityUnit", s.quantity.value.unit);
                      }
                    });
                  }}
                />
              )}
            />

            <TextField label={t("title")} hint={t("titleHint")} maxLength={120} error={errors.title?.message} {...form.register("title")} />

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <TextField
                label={t("quantity")}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                error={errors.quantityValue?.message}
                {...form.register("quantityValue", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
              <Controller
                control={form.control}
                name="quantityUnit"
                render={({ field }) => (
                  <fieldset className="space-y-1.5">
                    <legend className="text-sm font-medium">{t("unit")}</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {QUANTITY_UNITS.map((u) => (
                        <label
                          key={u}
                          className={cn(
                            "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm",
                            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-wl-ink",
                            field.value === u ? "border-wl-ink bg-wl-inverse text-wl-on-inverse" : "border-wl-border hover:border-wl-grey-300",
                          )}
                        >
                          <input type="radio" name={field.name} value={u} checked={field.value === u} onChange={() => field.onChange(u)} className="sr-only" />
                          {t(`units.${u}`)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              />
            </div>

            <TextField
              label={t("description")}
              hint={t("descriptionHint")}
              optional
              multiline
              maxLength={2000}
              error={errors.description?.message}
              {...form.register("description")}
            />
          </div>
        ) : null}

        {/* ---------------- Step 2: where and when ---------------- */}
        {step === 1 ? (
          <div className="space-y-6">
            <LocationSearch onPick={(r) => {
              if (r.area && autoAreaAllowed && !form.getFieldState("pickupAreaLabel").isDirty) {
                form.setValue("pickupAreaLabel", r.area, { shouldValidate: true });
              }
              if (!form.getValues("pickupAddressExact")) form.setValue("pickupAddressExact", r.label.slice(0, 500));
              setPoint(r);
            }} />
            <LocationPicker value={point} onChange={setPoint} label={t("mapLabel")} />
            <p aria-live="polite" className="-mt-4 text-sm text-wl-danger">
              {errors.pickupLat?.message ? t(`errors.${errors.pickupLat.message === "outsideBangladesh" ? "outsideBangladesh" : "location"}`) : null}
            </p>

            <TextField
              label={t("areaLabel")}
              hint={t("areaHint")}
              maxLength={120}
              error={errors.pickupAreaLabel?.message}
              {...form.register("pickupAreaLabel")}
            />
            <div className="space-y-1.5">
              <TextField
                label={t("exactAddress")}
                hint={
                  <span className="inline-flex items-start gap-1.5">
                    <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    {t("exactAddressHint")}
                  </span>
                }
                multiline
                maxLength={500}
                error={errors.pickupAddressExact?.message}
                {...form.register("pickupAddressExact")}
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t("availability")}</legend>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const w = presetWindow(p);
                      form.setValue("availableFrom", toLocalInputValue(w.from), { shouldValidate: true });
                      form.setValue("availableUntil", toLocalInputValue(w.until), { shouldValidate: true });
                    }}
                    className="inline-flex min-h-11 items-center rounded-full border border-wl-border px-4 text-sm hover:border-wl-ink"
                  >
                    {t(`presets.${p}`)}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t("from")} type="datetime-local" error={errors.availableFrom?.message} {...form.register("availableFrom")} />
                <TextField label={t("until")} type="datetime-local" error={errors.availableUntil?.message} {...form.register("availableUntil")} />
              </div>
            </fieldset>
          </div>
        ) : null}

        {/* ---------------- Step 3: how it's offered ---------------- */}
        {step === 2 ? (
          <div className="space-y-6">
            <Controller
              control={form.control}
              name="offerType"
              render={({ field }) => (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{t("offerType")}</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {LISTING_OFFER_TYPES.map((o) => (
                      <label
                        key={o}
                        className={cn(
                          "flex min-h-20 cursor-pointer flex-col justify-center gap-1 rounded-2xl border-2 p-4 transition-colors",
                          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wl-ink",
                          field.value === o ? "border-wl-ink bg-wl-chrome-soft" : "border-wl-border hover:border-wl-grey-300",
                        )}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={o}
                          checked={field.value === o}
                          onChange={() => {
                            field.onChange(o);
                            if (o !== "for_sale") form.setValue("priceAmount", null, { shouldValidate: true });
                          }}
                          className="sr-only"
                        />
                        <span className={cn("font-medium", o === "for_sale" && "text-wl-money")}>{tOffer(o)}</span>
                        <span className="text-sm text-wl-ink-soft">{t(`offerHints.${o}`)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            />

            {offerType === "for_sale" ? (
              <div className="space-y-2">
                <TextField
                  label={t("price")}
                  hint={t("priceHint")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  error={errors.priceAmount?.message}
                  {...form.register("priceAmount", { setValueAs: (v: string) => (v === "" || v === null ? null : Number(v)) })}
                />
                {priceHint?.source === "history" ? (
                  <p className="rounded-xl bg-wl-money-tint p-3 text-sm text-wl-money">
                    {t("priceReference", {
                      price: format.number(priceHint.perUnit, { style: "currency", currency: "BDT", maximumFractionDigits: 0 }),
                      unit: t(`unitsSingular.${quantityUnit ?? "kg"}`),
                      samples: priceHint.samples,
                    })}
                  </p>
                ) : priceHint?.source === "model" ? (
                  <p className="rounded-xl bg-wl-money-tint p-3 text-sm text-wl-money">
                    {t("priceModel", { price: format.number(priceHint.total, { style: "currency", currency: "BDT", maximumFractionDigits: 0 }) })}{" "}
                    {priceHint.explanation}
                  </p>
                ) : null}
              </div>
            ) : null}

            {wasteType === "edible_food" ? (
              <p role="note" className="flex gap-3 rounded-2xl bg-wl-pending-tint p-4 text-sm text-wl-pending-text">
                <ShieldAlert aria-hidden className="size-5 shrink-0" />
                {t("foodSafety")}
              </p>
            ) : null}

            {/* Review */}
            <section aria-labelledby="review-heading" className="space-y-3 rounded-2xl border border-wl-border p-4">
              <h3 id="review-heading" className="text-sm font-medium tracking-wide text-wl-ink-muted uppercase">
                {t("review")}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {wasteType ? <StreamChip type={wasteType} /> : null}
                <span className="font-medium">{title}</span>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-wl-ink-muted">{t("quantity")}</dt>
                  <dd>{typeof quantityValue === "number" && quantityUnit ? <Quantity value={quantityValue} unit={quantityUnit} /> : "—"}</dd>
                </div>
                <div>
                  <dt className="text-wl-ink-muted">{t("areaLabel")}</dt>
                  <dd>{areaLabel || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-wl-ink-muted">{t("availability")}</dt>
                  <dd>
                    {from && until && !Number.isNaN(Date.parse(from)) && !Number.isNaN(Date.parse(until))
                      ? format.dateTimeRange(new Date(from), new Date(until), { dateStyle: "medium", timeStyle: "short" })
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        ) : null}

        {/* Navigation */}
        <div className="flex flex-col-reverse gap-3 border-t border-wl-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <Button type="button" variant="outline" size="lg" className="h-12 rounded-full" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              <ChevronLeft aria-hidden className="size-4" />
              {t("back")}
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button type="submit" size="lg" className="h-12 rounded-full px-8">
              {t("next")}
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          ) : showPublishPair ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button type="button" variant="outline" size="lg" className="h-12 rounded-full" disabled={pending} onClick={() => submit(false)}>
                {t("saveDraft")}
              </Button>
              <Button type="button" size="lg" className="h-12 rounded-full px-8" disabled={pending} onClick={() => submit(true)}>
                {pending ? tc("saving") : t("publish")}
              </Button>
            </div>
          ) : (
            <Button type="button" size="lg" className="h-12 rounded-full px-8" disabled={pending} onClick={() => submit(false)}>
              {pending ? tc("saving") : t("saveChanges")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Address search (Nominatim, via a Server Action) plus "use my location". */
function LocationSearch({ onPick }: { onPick: (r: GeocodeResult) => void }) {
  const t = useTranslations("listingForm");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 3) return;
    setBusy(true);
    setResults(await geocodeAction(query));
    setBusy(false);
  }

  function useMyLocation() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError(t("errors.geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onPick({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "", area: null }),
      () => setGeoError(t("errors.geolocation")),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="location-search" className="text-sm font-medium">
        {t("findLocation")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 gap-2">
          <input
            id="location-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder={t("searchPlaceholder")}
            className="h-11 min-w-0 flex-1 rounded-full border border-wl-border bg-wl-surface px-4 text-base outline-none focus-visible:border-wl-ink"
          />
          <Button type="button" variant="outline" className="h-11 rounded-full" onClick={search} disabled={busy} aria-label={t("search")}>
            <Search aria-hidden className="size-4" />
            <span className="hidden sm:inline">{t("search")}</span>
          </Button>
        </div>
        <Button type="button" variant="outline" className="h-11 rounded-full" onClick={useMyLocation}>
          <Crosshair aria-hidden className="size-4" />
          {t("useMyLocation")}
        </Button>
      </div>
      <p className="text-sm text-wl-ink-soft">{t("mapHint")}</p>
      <div aria-live="polite">
        {geoError ? <p className="text-sm text-wl-danger">{geoError}</p> : null}
        {results !== null ? (
          results.length === 0 ? (
            <p className="text-sm text-wl-ink-soft">{t("noResults")}</p>
          ) : (
            <ul className="divide-y divide-wl-border overflow-hidden rounded-xl border border-wl-border">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r);
                      setResults(null);
                    }}
                    className="block min-h-11 w-full px-4 py-2 text-left text-sm hover:bg-wl-chrome-soft"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
