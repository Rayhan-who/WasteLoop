import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth.login"))("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth.login");
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const linkExpired = params.error === "link_expired";

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      {linkExpired ? (
        <div className="mb-4">
          <p role="alert" className="rounded-lg border border-wl-border bg-wl-pending-tint p-3 text-sm text-wl-pending-text">
            {t("linkExpired")}
          </p>
        </div>
      ) : null}
      <LoginForm next={next} />
    </>
  );
}
