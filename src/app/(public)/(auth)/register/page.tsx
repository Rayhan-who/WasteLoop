import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { RegisterForm } from "@/components/auth/register-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth.register"))("title") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <RegisterForm />
    </>
  );
}
