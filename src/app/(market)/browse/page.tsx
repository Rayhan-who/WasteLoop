import { redirect } from "next/navigation";

/** /browse is the route name in the original spec; the marketplace is its home. Filters carry over. */
export default async function BrowsePage({ searchParams }: PageProps<"/browse">) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/marketplace?${query}` : "/marketplace");
}
