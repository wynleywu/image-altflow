import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Altflow",
  description: "AI image SEO assistant for filenames, alt text, and review workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,253,248,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 0" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Image Altflow</div>
              <div className="muted" style={{ fontSize: "0.9rem" }}>Gemini 识图 · 飞书审核台</div>
            </div>
            <nav style={{ display: "flex", gap: "0.75rem" }}>
              <Link href="/" style={{ textDecoration: "none" }}>提交图片</Link>
              <Link href="/review" style={{ textDecoration: "none" }}>审核列表</Link>
            </nav>
          </div>
        </header>
        <main className="container" style={{ padding: "1.5rem 0 3rem" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
