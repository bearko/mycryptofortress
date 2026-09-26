import { DEFAULT_CRYPTID_ID, isCryptidId, type CryptidId } from "../data/cryptids";
import { LEVELS } from "../data/levels";
import { TREE_VERSION } from "../data/tree";
import type { StorageLike } from "./storage";

/**
 * SPEC-101 §5.5: セーブデータ。スキーマを変える時は SAVE_SCHEMA_VERSION を上げ、
 * MIGRATIONS[旧バージョン] に 1 段分の変換を追加する。
 */
export const SAVE_SCHEMA_VERSION = 6;

/** SPEC-116: ビルドセットの枠数 */
export const BUILD_SET_SLOTS = 5;

export interface SaveData {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  settings: {
    bgmVolume: number;
    seVolume: number;
    /** SPEC-116: オートレベル（丸パネル解放後に有効） */
    autoLevel: boolean;
    /** テストプレイ用の 5 倍速（省略時 OFF） */
    testSpeed?: boolean;
  };
  profile: { cryptidId: CryptidId };
  /** SPEC-106 / 107: メタ進行 */
  meta: MetaState;
}

export interface LevelProgress {
  cleared: boolean;
  /** 到達した最高 Wave（1 始まり） */
  bestWave: number;
  clears: number;
  runs: number;
}

export interface MetaState {
  /** 所持トークン（SPEC-116a: CE とエンブレム） */
  tokens: { ce: number; emblem: number };
  /** 累計獲得トークン（丸パネルの判定にも使う） */
  tokensEarned: { ce: number; emblem: number };
  /** スキルツリー: ノード ID → レベル */
  tree: Record<string, number>;
  levels: Record<string, LevelProgress>;
  /** 一度だけ見せる会話の既読 ID */
  seenDialogs: string[];
  /** 最後に合わせたスキルツリーの版（TREE_VERSION と違えば全返金する） */
  treeVersion: number;
  /** SPEC-116: ビルドセット（スキルツリーの配置の保存。空き枠は null） */
  buildSets: (BuildSet | null)[];
  /** SPEC-119: 条件つきパネルの判定に使う累計記録 */
  stats: LifetimeStats;
}

/** SPEC-119: ランをまたいだ累計記録（勝敗・撤退に関係なく積み上がる） */
export interface LifetimeStats {
  kills: number;
  bossKills: number;
  gumCollected: number;
  wavesCleared: number;
  /** 一度も到達ダメージを受けずにクリアした回数 */
  flawlessClears: number;
  runs: number;
}

export const LIFETIME_STAT_KEYS = ["kills", "bossKills", "gumCollected", "wavesCleared", "flawlessClears", "runs"] as const satisfies readonly (keyof LifetimeStats)[];

export function emptyStats(): LifetimeStats {
  return { kills: 0, bossKills: 0, gumCollected: 0, wavesCleared: 0, flawlessClears: 0, runs: 0 };
}

export interface BuildSet {
  name: string;
  tree: Record<string, number>;
}

export function emptyMeta(): MetaState {
  return {
    tokens: { ce: 0, emblem: 0 },
    tokensEarned: { ce: 0, emblem: 0 },
    tree: {},
    levels: {},
    seenDialogs: [],
    treeVersion: TREE_VERSION,
    buildSets: Array.from({ length: BUILD_SET_SLOTS }, () => null),
    stats: emptyStats(),
  };
}

export const SLOT_IDS = [1, 2, 3] as const;
export type SlotId = (typeof SLOT_IDS)[number];

const KEY_PREFIX = "mcf.v2.slot.";
const ACTIVE_SLOT_KEY = "mcf.v2.activeSlot";

/** 旧バージョン n のデータを n+1 に変換する関数群 */
export type Migrations = Record<number, (data: Record<string, unknown>) => Record<string, unknown>>;
export const MIGRATIONS: Migrations = {
  // v1 → v2: メタ進行（トークン・ツリー・レベル進行・既読会話）を追加
  1: (d) => ({ ...d, meta: emptyMeta() }),
  // v2 → v3: スキルツリーの構成変更（ルートを GUM ノードに）。ツリーを全返金する。
  // CE はツリーにしか使わないので、所持 = 累計獲得に戻せば全額返金になる。
  2: (d) => {
    const meta = d.meta as MetaState;
    return { ...d, meta: { ...meta, tree: {}, tokens: { ...meta.tokens, ce: meta.tokensEarned.ce } } };
  },
  // v3 → v4: ツリーの版を記録する（0 = 不明 → 読み込み時に syncTreeVersion で全返金される）
  3: (d) => ({ ...d, meta: { ...(d.meta as MetaState), treeVersion: 0 } }),
  // v4 → v5: エンブレム（クリア済みレベルの分を付与）・ビルドセット・オートレベル設定
  4: (d) => {
    const meta = d.meta as MetaState;
    const emblem = LEVELS.filter((l) => meta.levels[l.id]?.cleared).reduce((s, l) => s + (l.reward.emblems ?? 0), 0);
    return {
      ...d,
      settings: { ...(d.settings as object), autoLevel: false },
      meta: {
        ...meta,
        tokens: { ...meta.tokens, emblem },
        tokensEarned: { ...meta.tokensEarned, emblem },
        buildSets: Array.from({ length: BUILD_SET_SLOTS }, () => null),
      },
    };
  },
  // v5 → v6: 累計記録（SPEC-119）。挑戦回数はレベルごとの記録から復元し、ほかは 0 から数える
  5: (d) => {
    const meta = d.meta as MetaState;
    const runs = Object.values(meta.levels).reduce((s, p) => s + p.runs, 0);
    return { ...d, meta: { ...meta, stats: { ...emptyStats(), runs } } };
  },
};

