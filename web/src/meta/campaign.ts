import { LEVELS } from "../data/levels";
import { runBot, type BotOptions } from "../sim/bot";
import { applyRunResult, buyBlock, buyNode, claimableNodes, computeModifiers, computeReward, isLevelUnlocked, runResultOf } from "./progress";
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
      // 条件つきパネル（無料）は届いたらすぐ解放する
      for (const n of claimableNodes(save)) {
        save = buyNode(save, n.id);
        bought = true;
      }
    }
    const level = LEVELS.find((l) => isLevelUnlocked(save, l.id) && !save.meta.levels[l.id]?.cleared) ?? LEVELS[0];
    const sim = runBot(level, (opts.seed ?? 1) + run, { ...opts.bot, mods: computeModifiers(save) });
    const result = runResultOf(level.id, sim.status === "won", sim.stats);
    const reward = computeReward(level, result, save);
    save = applyRunResult(save, result, reward);
    log.push({ run, levelId: level.id, won: result.won, wavesReached: result.wavesReached, ce: reward.ce, seconds: Math.round(sim.time) });
  }
  return { log, save };
}

/**
 * バランス確認で使う標準の購入順（1 周で各 1 レベルずつ買う）。
 * エンブレム（解放）は魔石と新ロールを交互に、CE は GUM → HP → 弓の火力 → 防御の順に進める。
 * 一撃特化（崩城の一撃）は弓の挙動を変える選択肢なので標準には入れない。
 */
export const STANDARD_BUY_ORDER = [
  "stone_ifrit",
  "raiden",
  "stone_garuda",
  "amenra",
  "kyukyu",
  "stone_tiamat",
  "jiraika",
  "stone_leviathan",
  "mining_alpha",
  "ichinichi",
  "tesla_coil",
  "koumei",
  "bokun",
  "snipe",
  "mining_omega",
  "sanjushi",
  "root",
  "novice_protection",
  "moai",
  "yabusame",
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
  "tactics",
  "novice_bright",
  "taiyo",
  "houseki",
  "ogi_otoshi",
  "kyudo_a",
  "ryuou",
  "elite_bright",
  "daichi_ougon",
  "recovery",
  "gunshin",
  "mikajime",
  "strategy",
  "goji",
  "dragon_quake",
  "houki",
  "kihei",
  "dokugiri",
  "wisdom_bright",
  "shisan",
  "mouri",
  "seijo",
  "kinjo",
  "eiyu",
  "kouya",
  "sekika",
  "ryugan",
  "kenshiko",
  "tiger_shoot",
  "fushigi",
  "kibou",
  "shiden",
  "druid",
  "healing_light",
  "ougon_honoo",
  "hyoga",
  "medusa",
  "wisdom_shisan",
  "shintaku",
  "sanchujin",
  "ryuen",
  "kaijin",
  "seimei_ju",
  "raiju",
  "jujutsu",
  "shinen",
  "ten_ichigeki",
  "kaizoku",
  "suijin",
  "magellan",
  "denki",
  "fukubaku",
  "fukutsu",
  "muketsu",
  "renkan",
];
