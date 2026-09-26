import Phaser from "phaser";
import { SPEAKER_NAME, type DialogLine, type Speaker } from "../../data/dialogs";
import { playSe } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH } from "../layout";
import { COLORS, textStyle } from "./theme";
import { jaWrap } from "./jaWrap";

/** 立ち絵の表示設定（アニメーションは BootScene で登録） */
const PORTRAIT: Record<Speaker, { texture: string; idle: string; speak: string; scale: number }> = {
  navi: { texture: "chara.navi_ain_11_idle", idle: "navi.idle", speak: "navi.speak", scale: 2 },
  chris: { texture: "chara.chris_09_idle", idle: "chris.idle", speak: "chris.speak", scale: 1.7 },
  maycri: { texture: "chara.maycri_04_eyes_blank", idle: "maycri.idle", speak: "maycri.idle", scale: 2.4 },
};

const BOX = { x: 24, y: 1024, w: GAME_WIDTH - 48, h: 232 };
const CHAR_MS = 28;
const DEPTH = 500;

/**
 * SPEC-108a: 会話を再生する。タップで「文字送りを完了 → 次の行」。すべて終わると resolve。
 * 再生中は画面全体の入力を受け止め、下のオブジェクトには届かない。
 */
export function playDialog(scene: Phaser.Scene, lines: DialogLine[]): Promise<void> {
  return new Promise((resolve) => {
    if (lines.length === 0) return resolve();
    const objects: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(DEPTH);
      objects.push(o);
      return o;
    };

    const blocker = add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.35).setOrigin(0).setInteractive());
    const portrait = add(scene.add.sprite(130, BOX.y + 24, PORTRAIT[lines[0].speaker].texture).setOrigin(0.5, 1));
    const box = add(scene.add.graphics());
    box.fillStyle(COLORS.bg, 0.95).fillRoundedRect(BOX.x, BOX.y, BOX.w, BOX.h, 20);
    box.lineStyle(3, COLORS.gold, 0.85).strokeRoundedRect(BOX.x, BOX.y, BOX.w, BOX.h, 20);
    const nameTag = add(
      scene.add
        .text(BOX.x + 220, BOX.y - 4, "", { ...textStyle(22, { color: COLORS.bg }), backgroundColor: "#f5c542", padding: { x: 14, y: 6 } })
        .setOrigin(0, 1),
    );
    const body = add(
      scene.add.text(BOX.x + 28, BOX.y + 26, "", { ...textStyle(26, { weight: 500 }), wordWrap: jaWrap(BOX.w - 56), lineSpacing: 8 }),
    );
    const next = add(scene.add.text(BOX.x + BOX.w - 30, BOX.y + BOX.h - 22, "▼", textStyle(22, { color: COLORS.gold })).setOrigin(0.5));
    scene.tweens.add({ targets: next, y: next.y + 6, duration: 400, yoyo: true, repeat: -1 });

    let index = -1;
    let shown = 0;
    let full = "";
    let timer: Phaser.Time.TimerEvent | undefined;

    const finishLine = () => {
      timer?.remove();
      timer = undefined;
      shown = full.length;
      body.setText(full);
      next.setVisible(true);
      const p = PORTRAIT[lines[index].speaker];
      portrait.play(p.idle, true);
    };

    const showLine = (i: number) => {
      index = i;
      const line = lines[i];
      const p = PORTRAIT[line.speaker];
      portrait.setScale(p.scale).play(p.speak, true);
      nameTag.setText(SPEAKER_NAME[line.speaker]);
      // 全文で折り返し位置を先に決め、1 文字ずつ出しても行が途中で組み変わらないようにする
      full = body.runWordWrap(line.text);
      shown = 0;
      body.setText("");
      next.setVisible(false);
      timer = scene.time.addEvent({
        delay: CHAR_MS,
        repeat: full.length - 1,
        callback: () => {
          shown += 1;
          body.setText(full.slice(0, shown));
          if (shown >= full.length) finishLine();
        },
      });
    };

    blocker.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (shown < full.length) return finishLine();
      playSe(scene, "se.buff");
      if (index + 1 < lines.length) return showLine(index + 1);
      timer?.remove();
      for (const o of objects) o.destroy();
      resolve();
    });

    showLine(0);
  });
}

/** 立ち絵つきの吹き出し（非モーダル。ステージ選択やリザルトの一言用） */
export function speechBubble(
  scene: Phaser.Scene,
  speaker: Speaker,
  x: number,
  bottomY: number,
  text: string,
  opts: { width?: number; depth?: number } = {},
): Phaser.GameObjects.Container {
  const p = PORTRAIT[speaker];
  const width = opts.width ?? 440;
  const sprite = scene.add.sprite(0, 0, p.texture).setOrigin(0.5, 1).setScale(p.scale).play(p.idle);
  const body = scene.add.text(0, 0, text, { ...textStyle(22, { weight: 500, color: COLORS.bg }), wordWrap: jaWrap(width - 40), lineSpacing: 4 });
  const bw = width;
  const bh = body.height + 32;
  const bx = sprite.displayWidth / 2 + 24;
  const by = -sprite.displayHeight * 0.75 - bh / 2;
  body.setPosition(bx + 20, by - bh / 2 + 16);
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.96).fillRoundedRect(bx, by - bh / 2, bw, bh, 16);
  g.fillTriangle(bx + 2, by + bh / 2 - 34, bx - 20, by + bh / 2 - 6, bx + 2, by + bh / 2 - 12);
  const c = scene.add.container(x, bottomY, [sprite, g, body]).setDepth(opts.depth ?? 50);
  return c;
}
