import manifest from "../../assets.manifest.json";

/**
 * SPEC-101 §5.2: `web/assets.manifest.json` を唯一の登録先とする MCH アセット一覧。
 * 実体は `npm run assets:sync` で `public/assets/mch/<path>` に同梱される。
 */
export type AssetType = "image" | "audio";

export interface AssetEntry {
  /** ゲーム内の論理キー（一意） */
  key: string;
  type: AssetType;
  /** bearko/mycryptoheroes リポジトリ内の相対パス */
  path: string;
  /** false の場合は Boot で読まず、必要になった時点で読む（大きい背景など） */
  preload?: boolean;
}

export const ASSET_BASE_URL = "assets/mch/";

export const ASSETS: readonly AssetEntry[] = manifest.assets as AssetEntry[];

const byKey = new Map(ASSETS.map((a) => [a.key, a]));

export function getAsset(key: string): AssetEntry {
  const a = byKey.get(key);
  if (!a) throw new Error(`asset not in manifest: ${key}`);
  return a;
}

export function hasAsset(key: string): boolean {
  return byKey.has(key);
}

/** 公開 URL（ファイル名の空白などをエンコード） */
export function assetUrl(entry: AssetEntry): string {
  return ASSET_BASE_URL + entry.path.split("/").map(encodeURIComponent).join("/");
}

export function preloadAssets(): AssetEntry[] {
  return ASSETS.filter((a) => a.preload !== false);
}
