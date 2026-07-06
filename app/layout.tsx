import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://image-altflow.vercel.app";
const siteTitle = "Image Altflow — AI 图片 SEO 元数据";
const siteDescription =
  "上传产品图片，AI 视觉自动生成中英双语 SEO 元数据，并写入图片 EXIF / XMP / IPTC，一键下载。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s · Image Altflow",
  },
  description: siteDescription,
  keywords: ["图片 SEO", "alt text", "EXIF", "IPTC", "XMP", "AI 识图", "image metadata"],
  applicationName: "Image Altflow",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Image Altflow",
    title: siteTitle,
    description: siteDescription,
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <main>{children}</main>
        <Link href="/history" className="signin-corner">
          历史记录
        </Link>
      </body>
    </html>
  );
}
