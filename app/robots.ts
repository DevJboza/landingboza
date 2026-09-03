import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://www.boza.lat/sitemap.xml",
    host: "https://www.boza.lat",
  };
}
