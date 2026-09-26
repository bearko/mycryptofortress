/**
 * 日本語向けの行折り返し（SPEC-101 §5.3 の日本語表示の補足）。
 *
 * Phaser 標準の折り返しは「空白で区切った単語」単位なので、日本語の途中に英単語（GUM・CE など）が
 * 入ると、その前後の日本語全体が 1 単語扱いになって不自然な位置で改行される。ここでは
 * - 日本語は 1 文字ずつ、英数字の連なりはひとかたまりで折り返す
 * - 行頭禁則（、。！？」ー ゃ っ など）は前の行にぶら下げて同じ行に収める
 * - 行末禁則（「（ など）は次の行へ送る
 * を行う。計測関数を差し替えられるので Phaser なしでテストできる。
 */

/** 行頭に来てはいけない文字（句読点・閉じ括弧・長音・小書き仮名など） */
const NO_LINE_START = new Set(
  Array.from("、。，．,.・：:；;？?！!‼⁉ー～…‥）)」』】〕］]｝}〉》〟’”%％ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々〻ゝゞヽヾ"),
);
/** 行末に来てはいけない文字（開き括弧） */
const NO_LINE_END = new Set(Array.from("（(「『【〔［[｛{〈《〝‘“"));

/** 折り返しの単位: 英数字の連なり / 空白の連なり / それ以外は 1 文字 */
const TOKEN = /[A-Za-z0-9][A-Za-z0-9_'’\-+./:#&@]*|\s+|./gu;

export function tokenize(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

export function wrapJa(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    const push = () => {
      out.push(line.replace(/\s+$/u, ""));
      line = "";
    };
    for (const token of tokenize(para)) {
      if (measure(line + token) <= maxWidth || line === "") {
        // 1 語だけで幅を超える英単語は文字単位で割る
        if (line === "" && measure(token) > maxWidth && token.length > 1 && !/^\s+$/u.test(token)) {
          for (const ch of Array.from(token)) {
            if (line !== "" && measure(line + ch) > maxWidth) push();
            line += ch;
          }
          continue;
        }
        if (line === "" && /^\s+$/u.test(token)) continue; // 行頭の空白は捨てる
        line += token;
        continue;
      }
      if (/^\s+$/u.test(token)) {
        push();
        continue;
      }
      // 行頭禁則: 句読点などは前の行にぶら下げる
      if (NO_LINE_START.has(Array.from(token)[0])) {
        line += token;
        continue;
      }
      // 行末禁則: 開き括弧は次の行へ送る
      let carry = "";
      while (line.length > 0 && NO_LINE_END.has(line[line.length - 1])) {
        carry = line[line.length - 1] + carry;
        line = line.slice(0, -1);
      }
      if (line === "") {
        line = carry + token;
        continue;
      }
      push();
      line = carry + token;
    }
    push();
  }
  return out;
}

/**
 * Phaser の TextStyle.wordWrap に渡す設定。
 * `{ ...textStyle(20), wordWrap: jaWrap(400) }` のように使う。
 */
export function jaWrap(width: number): {
  width: number;
  callback: (text: string, obj: { context: CanvasRenderingContext2D }) => string[];
} {
  return {
    width,
    callback: (text, obj) => wrapJa(text, width, (s) => obj.context.measureText(s).width),
  };
}
