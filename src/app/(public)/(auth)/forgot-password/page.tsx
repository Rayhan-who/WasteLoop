import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth.forgot"))("title") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <ForgotPasswordForm />
    </>
  );
}
