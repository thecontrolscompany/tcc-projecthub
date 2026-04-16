import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "TCC ProjectHub",
    template: "%s | TCC ProjectHub",
  },
  description: "Project management and billing portal for The Controls Company, LLC.",
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/apple-touch-icon.png",
  },
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
      </body>
    </html>
  );
}
