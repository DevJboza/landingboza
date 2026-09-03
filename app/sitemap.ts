import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://www.boza.lat", lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
