import { redirect } from "next/navigation";
import { AFTER_LOGIN_PATH, LOGIN_PATH } from "@/lib/routes";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Login-first: there is no public home page. Signed-in users go to their
 * dashboard; everyone else to the login page (the proxy normally redirects
 * them before this renders).
 */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? AFTER_LOGIN_PATH : LOGIN_PATH);
}
