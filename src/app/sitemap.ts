import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://clawmastura.com";
  return ["", "/login", "/signup", "/terms", "/privacy", "/skill.md"].map((path) => ({
    url: `${base}${path || "/"}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));
}
