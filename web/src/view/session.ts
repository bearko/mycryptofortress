import { SaveStore, type SaveData, type SlotId } from "../meta/save";
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
    this.data = this.store.loadOrCreate(this.slot);
  }

  update(fn: (d: SaveData) => SaveData): void {
    this.data = this.store.save(this.slot, fn(this.data));
  }
}

export const session = new Session();