export function createNewSave(now: Date = new Date()): SaveData {
  const iso = now.toISOString();
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    createdAt: iso,
    updatedAt: iso,
    settings: { bgmVolume: 0.6, seVolume: 0.8, autoLevel: false },
    profile: { cryptidId: DEFAULT_CRYPTID_ID },
    meta: emptyMeta(),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isVolume = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;

export function isValidSave(v: unknown): v is SaveData {
  if (!isObj(v) || v.schemaVersion !== SAVE_SCHEMA_VERSION) return false;
  if (typeof v.createdAt !== "string" || typeof v.updatedAt !== "string") return false;
  const { settings, profile } = v;
  if (!isObj(settings) || !isVolume(settings.bgmVolume) || !isVolume(settings.seVolume) || typeof settings.autoLevel !== "boolean") return false;
  if (settings.testSpeed !== undefined && typeof settings.testSpeed !== "boolean") return false;
  if (!isObj(profile) || !isCryptidId(profile.cryptidId)) return false;
  return isValidMeta(v.meta);
}

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function isValidMeta(m: unknown): m is MetaState {
  if (!isObj(m)) return false;
  if (!isObj(m.tokens) || !isCount(m.tokens.ce) || !isCount(m.tokens.emblem)) return false;
  if (!isObj(m.tokensEarned) || !isCount(m.tokensEarned.ce) || !isCount(m.tokensEarned.emblem)) return false;
  if (!Array.isArray(m.buildSets) || m.buildSets.length !== BUILD_SET_SLOTS) return false;
  if (!m.buildSets.every((b) => b === null || (isObj(b) && typeof b.name === "string" && isObj(b.tree)))) return false;
  if (!isObj(m.tree) || !Object.values(m.tree).every((lv) => Number.isInteger(lv) && (lv as number) >= 0)) return false;
  if (!isObj(m.levels)) return false;
  for (const p of Object.values(m.levels)) {
    if (!isObj(p) || typeof p.cleared !== "boolean" || !isCount(p.bestWave) || !isCount(p.clears) || !isCount(p.runs)) return false;
  }
  if (!Number.isInteger(m.treeVersion)) return false;
  if (!isObj(m.stats) || !LIFETIME_STAT_KEYS.every((k) => isCount((m.stats as Record<string, unknown>)[k]))) return false;
  return Array.isArray(m.seenDialogs) && m.seenDialogs.every((x) => typeof x === "string");
}

/**
 * 任意の値を現行スキーマへ変換する。変換できない / 未来のバージョン / 破損は null。
 */
export function migrate(raw: unknown, migrations: Migrations = MIGRATIONS): SaveData | null {
  if (!isObj(raw) || typeof raw.schemaVersion !== "number") return null;
  let data: Record<string, unknown> = raw;
  let version = raw.schemaVersion;
  if (version > SAVE_SCHEMA_VERSION) return null;
  while (version < SAVE_SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) return null;
    try {
      data = step(data);
    } catch {
      return null;
    }
    version += 1;
    data = { ...data, schemaVersion: version };
  }
  return isValidSave(data) ? data : null;
}

export function exportSave(data: SaveData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importSave(text: string, migrations: Migrations = MIGRATIONS): SaveData | null {
  try {
    const bin = atob(text.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return migrate(JSON.parse(new TextDecoder().decode(bytes)), migrations);
  } catch {
    return null;
  }
}

export class SaveStore {
  constructor(
    private readonly storage: StorageLike,
    private readonly clock: () => Date = () => new Date(),
    private readonly migrations: Migrations = MIGRATIONS,
  ) {}

  load(slot: SlotId): SaveData | null {
    const text = this.storage.getItem(KEY_PREFIX + slot);
    if (text === null) return null;
    try {
      return migrate(JSON.parse(text), this.migrations);
    } catch {
      return null;
    }
  }

  /** 保存して、updatedAt を更新したデータを返す */
  save(slot: SlotId, data: SaveData): SaveData {
    const next: SaveData = { ...data, updatedAt: this.clock().toISOString() };
    this.storage.setItem(KEY_PREFIX + slot, JSON.stringify(next));
    return next;
  }

  /** 読めなければ新規作成して保存する（破損データは上書きされる） */
  loadOrCreate(slot: SlotId): SaveData {
    return this.load(slot) ?? this.save(slot, createNewSave(this.clock()));
  }

  delete(slot: SlotId): void {
    this.storage.removeItem(KEY_PREFIX + slot);
  }

  getActiveSlot(): SlotId {
    const v = Number(this.storage.getItem(ACTIVE_SLOT_KEY));
    return (SLOT_IDS as readonly number[]).includes(v) ? (v as SlotId) : 1;
  }

  setActiveSlot(slot: SlotId): void {
    this.storage.setItem(ACTIVE_SLOT_KEY, String(slot));
  }

  listSlots(): { slot: SlotId; data: SaveData | null }[] {
    return SLOT_IDS.map((slot) => ({ slot, data: this.load(slot) }));
  }
}
