function readEnv(key: string): string {
  const raw = process.env[key] ?? "";
  return (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).trim();
}

async function main() {
  loadEnvLocal();

  const accountId = readEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = readEnv("CLOUDFLARE_API_TOKEN");
  const model = readEnv("CLOUDFLARE_MODEL") || "@cf/meta/llama-3.2-11b-vision-instruct";

  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is not configured");
  }
  if (!apiToken) {
    throw new Error("CLOUDFLARE_API_TOKEN is not configured");
  }
  if (!model.startsWith("@cf/meta/")) {
    console.log(`Skip agreement: ${model} is not a Meta-hosted model.`);
    return;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: "agree" }),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    if (response.status === 403 && /thank you for agreeing|may now use the model/i.test(text)) {
      console.log(`Agreement was already accepted for ${model}.`);
      return;
    }
    throw new Error(`Cloudflare agree request failed (${response.status}): ${text}`);
  }

  console.log(`Agreement request succeeded for ${model}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}
