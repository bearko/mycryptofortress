/**
 * SPEC-003 でマップ表現が `MapDef` ベースに変わったので、本ファイルは互換のための
 * 再エクスポートに縮退している（古い import 経路を温存するため）。
 * 新規コードは `./map` から直接 import してほしい。
 */
export {
  TILE_SIZE,
  STAGE1_MAP,
  STAGE1_WAVE,
  tileToPixel,
  pixelToTile,
  tileTypeAt,
  findRoute,
  routeProgress,
  distanceToGoal,
  placementTileFor,
  blockMaxFor,
  canPlaceClassOnTile,
} from "./map";

import { STAGE1_MAP } from "./map";

export const COLS = STAGE1_MAP.cols;
export const ROWS = STAGE1_MAP.rows;
