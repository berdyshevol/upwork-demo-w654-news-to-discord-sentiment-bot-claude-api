import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discord Sentiment Pipeline — Live Demo Console",
  description:
    "Financial headline in → noise filter → AI sentiment read → color-coded Discord embed out. Every stage visible, editable and testable in the browser.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
