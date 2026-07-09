export function parseFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    return last || "unknown.jpg";
  } catch {
    return "unknown.jpg";
  }
}

export function createTraceId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 10);
  return `img-${date}-${rand}`;
}
