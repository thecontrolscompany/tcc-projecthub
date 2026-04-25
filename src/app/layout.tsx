import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import { SwRegistration } from "../components/sw-registration";

export const metadata: Metadata = {
  title: {
    default: "TCC ProjectHub",
    template: "%s | TCC ProjectHub",
  },
  description: "Project management and billing portal for The Controls Company, LLC.",
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ProjectHub",
  },
};

export const viewport: Viewport = {
  themeColor: "#017a6f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased font-body">
        <ThemeProvider>{children}</ThemeProvider>
        <SwRegistration />
      </body>
    </html>
  );
}
