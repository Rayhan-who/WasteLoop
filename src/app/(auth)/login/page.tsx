import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
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
    <AuthCard
      title={t("cardTitle")}
      below={
        <>
          <p>
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-wl-ink underline-offset-4 hover:underline">
              {t("forgot")}
            </Link>
          </p>
          <p>
            {t("noAccount")}{" "}
            <Link href="/register" className="font-medium tracking-wide text-wl-ink uppercase underline-offset-4 hover:underline">
              {t("register")}
            </Link>
          </p>
        </>
      }
    >
      {linkExpired ? (
        <p role="alert" className="mb-4 rounded-xl bg-wl-pending-tint p-3 text-sm text-wl-pending-text">
          {t("linkExpired")}
        </p>
      ) : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
