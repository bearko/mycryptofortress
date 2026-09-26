import { LEVELS } from "../data/levels";
import { runBot, type BotOptions } from "../sim/bot";
import { applyRunResult, buyBlock, buyNode, computeModifiers, computeReward, isLevelUnlocked } from "./progress";
import { createNewSave, type SaveData } from "./save";

export interface CampaignLog {
  run: number;
  levelId: string;
  won: boolean;
  wavesReached: number;
  ce: number;
  /** ラン時間（秒・等倍） */
  seconds: number;
}

/**
 * SPEC-106 §4: 自動検証用の「プレイヤー」。
 * ラン前に buyOrder の順で 1 レベルずつ買えるだけ買い、未クリアの最初のレベルに挑む。
 */
export function runCampaign(opts: {
  buyOrder: string[];
  maxRuns: number;
  /** この ID のレベルをクリアしたら終了（省略時は全レベル） */
  untilCleared?: string;
  bot?: BotOptions;
  seed?: number;
}): { log: CampaignLog[]; save: SaveData } {
  let save = createNewSave(new Date(0));
  const log: CampaignLog[] = [];
  const goal = opts.untilCleared ?? LEVELS[LEVELS.length - 1].id;
  for (let run = 1; run <= opts.maxRuns; run++) {
    if (save.meta.levels[goal]?.cleared) break;
    let bought = true;
    while (bought) {
      bought = false;
      for (const id of opts.buyOrder) {
        if (buyBlock(save, id) === null) {
          save = buyNode(save, id);
          bought = true;
        }
      }
    }
    const level = LEVELS.find((l) => isLevelUnlocked(save, l.id) && !save.meta.levels[l.id]?.cleared) ?? LEVELS[0];
    const sim = runBot(level, (opts.seed ?? 1) + run, { ...opts.bot, mods: computeModifiers(save) });
    const result = { levelId: level.id, won: sim.status === "won", wavesReached: sim.stats.wavesReached, wavesCleared: sim.stats.wavesCleared };
    const reward = computeReward(level, result, save);
    save = applyRunResult(save, result, reward);
    log.push({ run, levelId: level.id, won: result.won, wavesReached: result.wavesReached, ce: reward.ce, seconds: Math.round(sim.time) });
  }
  return { log, save };
}

/** バランス確認で使う標準の購入順（GUM → 弓の火力 → 防御を交互に。1 周で各 1 レベルずつ買う） */
export const STANDARD_BUY_ORDER = [
  "root",
  "mining",
  "yabusame",
  "novice_protection",
  "elite_yabusame",
  "brave_shot",
  "otakara",
  "shihonron",
  "brave_yabusame",
  "healing",
  "kyudo",
  "nue_goroshi",
  "elite_shot",
  "elite_protection",
  "houseki",
  "ogi_otoshi",
  "kyudo_a",
  "daichi_ougon",
  "recovery",
  "gunshin",
  "mining_omega",
  "snipe",
  "mouri",
  "seijo",
];
