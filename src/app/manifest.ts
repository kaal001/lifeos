import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LifeOS — Your Personal Growth System",
    short_name: "LifeOS",
    description:
      "Your personal workspace for habits, goals, academics, fitness, and growth.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0d151f",
    theme_color: "#0d151f",
    icons: [
      {
        src: "/branding/lifeos-app-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/lifeos-app-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
