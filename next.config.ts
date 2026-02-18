import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit as a native Node module so it can find its font data files
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
