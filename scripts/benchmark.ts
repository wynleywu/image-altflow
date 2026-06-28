import * as fs from "fs";
import * as path from "path";
import * as https from "https";

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

// Download a small test image
async function fetchTestImage(): Promise<{ buffer: Buffer; mimeType: string }> {
  // A small product-style image from picsum
  const url = "https://picsum.photos/seed/product/640/480";
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location!;
        https.get(loc, (res2) => {
          const chunks: Buffer[] = [];
          res2.on("data", (c: Buffer) => chunks.push(c));
          res2.on("end", () => resolve({ buffer: Buffer.concat(chunks), mimeType: "image/jpeg" }));
          res2.on("error", reject);
        }).on("error", reject);
      } else {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ buffer: Buffer.concat(chunks), mimeType: "image/jpeg" }));
        res.on("error", reject);
      }
    }).on("error", reject);
  });
}

async function run(
  name: string,
  fn: (buf: Buffer, mime: string) => Promise<unknown>,
  buf: Buffer,
  mime: string
): Promise<{ name: string; ms: number; altEn: string; tags: string; error?: string }> {
  const t0 = Date.now();
  try {
    const result = await fn(buf, mime) as Record<string, unknown>;
    const ms = Date.now() - t0;
    return {
      name,
      ms,
      altEn: String(result.alt_text_en ?? "").slice(0, 80),
      tags: (Array.isArray(result.tags_en) ? result.tags_en : []).slice(0, 4).join(", "),
    };
  } catch (err) {
    return {
      name,
      ms: Date.now() - t0,
      altEn: "",
      tags: "",
      error: err instanceof Error ? err.message.slice(0, 100) : String(err),
    };
  }
}

async function main() {
  console.log("⏬ 下载测试图片...");
  const { buffer, mimeType } = await fetchTestImage();
  console.log(`   图片大小: ${(buffer.length / 1024).toFixed(1)} KB\n`);

  const { analyzeImageFromBuffer: gemini } = await import("../lib/gemini.js");
  const { analyzeImageFromBuffer: modelscope } = await import("../lib/modelscope.js");
  const { analyzeImageFromBuffer: cloudflare } = await import("../lib/cloudflare.js");

  console.log("🚀 并发调用三个 provider...\n");
  const [g, m, c] = await Promise.all([
    run("Gemini",      gemini,     buffer, mimeType),
    run("ModelScope",  modelscope, buffer, mimeType),
    run("Cloudflare",  cloudflare, buffer, mimeType),
  ]);

  const rows = [g, m, c];

  // Print table
  console.log("━".repeat(90));
  console.log(
    "Provider".padEnd(14) +
    "耗时(ms)".padEnd(12) +
    "状态".padEnd(8) +
    "alt_text_en (前80字)".padEnd(42) +
    "tags (前4个)"
  );
  console.log("━".repeat(90));

  for (const r of rows) {
    const status = r.error ? "❌ 失败" : "✅ 成功";
    const content = r.error ? r.error.slice(0, 40) : r.altEn;
    console.log(
      r.name.padEnd(14) +
      String(r.ms).padEnd(12) +
      status.padEnd(10) +
      content.slice(0, 40).padEnd(42) +
      (r.error ? "" : r.tags)
    );
  }
  console.log("━".repeat(90));

  // Speed ranking
  const sorted = [...rows].sort((a, b) => a.ms - b.ms);
  console.log(`\n🏆 速度排名: ${sorted.map((r, i) => `${i + 1}. ${r.name}(${r.ms}ms)`).join("  |  ")}`);
}

main().catch(console.error);
