import { getTranslations } from "next-intl/server";

/** Footer: navy chrome, carrying the "connection platform only" notice (Build Prompt §0). */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-wl-inverse text-wl-on-inverse-dim">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 text-sm md:grid-cols-[1fr_2fr]">
        <div className="space-y-1">
          <p className="font-medium text-wl-on-inverse">{t("tagline")}</p>
          <p>{t("copyright", { year })}</p>
        </div>
        <p className="leading-relaxed">{t("platformNotice")}</p>
      </div>
    </footer>
  );
}
