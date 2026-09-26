/**
 * SPEC-100 §6.2: 拠点として配置する幻獣（クリプタイド）。
 * 所属ランドごとに 1 体。画像は `Image/Cryptids/`、背景はランドノード背景（`Image/Backgrounds/2x05.png`）。
 * 当面は見た目のみの差（性能差は SPEC-100 §11.2 で未決）。
 */
export const CRYPTID_IDS = [
  "ocean",
  "strawberry",
  "tangerine",
  "lime",
  "graphite",
  "grape",
  "sage",
  "blueberry",
  "ruby",
] as const;

export type CryptidId = (typeof CRYPTID_IDS)[number];

export interface CryptidDef {
  id: CryptidId;
  /** ランド名（MCH 表記） */
  landName: string;
  /** オーラ・選択枠などに使うランドカラー（0xRRGGBB） */
  color: number;
  imageKey: string;
  backgroundKey: string;
}

const LAND_META: Record<CryptidId, { landName: string; color: number }> = {
  ocean: { landName: "Ocean", color: 0x2ee6d6 },
  strawberry: { landName: "Strawberry", color: 0xff5a7a },
  tangerine: { landName: "Tangerine", color: 0xff9a2e },
  lime: { landName: "Lime", color: 0x9be34a },
  graphite: { landName: "Graphite", color: 0xa7adbb },
  grape: { landName: "Grape", color: 0xa66bff },
  sage: { landName: "Sage", color: 0x8fbf8a },
  blueberry: { landName: "Blueberry", color: 0x4a7dff },
  ruby: { landName: "Ruby", color: 0xe0245e },
};

export const CRYPTIDS: readonly CryptidDef[] = CRYPTID_IDS.map((id) => ({
  id,
  ...LAND_META[id],
  imageKey: `cryptid.${id}`,
  backgroundKey: `bg.land.${id}`,
}));

export const DEFAULT_CRYPTID_ID: CryptidId = "ocean";

export function isCryptidId(v: unknown): v is CryptidId {
  return typeof v === "string" && (CRYPTID_IDS as readonly string[]).includes(v);
}

export function getCryptid(id: CryptidId): CryptidDef {
  return CRYPTIDS.find((c) => c.id === id)!;
}
