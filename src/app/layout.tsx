import type { Metadata, Viewport } from "next";
import { ConfirmDialogProvider } from "./confirm-dialog-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LifeOS — Your Personal Growth System",
    template: "%s | LifeOS",
  },
  description:
    "A personal growth workspace to organize your habits, goals, academics, fitness, and daily life.",
  applicationName: "LifeOS",
    appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LifeOS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d151f",
};

const themeScript = `
  (() => {
    try {
      const savedTheme = localStorage.getItem("lifeos-theme");
      const theme = savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : "dark";
      document.documentElement.dataset.theme = theme;
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body><ConfirmDialogProvider>{children}</ConfirmDialogProvider></body>
    </html>
  );
}