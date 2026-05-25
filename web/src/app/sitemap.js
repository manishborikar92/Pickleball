import { getVenue } from "@/lib/api";

export default async function sitemap() {
  const baseUrl = "https://baselinearena.in";

  // Static routes
  const staticRoutes = [
    "",
    "/about",
    "/interest",
    "/privacy",
    "/support",
    "/terms",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "monthly",
    priority: route === "" ? 1.0 : 0.8,
  }));

  // Dynamic routes (e.g. venues and court bookings)
  try {
    const venueData = await getVenue();
    if (venueData && venueData.slug) {
      staticRoutes.push({
        url: `${baseUrl}/venues/${venueData.slug}/book`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }
  } catch (error) {
    console.error("Failed to fetch venue data for sitemap:", error);
  }

  return staticRoutes;
}
