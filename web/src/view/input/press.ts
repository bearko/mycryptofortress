import Phaser from "phaser";
import { PressDetector, type PressConfig } from "./pressDetector";

export interface PressHandlers {
  onTap?: (pointer: Phaser.Input.Pointer) => void;
  onLongPress?: (pointer: Phaser.Input.Pointer) => void;
  /** 押下開始 / 終了（見た目の押し込み表現用） */
  onPressChange?: (pressed: boolean) => void;
}

/**
 * SPEC-101 §5.4: インタラクティブな GameObject に tap / longpress を付与する。
 * 押下開始はオブジェクト上、移動と離しはシーン全体で追跡する（指がはみ出しても判定が壊れない）。
 */
export function bindPress(
  obj: Phaser.GameObjects.GameObject,
  handlers: PressHandlers,
  config?: PressConfig,
): void {
  const scene = obj.scene;
  const det = new PressDetector(config);
  let active: Phaser.Input.Pointer | null = null;

  const release = () => {
    if (active) handlers.onPressChange?.(false);
    active = null;
  };

  obj.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
    active = p;
    det.down(p.x, p.y, scene.time.now);
    handlers.onPressChange?.(true);
  });

  const onMove = (p: Phaser.Input.Pointer) => {
    if (p !== active) return;
    det.move(p.x, p.y);
    if (!det.isPressing) release();
  };
  const onUp = (p: Phaser.Input.Pointer) => {
    if (p !== active) return;
    const r = det.up(p.x, p.y, scene.time.now);
    release();
    if (r === "tap") handlers.onTap?.(p);
  };
  const onUpdate = (time: number) => {
    if (!active) return;
    if (det.tick(time) === "longpress") {
      const p = active;
      handlers.onLongPress?.(p);
    }
  };

  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
  scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
  scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

  obj.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
    scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
    scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
  });
}
