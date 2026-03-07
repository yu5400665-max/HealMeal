import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "愈后食光 HealMeal",
  description: "术后康复人群与家属的 AI 饮食与康复陪伴产品"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
