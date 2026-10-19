import type { CatalogItem } from "@/lib/types";

export const DESKTOP_BENTO_DROP_ID = "bento-drop-desktop";
export const MOBILE_BENTO_DROP_ID = "bento-drop-mobile";

export const TOUCH_DRAG_DELAY_MS = 300;
export const TOUCH_DRAG_TOLERANCE_PX = 10;
export const TOUCH_PRESS_FEEDBACK_MS = 180;

export interface MenuDragData {
  item: CatalogItem;
}
