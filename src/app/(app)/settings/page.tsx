import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { PageBanner } from "@/components/app-shell/page-banner";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";
import { DeactivateAccount } from "@/components/settings/deactivate-account";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { RolesForm } from "@/components/settings/roles-form";
import { SettingsSection } from "@/components/settings/settings-section";
import type { SelfServiceRole } from "@/lib/design/roles";
import { getCurrentProfile } from "@/lib/profile";
import { LOGIN_PATH } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("settings"))("title") };
}

/**
 * Settings: profile, roles, language and theme, account deactivation.
 * Organisation verification (milestone 12) and notification preferences
 * (milestone 9) are added as further sections.
 */
export default async function SettingsPage() {
  const [t, profile] = await Promise.all([getTranslations("settings"), getCurrentProfile()]);
  if (!profile) redirect(LOGIN_PATH);

  return (
    <>
    <PageBanner title={t("title")} />
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8">

      <SettingsSection id="settings-profile" title={t("profile.title")} description={t("profile.description")}>
        <ProfileForm
          email={profile.email}
          defaults={{
            displayName: profile.display_name,
            orgName: profile.org_name ?? "",
            phone: profile.phone ?? "",
            bio: profile.bio ?? "",
            generalLocation: profile.general_location ?? "",
          }}
        />
      </SettingsSection>

      <SettingsSection id="settings-roles" title={t("roles.title")} description={t("roles.description")}>
        <RolesForm initial={profile.roles.filter((r): r is SelfServiceRole => r !== "admin")} />
      </SettingsSection>

      <SettingsSection id="settings-preferences" title={t("preferences.title")}>
        <PreferencesForm />
      </SettingsSection>

      <SettingsSection id="settings-signout" title={t("signOut.title")} description={t("signOut.description")}>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="rounded-full">
            <LogOut aria-hidden className="size-4" />
            {t("signOut.button")}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection id="settings-account" title={t("account.title")} description={t("account.description")} tone="danger">
        <DeactivateAccount />
      </SettingsSection>
    </div>
    </>
  );
}
