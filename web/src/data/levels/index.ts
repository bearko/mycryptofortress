import type { LevelDef } from "../../sim/level";
import level01 from "./level01.json";
import level02 from "./level02.json";
import level03 from "./level03.json";

/** SPEC-103: 収録レベル（この順で解放される） */
export const LEVELS: readonly LevelDef[] = [level01, level02, level03] as LevelDef[];

export function getLevel(id: string): LevelDef {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) throw new Error(`unknown level: ${id}`);
  return lv;
}
