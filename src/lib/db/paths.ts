import path from "path";

const DEFAULT_DATA_DIR = "data";

export function getDataDir(): string {
  const envDir = process.env.MARKET_RESEARCH_DATA_DIR;
  if (envDir) return envDir;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), DEFAULT_DATA_DIR);
}

export function getCacheDir(): string {
  return path.join(getDataDir(), "cache");
}
