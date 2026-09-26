import { tokenize, wrapJa } from "./jaWrap";

/** 全角 = 2、半角 = 1 の幅で測る */
const measure = (s: string) => Array.from(s).reduce((w, ch) => w + (/[\x20-\x7e]/.test(ch) ? 1 : 2), 0);

describe("日本語の折り返し", () => {
  it("英単語はひとかたまり、日本語は 1 文字ずつのトークンになる", () => {
    expect(tokenize("敵は GUM を")).toEqual(["敵", "は", " ", "GUM", " ", "を"]);
  });

  it("英単語の後の日本語を 1 語扱いせず、幅いっぱいまで詰めて折り返す", () => {
    const text = "倒した敵は GUM を落とします。画面をなぞって回収してくださいね。GUM でヒーローを配置・強化できます！";
    const lines = wrapJa(text, 40, measure);
    // 1 行目は「GUM」の直後で切れず、幅いっぱいまで入る
    expect(lines[0].startsWith("倒した敵は GUM を落とします")).toBe(true);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(42); // ぶら下げ 1 文字分まで
    // 文字は失わない（折り返し位置の空白を除く）
    expect(lines.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });

  it("句読点・閉じ括弧・小書き仮名は行頭に来ず、前の行にぶら下がる", () => {
    for (const text of ["ああああ。いい", "ああああ、いい", "ああああ」いい", "ああああっいい", "ああああーいい"]) {
      const lines = wrapJa(text, 8, measure);
      expect(lines[0], text).toBe(text.slice(0, 5));
      for (const l of lines.slice(1)) expect(/^[、。」っー]/.test(l), text).toBe(false);
    }
  });

  it("開き括弧は行末に残さず次の行へ送る", () => {
    const lines = wrapJa("あああ「いい」", 8, measure);
    expect(lines[0]).toBe("あああ");
    expect(lines[1].startsWith("「")).toBe(true);
  });

  it("改行はそのまま、行頭の空白は捨てる", () => {
    expect(wrapJa("ああ\nいい", 100, measure)).toEqual(["ああ", "いい"]);
    expect(wrapJa("ABCD EFGH", 5, measure)).toEqual(["ABCD", "EFGH"]);
  });

  it("幅を超える長い英単語は文字単位で割る", () => {
    const lines = wrapJa("ABCDEFGHIJ", 4, measure);
    expect(lines).toEqual(["ABCD", "EFGH", "IJ"]);
  });
});
