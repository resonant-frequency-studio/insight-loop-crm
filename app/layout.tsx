import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CrmLayoutWrapper } from "@/components/CrmLayoutWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resilient Leadership CRM",
  description: "CRM for managing contacts and relationships",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CrmLayoutWrapper>{children}</CrmLayoutWrapper>
      </body>
    </html>
  );
}
