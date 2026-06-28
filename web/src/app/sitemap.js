import { VENUE } from "@/config/venue.config";

export default async function sitemap() {
  "use cache";

  const baseUrl = "https://baselinearena.in";

  return [
    "",
    "/about",
    "/interest",
    "/privacy",
    "/support",
    "/terms",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "" ? "daily" : "monthly",
    priority: route === "" ? 1.0 : 0.8,
  })).concat({
    url: `${baseUrl}/venues/${VENUE.slug}/book`,
    changeFrequency: "weekly",
    priority: 0.9,
  });
}
