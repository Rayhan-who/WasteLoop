import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
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
      <>
        <AuthHeading title={t("expiredTitle")} subtitle={t("expiredBody")} />
        <Button asChild size="lg" className="w-full">
          <Link href="/forgot-password">{t("requestNew")}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <ResetPasswordForm />
    </>
  );
}
