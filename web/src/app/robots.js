export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/login",
        "/review",
        "/booking",
      ],
    },
    sitemap: "https://baselinearena.in/sitemap.xml",
  };
}
