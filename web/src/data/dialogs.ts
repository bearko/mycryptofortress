/**
 * SPEC-108a: ナビ / NPC の会話スクリプト。オリジナルキャラクターは戦闘に参加しない。
 *   navi   = マインちゃん（ナビゲーター）
 *   chris  = クリスくん（作戦参謀・チャレンジ案内）
 *   maycri = マイクリくん（実況・記録係）
 */
export type Speaker = "navi" | "chris" | "maycri";

export interface DialogLine {
  speaker: Speaker;
  text: string;
}

export const SPEAKER_NAME: Record<Speaker, string> = {
  navi: "マインちゃん",
  chris: "クリスくん",
  maycri: "マイクリくん",
};

/** 一度だけ見せる会話（既読は SaveData.meta.seenDialogs に記録） */
export const DIALOGS: Record<string, DialogLine[]> = {
  "run.tutorial": [
    { speaker: "navi", text: "はじめまして！ナビゲーターのマインです。ここは幻獣を狙うウイルスたちの通り道なんです。" },
    { speaker: "navi", text: "「＋」のマスをタップすると、ヒーローを配置できます。まずはロビンフッドさんを置いてみましょう！" },
    { speaker: "navi", text: "倒した敵は GUM を落とします。画面をなぞって回収してくださいね。GUM でヒーローを配置・強化できます！" },
    { speaker: "navi", text: "準備ができたら「Wave 開始」！負けても大丈夫。戦った分だけ CE がもらえて、スキルツリーで強くなれます。" },
  ],
  "result.first": [
    { speaker: "navi", text: "おつかれさまでした！手に入れた CE は、ホームの「スキルツリー」で使えます。" },
    { speaker: "navi", text: "解放したスキルはいつでも無料で返金できるので、いろいろな組み合わせを試してみてくださいね！" },
  ],
  "tree.first": [
    { speaker: "navi", text: "ここがスキルツリーです。真ん中の「ノービスショット」から、つながったスキルを順に解放できます。" },
    { speaker: "navi", text: "上は弓、左下は幻獣の守り、右下は GUM の稼ぎ。スキルをタップすると効果と必要な CE が見られます。" },
    { speaker: "navi", text: "ドラッグで移動、ピンチ（PC はホイール）で拡大縮小。返金は無料なので、気軽に試してください！" },
  ],
  "levelSelect.first": [
    { speaker: "chris", text: "作戦参謀のクリスだ！出撃するノードを選んでくれ。" },
    { speaker: "chris", text: "ノードを守り切ると次のノードが解放される。初回クリアにはボーナス CE も出るぞ！" },
  ],
  "level.L2.intro": [
    { speaker: "chris", text: "気をつけろ！このノードにはクリーパーが出る。やつらは経路の途中で跳んで、一気に距離を詰めてくるぞ。" },
    { speaker: "chris", text: "幻獣の手前にもヒーローを置いておくと安心だ。" },
  ],
  "level.L3.intro": [
    { speaker: "chris", text: "ここは入口が 3 つ。真ん中の道は幻獣まで一直線だ！" },
    { speaker: "chris", text: "最後にはゴースト・ナポレオンが来る。ボスへのダメージを上げる「鵺殺し」も役に立つはずだ。" },
  ],
};

/** ステージ選択でクリスくんが話すヒント（毎回ランダム） */
export const CHRIS_TIPS: string[] = [
  "ヒーローは経路の曲がり角の近くに置くと、長く攻撃できるぞ。",
  "GUM は 10 秒で消える。戦いの合間になぞって回収しよう！",
  "狙いを「ボス優先」にすると、ボス戦で頼りになる。",
  "負けても CE は入る。スキルツリーで強化してから再挑戦だ！",
  "スキルの返金は無料だ。ステージに合わせて組み替えてみよう。",
  "Wave の合間は「次の Wave」で早めに呼べる。時間の節約になるぞ。",
];

/** リザルトでマイクリくんが実況するひと言 */
export function maycriComment(won: boolean, wavesReached: number, ce: number): string {
  if (won) return `防衛成功〜！CE +${ce} ゲットだよ！`;
  if (wavesReached <= 3) return `まだまだこれから！CE +${ce} でスキルを強化しよう！`;
  return `惜しい！Wave ${wavesReached} まで粘ったね。CE +${ce}！`;
}
