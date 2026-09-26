import {
  BUILD_SET_SLOTS,
  SAVE_SCHEMA_VERSION,
  SaveStore,
  createNewSave,
  emptyMeta,
  exportSave,
  importSave,
  isValidSave,
  migrate,
  type Migrations,
} from "./save";
import { createMemoryStorage } from "./storage";

const fixedClock = (iso: string) => () => new Date(iso);

describe("SaveStore (SPEC-101 §5.5)", () => {
  it("未保存のスロットは null、loadOrCreate で新規作成して保存", () => {
    const storage = createMemoryStorage();
    const store = new SaveStore(storage, fixedClock("2026-09-26T00:00:00.000Z"));
    expect(store.load(1)).toBeNull();
    const created = store.loadOrCreate(1);
    expect(isValidSave(created)).toBe(true);
    expect(created.profile.cryptidId).toBe("ocean");
    expect(store.load(1)).toEqual(created);
  });

  it("保存で updatedAt が更新され、スロットは独立", () => {
    const store = new SaveStore(createMemoryStorage(), fixedClock("2026-09-27T12:00:00.000Z"));
    const base = createNewSave(new Date("2026-01-01T00:00:00.000Z"));
    const saved = store.save(2, { ...base, profile: { cryptidId: "ruby" } });
    expect(saved.updatedAt).toBe("2026-09-27T12:00:00.000Z");
    expect(saved.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(store.load(2)?.profile.cryptidId).toBe("ruby");
    expect(store.load(1)).toBeNull();
    expect(store.listSlots().map((s) => s.data !== null)).toEqual([false, true, false]);
  });

  it("破損 JSON・検証失敗は null を返し例外を投げない。loadOrCreate は上書きする", () => {
    const storage = createMemoryStorage();
    const store = new SaveStore(storage);
    storage.setItem("mcf.v2.slot.1", "{broken");
    expect(store.load(1)).toBeNull();
    storage.setItem("mcf.v2.slot.2", JSON.stringify({ ...createNewSave(), profile: { cryptidId: "unknown" } }));
    expect(store.load(2)).toBeNull();
    expect(isValidSave(store.loadOrCreate(1))).toBe(true);
  });

  it("アクティブスロットの既定値は 1、不正値も 1", () => {
    const storage = createMemoryStorage();
    const store = new SaveStore(storage);
    expect(store.getActiveSlot()).toBe(1);
    store.setActiveSlot(3);
    expect(store.getActiveSlot()).toBe(3);
    storage.setItem("mcf.v2.activeSlot", "9");
    expect(store.getActiveSlot()).toBe(1);
  });

  it("削除でスロットが空になる", () => {
    const store = new SaveStore(createMemoryStorage());
    store.loadOrCreate(3);
    store.delete(3);
    expect(store.load(3)).toBeNull();
  });
});

describe("migrate", () => {
  it("旧バージョンをマイグレーションで現行スキーマへ変換（注入したマイグレーション）", () => {
    const current = createNewSave();
    const old = { schemaVersion: SAVE_SCHEMA_VERSION - 1, createdAt: current.createdAt, updatedAt: current.updatedAt, land: "grape" };
    const migrations: Migrations = {
      [SAVE_SCHEMA_VERSION - 1]: (d) => ({
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        settings: { bgmVolume: 0.5, seVolume: 0.5, autoLevel: false },
        profile: { cryptidId: d.land },
        meta: emptyMeta(),
      }),
    };
    const migrated = migrate(old, migrations);
    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.profile.cryptidId).toBe("grape");
  });

  it("v1（Phase 0〜1 のセーブ）は v2 に移行し、選んだ幻獣と設定を保つ", () => {
    const v1 = {
      schemaVersion: 1,
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:00.000Z",
      settings: { bgmVolume: 0, seVolume: 0.8 },
      profile: { cryptidId: "ruby" },
    };
    const migrated = migrate(v1);
    expect(migrated).not.toBeNull();
    expect(migrated!.profile.cryptidId).toBe("ruby");
    expect(migrated!.settings.bgmVolume).toBe(0);
    expect(migrated!.meta).toEqual({ ...emptyMeta(), treeVersion: 0 });
  });

  it("v2 → v3: ツリー構成の変更に合わせてツリーを全返金する（所持 CE = 累計獲得 CE）", () => {
    const v2 = {
      ...createNewSave(),
      schemaVersion: 2,
      meta: { ...emptyMeta(), tokens: { ce: 4 }, tokensEarned: { ce: 60 }, tree: { root: 2, golden_atelier: 3 } },
    };
    const migrated = migrate(v2);
    expect(migrated!.meta.tree).toEqual({});
    expect(migrated!.meta.tokens.ce).toBe(60);
  });

  it("meta の破損（負のトークン・不正なツリー）は無効", () => {
    const d = createNewSave();
    expect(isValidSave({ ...d, meta: { ...d.meta, tokens: { ce: -1 } } })).toBe(false);
    expect(isValidSave({ ...d, meta: { ...d.meta, tree: { root: 1.5 } } })).toBe(false);
    expect(isValidSave({ ...d, meta: { ...d.meta, seenDialogs: [1] } })).toBe(false);
  });

  it("マイグレーションが無い旧バージョン・未来バージョン・非オブジェクトは null", () => {
    expect(migrate({ schemaVersion: SAVE_SCHEMA_VERSION - 1 }, {})).toBeNull();
    expect(migrate({ ...createNewSave(), schemaVersion: SAVE_SCHEMA_VERSION + 1 })).toBeNull();
    expect(migrate("text")).toBeNull();
    expect(migrate(null)).toBeNull();
  });

  it("マイグレーション中の例外は null", () => {
    const migrations: Migrations = {
      [SAVE_SCHEMA_VERSION - 1]: () => {
        throw new Error("boom");
      },
    };
    expect(migrate({ schemaVersion: SAVE_SCHEMA_VERSION - 1 }, migrations)).toBeNull();
  });

  it("音量の範囲外は無効", () => {
    const d = createNewSave();
    expect(isValidSave({ ...d, settings: { bgmVolume: 1.5, seVolume: 0 } })).toBe(false);
  });
});

