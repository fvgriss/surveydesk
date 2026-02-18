import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SurveyOS",
  description: "Operations platform for land surveying firms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
