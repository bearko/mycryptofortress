import { ENEMIES } from "../data/balance/enemies";

/** SPEC-103: レベル定義（web/src/data/levels/*.json） */
export interface Cell {
  col: number;
  row: number;
}

export type SlotKind = "normal";

export interface SlotDef extends Cell {
  kind?: SlotKind;
}

export interface PathDef {
  id: string;
  /** マス座標 [col, row] の折れ線。盤面の外周 1 マスまで可。終点は幻獣 */
  points: [number, number][];
}

export interface WaveGroup {
  enemy: string;
  count: number;
  interval: number;
  path: string;
  delay: number;
}

export interface WaveDef {
  reward: number;
  hpMul: number;
  groups: WaveGroup[];
}

export interface LevelDef {
  id: string;
  name: string;
  background: string;
  cols: number;
  rows: number;
  cryptid: Cell;
  startGum: number;
  cryptidHp: number;
  prepSeconds: number;
  intermissionSeconds: number;
  /** SPEC-106: ラン終了時の CE（クリアした Wave ごと / クリア / 初回クリアの追加分） */
  reward: { perWave: number; clear: number; firstClear: number };
  paths: PathDef[];
  slots: SlotDef[];
  waves: WaveDef[];
}

/** 経路が通るマス（端点を含む、盤面外は除く） */
export function pathCells(level: Pick<LevelDef, "cols" | "rows">, path: PathDef): Cell[] {
  const out: Cell[] = [];
  const seen = new Set<string>();
  for (let i = 0; i + 1 < path.points.length; i++) {
    const [c0, r0] = path.points[i];
    const [c1, r1] = path.points[i + 1];
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = 0; s <= steps; s++) {
      const col = c0 + Math.sign(c1 - c0) * s;
      const row = r0 + Math.sign(r1 - r0) * s;
      const k = `${col},${row}`;
      if (col < 0 || row < 0 || col >= level.cols || row >= level.rows || seen.has(k)) continue;
      seen.add(k);
      out.push({ col, row });
    }
  }
  return out;
}

/** SPEC-103 §3: 問題があればエラー文字列の配列を返す（空なら妥当） */
export function validateLevel(lv: LevelDef): string[] {
  const errs: string[] = [];
  const inBoard = (c: number, r: number) => c >= 0 && r >= 0 && c < lv.cols && r < lv.rows;
  if (!(lv.cols > 0 && lv.rows > 0)) errs.push("cols / rows は正の数");
  if (!inBoard(lv.cryptid.col, lv.cryptid.row)) errs.push("cryptid が盤面外");
  if (lv.startGum < 0 || lv.cryptidHp <= 0) errs.push("startGum / cryptidHp が不正");
  if (!lv.reward || [lv.reward.perWave, lv.reward.clear, lv.reward.firstClear].some((v) => !(v >= 0))) errs.push("reward が不正");

  const pathIds = new Set<string>();
  const onPath = new Set<string>();
  if (lv.paths.length === 0) errs.push("paths が空");
  lv.paths.forEach((p, i) => {
    if (pathIds.has(p.id)) errs.push(`paths[${i}]: id 重複 ${p.id}`);
    pathIds.add(p.id);
    if (p.points.length < 2) errs.push(`paths[${i}]: 点が 2 つ未満`);
    p.points.forEach(([c, r], j) => {
      if (c < -1 || r < -1 || c > lv.cols || r > lv.rows) errs.push(`paths[${i}]: points[${j}] が盤面 + 外周 1 マスの外`);
      if (j > 0) {
        const [pc, pr] = p.points[j - 1];
        if (pc !== c && pr !== r) errs.push(`paths[${i}]: points[${j - 1}]→[${j}] が斜め`);
        if (pc === c && pr === r) errs.push(`paths[${i}]: points[${j - 1}]→[${j}] が同じ点`);
      }
    });
    const last = p.points[p.points.length - 1];
    if (last && (last[0] !== lv.cryptid.col || last[1] !== lv.cryptid.row)) errs.push(`paths[${i}]: 終点が幻獣の位置ではない`);
    for (const c of pathCells(lv, p)) onPath.add(`${c.col},${c.row}`);
  });

  const slotSeen = new Set<string>();
  lv.slots.forEach((s, i) => {
    const k = `${s.col},${s.row}`;
    if (!inBoard(s.col, s.row)) errs.push(`slots[${i}]: 盤面外`);
    if (slotSeen.has(k)) errs.push(`slots[${i}]: 重複`);
    if (onPath.has(k)) errs.push(`slots[${i}]: 経路上`);
    if (s.col === lv.cryptid.col && s.row === lv.cryptid.row) errs.push(`slots[${i}]: 幻獣と重なる`);
    if (s.kind !== undefined && s.kind !== "normal") errs.push(`slots[${i}]: kind ${s.kind} は未対応`);
    slotSeen.add(k);
  });

  if (lv.waves.length === 0) errs.push("waves が空");
  lv.waves.forEach((w, i) => {
    if (!(w.hpMul > 0)) errs.push(`waves[${i}]: hpMul > 0`);
    if (w.reward < 0) errs.push(`waves[${i}]: reward ≥ 0`);
    if (w.groups.length === 0) errs.push(`waves[${i}]: groups が空`);
    w.groups.forEach((g, j) => {
      const at = `waves[${i}].groups[${j}]`;
      if (!ENEMIES[g.enemy]) errs.push(`${at}: 未知の敵 ${g.enemy}`);
      if (!pathIds.has(g.path)) errs.push(`${at}: 未知の経路 ${g.path}`);
      if (!(g.count >= 1)) errs.push(`${at}: count ≥ 1`);
      if (!(g.interval > 0)) errs.push(`${at}: interval > 0`);
      if (!(g.delay >= 0)) errs.push(`${at}: delay ≥ 0`);
    });
  });
  return errs;
}