describe("export / import", () => {
  it("往復で同じデータに戻る（Base64 / UTF-8 安全）", () => {
    const d = { ...createNewSave(), profile: { cryptidId: "sage" as const } };
    const text = exportSave(d);
    expect(text).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(importSave(text)).toEqual(d);
  });

  it("不正な文字列は null", () => {
    expect(importSave("これは不正")).toBeNull();
    expect(importSave(btoa("{}"))).toBeNull();
  });
});

describe("v5（Phase 4）", () => {
  it("v4 → v5 でクリア済みレベルのエンブレムが付き、ビルドセット枠とオートレベル設定が増える", () => {
    const v4 = {
      schemaVersion: 4,
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:00.000Z",
      settings: { bgmVolume: 0.6, seVolume: 0.8 },
      profile: { cryptidId: "ocean" },
      meta: {
        tokens: { ce: 10 },
        tokensEarned: { ce: 500 },
        tree: { root: 1 },
        levels: { L1: { cleared: true, bestWave: 10, clears: 1, runs: 9 }, L2: { cleared: true, bestWave: 10, clears: 1, runs: 4 }, L3: { cleared: false, bestWave: 7, clears: 0, runs: 2 } },
        seenDialogs: [],
        treeVersion: 4,
      },
    };
    const s = migrate(v4)!;
    expect(s).not.toBeNull();
    expect(s.meta.tokens.emblem).toBe(2); // L1 + L2
    expect(s.meta.tokensEarned.emblem).toBe(2);
    expect(s.meta.buildSets).toHaveLength(BUILD_SET_SLOTS);
    expect(s.settings.autoLevel).toBe(false);
    // v5 → v6: 累計記録。挑戦回数はレベルごとの記録から復元する（SPEC-119）
    expect(s.meta.stats).toEqual({ kills: 0, bossKills: 0, gumCollected: 0, wavesCleared: 0, flawlessClears: 0, runs: 15 });
  });
});
