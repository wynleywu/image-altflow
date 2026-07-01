import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Amazon Listing SEO 审查",
  description: "输入 ASIN 审查 Amazon Listing 标题、五点、Search Terms 与属性，获取适老品类 SEO 优化建议。",
};

export default function AmazonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
