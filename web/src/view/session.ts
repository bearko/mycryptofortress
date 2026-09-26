import { SaveStore, type SaveData, type SlotId } from "../meta/save";
import { syncTreeVersion } from "../meta/progress";
import { getBrowserStorage } from "../meta/storage";

/** 現在のセーブスロットと内容を保持し、変更を即時保存する（SPEC-101 §5.5）。 */
class Session {
  readonly store: SaveStore;
  /** false の場合 localStorage が使えず、リロードで消える */
  readonly persistent: boolean;
  slot: SlotId;
  data: SaveData;

  constructor() {
    const { storage, persistent } = getBrowserStorage();
    this.store = new SaveStore(storage);
    this.persistent = persistent;
    this.slot = this.store.getActiveSlot();
    // SPEC-108 §1: ツリーの構成が変わっていたら全返金して保存し、ホームでお知らせする
    const loaded = this.store.loadOrCreate(this.slot);
    const synced = syncTreeVersion(loaded);
    this.data = synced.save === loaded ? loaded : this.store.save(this.slot, synced.save);
    if (synced.refunded) this.notice = "スキルツリーが新しくなったため、CE を全額返金しました";
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
}

export const session = new Session();
