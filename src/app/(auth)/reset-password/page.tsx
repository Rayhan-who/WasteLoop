import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth.reset"))("title") };
}

/**
 * Reached from the recovery e-mail via /auth/confirm, which creates the
 * session. Without one, the link was invalid or expired.
 */
export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthCard title={t("expiredTitle")}>
        <p className="text-center text-wl-ink-soft">{t("expiredBody")}</p>
        <div className="mt-6 flex justify-center">
          <Button asChild size="lg" className="h-12 rounded-full px-8">
            <Link href="/forgot-password">{t("requestNew")}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
