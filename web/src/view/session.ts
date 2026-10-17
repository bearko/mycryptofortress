import { RTA_SLOT, SaveStore, type SaveData, type SaveKey, type SlotId } from "../meta/save";
import { newRtaState, rtaSave, type RtaState } from "../meta/rta";
import { syncTreeVersion } from "../meta/progress";
import { getBrowserStorage } from "../meta/storage";

/** 現在のセーブスロットと内容を保持し、変更を即時保存する（SPEC-101 §5.5）。 */
class Session {
  readonly store: SaveStore;
  /** false の場合 localStorage が使えず、リロードで消える */
  readonly persistent: boolean;
  slot: SaveKey;
  data: SaveData;
  /** SPEC-123: RTA の計測中（メモリだけ。再読み込みすると消え、ふだんのセーブに戻る） */
  rta: RtaState | null = null;

  constructor() {
    const { storage, persistent } = getBrowserStorage();
    this.store = new SaveStore(storage);
    this.persistent = persistent;
    this.slot = this.store.getActiveSlot();
    // SPEC-108 §1: ツリーの構成が変わっていたら全返金して保存し、ホームでお知らせする
    const loaded = this.store.loadOrCreate(this.slot);
    const synced = syncTreeVersion(loaded);
    this.data = synced.save === loaded ? loaded : this.store.save(this.slot, synced.save);
    if (synced.refunded) this.notice = "スキルツリーが新しくなったため、CE とエンブレムを全額返金しました";
  }

  /** ホームで一度だけ表示するお知らせ */
  notice: string | null = null;

  takeNotice(): string | null {
    const n = this.notice;
    this.notice = null;
    return n;
  }

  update(fn: (d: SaveData) => SaveData): void {
    this.data = this.store.save(this.slot, fn(this.data));
  }

  /** SPEC-123: RTA 用の新しいセーブに切り替える（ふだんのセーブはそのまま残る） */
  beginRta(): void {
    const fresh = rtaSave(this.data);
    this.slot = RTA_SLOT;
    this.data = this.store.save(RTA_SLOT, fresh);
    this.rta = newRtaState();
  }

  /** 計測を終える（完走・中断）。セーブは RTA 用のまま。ホームに戻ったときに leaveRtaSave で戻す */
  endRta(): void {
    this.rta = null;
  }

  /** RTA 用のセーブからふだんのセーブに戻る */
  leaveRtaSave(): void {
    this.rta = null;
    if (this.slot !== RTA_SLOT) return;
    const slot: SlotId = this.store.getActiveSlot();
    this.slot = slot;
    this.data = this.store.loadOrCreate(slot);
  }

  get onRtaSave(): boolean {
    return this.slot === RTA_SLOT;
  }
}

export const session = new Session();
