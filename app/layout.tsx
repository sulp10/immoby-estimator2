import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AirROI – Web App Estimator",
  description: "Calcolatore rendimenti affitti brevi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}