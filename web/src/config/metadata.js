export function getPageMetadata({ title, description, path, isPrivate = false }) {
  const baseUrl = "https://baselinearena.in";
  
  // Format dynamic OG image query parameters
  const ogImageUrl = `/api/og?title=${encodeURIComponent(title)}&desc=${encodeURIComponent(description)}`;
  
  // Format the full title depending on whether it's the homepage or already contains the brand name
  const fullTitle = (path === "/" || title.includes("Baseline Arena")) ? title : `${title} | Baseline Arena`;

  const metadata = {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: `${baseUrl}${path}`,
      title: fullTitle,
      description,
      siteName: "Baseline Arena",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImageUrl],
    },
  };

  if (isPrivate) {
    metadata.robots = {
      index: false,
      follow: false,
    };
  }

  return metadata;
}
