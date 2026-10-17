// SPEC-126: 総合スコアの「ふつうのクリア」を自動プレイで測る（npm run score:measure）。
// 標準の強化順でボットが新しいセーブから全 9 レベルを初クリアするまで遊び、各レベルの初クリアの成績を集計する
import { LEVELS } from "../src/data/levels";
import { runBot } from "../src/sim/bot";
import { applyRunResult, buyBlock, buyNode, claimableNodes, computeModifiers, computeReward, isLevelUnlocked, runResultOf } from "../src/meta/progress";
import { createNewSave } from "../src/meta/save";
import { STANDARD_BUY_ORDER } from "../src/meta/campaign";
import { levelPoints, levelBestOf } from "../src/meta/score";

const rows: any[] = [];
for (const seed of [1, 2, 3, 4, 5]) {
  let save = createNewSave(new Date(0));
  for (let run = 1; run <= 140; run++) {
    if (save.meta.levels.L9?.cleared) break;
    let bought = true;
    while (bought) {
      bought = false;
      for (const id of STANDARD_BUY_ORDER) if (buyBlock(save, id) === null) { save = buyNode(save, id); bought = true; }
      for (const n of claimableNodes(save)) { save = buyNode(save, n.id); bought = true; }
    }
    const level = LEVELS.find((l) => isLevelUnlocked(save, l.id) && !save.meta.levels[l.id]?.cleared) ?? LEVELS[0];
    const sim = runBot(level, seed * 1000 + run, { mods: computeModifiers(save) });
    const won = sim.status === "won";
    const result = runResultOf(level.id, won, sim.stats);
    if (won) {
      const best = levelBestOf({ hp: sim.hp, maxHp: sim.maxHp, heroesUsed: sim.heroes.length, slots: level.slots.length, earlyBonus: sim.stats.earlyBonus });
      rows.push({ seed, run, level: level.id, hp: best.hpLeft / best.maxHp, used: best.heroesUsed, slots: best.slots, early: best.earlyBonus, pts: Math.round(levelPoints(level.id, best)) });
    }
    save = applyRunResult(save, result, computeReward(level, result, save));
  }
}
const by: Record<string, any[]> = {};
for (const r of rows) (by[r.level] ||= []).push(r);
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
let total = 0;
for (const id of LEVELS.map((l) => l.id)) {
  const a = by[id] || [];
  if (!a.length) { console.log(id, "クリアなし"); continue; }
  const pts = avg(a.map((r) => r.pts)); total += pts;
  console.log(id, `n=${a.length}`, `体力 ${avg(a.map((r) => r.hp)).toFixed(2)}`, `置いた ${avg(a.map((r) => r.used)).toFixed(1)}/${a[0].slots}`,
    `空き ${avg(a.map((r) => (r.slots - r.used) / r.slots)).toFixed(2)}`, `早呼び ${Math.round(avg(a.map((r) => r.early)))}`, `点 ${Math.round(pts)}`, `ラン ${a.map((r) => r.run).join(",")}`);
}
const ratio = avg(rows.map((r) => r.hp + (r.slots - r.used) / r.slots));
console.log("合計の平均", Math.round(total), "体力＋空きの平均", ratio.toFixed(3), "早呼びの合計の平均", Math.round(avg([1,2,3,4,5].map((s) => rows.filter((r) => r.seed === s).reduce((t, r) => t + r.early, 0)))));
