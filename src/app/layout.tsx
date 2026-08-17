import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "밀핏 — AI 3일 식단 플래너",
  description: "목표 영양소에 맞춰 3일 아홉 끼와 장보기를 한 번에 설계하는 AI 식단 플래너",
  applicationName: "밀핏",
  keywords: ["AI 식단", "3일 식단", "영양 관리", "장보기", "레시피"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#163f2d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
