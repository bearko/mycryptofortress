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
    { speaker: "navi", text: "幻獣の HP はたったの 3。敵が 3 体たどり着いたらおしまいです……！" },
    { speaker: "navi", text: "倒した敵は GUM を落とします。画面をなぞって回収してくださいね。GUM でヒーローを配置・強化できます！" },
    { speaker: "navi", text: "準備ができたら「Wave 開始」！……最初はきっと負けてしまいます。でも大丈夫、戦った分だけ CE がもらえて、スキルツリーで強くなれます！" },
  ],
  "result.first": [
    { speaker: "navi", text: "おつかれさまでした！手に入れた CE は、ホームの「スキルツリー」で使えます。" },
    { speaker: "navi", text: "まずは真ん中の「黄金の工房」で開始時の GUM を増やしましょう。ヒーローを 2 人置ければ、次の Wave も越えられるはずです！" },
    { speaker: "navi", text: "左下の「ノービスプロテクション」で幻獣の HP も増やせます。HP が増えれば、少しくらい敵に抜けられても耐えられますよ！" },
    { speaker: "navi", text: "解放したスキルはいつでも無料で返金できるので、いろいろな組み合わせを試してみてくださいね！" },
  ],
  "tree.first": [
    { speaker: "navi", text: "ここがスキルツリーです。真ん中の「黄金の工房」から、線でつながったスキルを順に解放できます。" },
    { speaker: "navi", text: "上は弓、左は雷と結界、右は炎と採掘。下は幻獣の守り・幻獣砲・GUM の稼ぎです。スキルをタップすると効果と必要な CE が見られます。" },
    { speaker: "navi", text: "ドラッグで移動、ピンチ（PC はホイール）で拡大縮小。返金は無料なので、気軽に試してください！" },
  ],
  "emblem.first": [
    { speaker: "navi", text: "初めてノードを守り切ると「エンブレム」がもらえます！" },
    { speaker: "navi", text: "エンブレムは新しい力の解放に使います。新しいヒーロー、幻獣砲、それに「魔石」……どれから解放するかはあなた次第です！" },
  ],
  "stone.first": [
    { speaker: "navi", text: "魔石を持ってきましたね！ヒーローをタップして「魔石」ボタンから装着できます。" },
    { speaker: "navi", text: "同じ魔石でも、付けるヒーローによって効き方が変わります。長押しで効果を確かめてくださいね。幻獣をタップすると幻獣砲にも付けられます！" },
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
  "level.L4.intro": [
    { speaker: "chris", text: "ベーグルは硬くて遅い。しかも状態異常が半分しか効かない！" },
    { speaker: "chris", text: "鍵のかかったマスは GUM を払えば開けられる。ここぞという場所に開けて、ヒーローを増やすんだ。" },
  ],
  "level.L5.intro": [
    { speaker: "chris", text: "最後に来るのはゴースト・グリム兄弟とゴースト・ライト兄弟。左右から同時にやってくるぞ！" },
    { speaker: "chris", text: "片方を倒すと、もう片方が怒って速くなる。両方をバランスよく削れ！" },
  ],
  "level.L7.intro": [
    { speaker: "chris", text: "カメレオンは姿を消して進んでくる。ヒーローのすぐ近くか、ガルーダの魔石を持つヒーローの射程に入るまで狙えないぞ！" },
    { speaker: "chris", text: "ハートブリードは周りの敵を回復する。先に倒してしまおう。最後はゴースト・チンギス・ハン……手下を呼びながら進んでくる！" },
  ],
  "level.L8.intro": [
    { speaker: "chris", text: "ここのボスはディープ・ヨシュカ。HP が半分を切るたびに 2 体に分かれて、最大 4 体になる！" },
    { speaker: "chris", text: "1 体でも幻獣にたどり着いたら終わりだ。範囲攻撃で分身ごとまとめて削れ！" },
  ],
  "level.L9.intro": [
    { speaker: "chris", text: "最後の相手はプーリー・ビースト。長い胴体の節すべてで HP を共有している。" },
    { speaker: "chris", text: "節の数だけ当たる範囲攻撃が決め手だ。雷の連鎖、炎、結界、幻獣砲……全部の力を合わせろ！" },
  ],
  "level.L6.intro": [
    { speaker: "chris", text: "ラブレターは倒すと分裂する。グランデ → トール → ショートと、3 段階だ！" },
    { speaker: "chris", text: "範囲攻撃の結界・炎・雷が頼りになる。最後はゴースト・武田信玄……状態異常がほとんど効かない強敵だ。" },
  ],
};

/** ステージ選択でクリスくんが話すヒント（毎回ランダム） */
export const CHRIS_TIPS: string[] = [
  "序盤はヒーローを何人置けるかが勝負だ。GUM を増やすスキルから強化しよう！",
  "ヒーローは経路の曲がり角の近くに置くと、長く攻撃できるぞ。",
  "GUM は 10 秒で消える。戦いの合間になぞって回収しよう！",
  "狙いを「ボス優先」にすると、ボス戦で頼りになる。",
  "負けても CE は入る。スキルツリーで強化してから再挑戦だ！",
  "スキルの返金は無料だ。ステージに合わせて組み替えてみよう。",
  "Wave の合間は「次の Wave」で早めに呼べる。時間の節約になるぞ。",
  "幻獣の HP は最初 3 しかない。守りのスキルで HP を増やすのも立派な作戦だ。",
  "結界の近くにヒーローを置くと「電気伝導」で攻撃が速くなる。組み合わせを考えよう！",
  "「伏爆の罠」があれば、倒した敵が爆発して周りを巻き込む。密集した敵に効くぞ。",
];

/** リザルトでマイクリくんが実況するひと言 */
export function maycriComment(won: boolean, wavesReached: number, ce: number): string {
  if (won) return `防衛成功〜！CE +${ce} ゲットだよ！`;
  if (wavesReached <= 3) return `まだまだこれから！CE +${ce} でスキルを強化しよう！`;
  return `惜しい！Wave ${wavesReached} まで粘ったね。CE +${ce}！`;
}
