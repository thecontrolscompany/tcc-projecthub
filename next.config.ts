import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "mammoth", "exceljs"],
};

export default nextConfig;
