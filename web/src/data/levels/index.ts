import type { LevelDef } from "../../sim/level";
import level01 from "./level01.json";

/** SPEC-103: 収録レベル（Phase 1 は Lv1 のみ） */
export const LEVELS: readonly LevelDef[] = [level01 as LevelDef];

export function getLevel(id: string): LevelDef {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) throw new Error(`unknown level: ${id}`);
  return lv;
}
