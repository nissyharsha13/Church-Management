import type { Metadata } from "next";
import "@fontsource-variable/noto-sans";
import "@fontsource-variable/noto-sans-telugu";
import "./globals.css";

export const metadata: Metadata = {
  title: "Church Management",
  description: "Sermon planning and live presentation for churches",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="te" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
