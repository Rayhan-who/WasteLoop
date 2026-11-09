import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth.register"))("title") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <AuthCard
      wide
      title={t("cardTitle")}
      subtitle={t("subtitle")}
      below={
        <p>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium tracking-wide text-wl-ink uppercase underline-offset-4 hover:underline">
            {t("signIn")}
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
