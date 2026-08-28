import type { ElementKind } from "./types";

/** 默认 1-21 级加点方案：冰/雷/火 顺序。 */
export const DEFAULT_LEVELING_PLAN: Record<number, Record<ElementKind, number>> = {
  1: { quas: 0, wex: 0, exort: 1 },
  2: { quas: 1, wex: 0, exort: 1 },
  3: { quas: 1, wex: 0, exort: 2 },
  4: { quas: 2, wex: 0, exort: 2 },
  5: { quas: 2, wex: 0, exort: 3 },
  6: { quas: 3, wex: 1, exort: 3 },
  7: { quas: 3, wex: 1, exort: 4 },
  8: { quas: 4, wex: 1, exort: 4 },
  9: { quas: 4, wex: 1, exort: 5 },
  10: { quas: 4, wex: 2, exort: 5 },
  11: { quas: 4, wex: 2, exort: 6 },
  12: { quas: 4, wex: 4, exort: 6 },
  13: { quas: 4, wex: 4, exort: 7 },
  14: { quas: 4, wex: 5, exort: 7 },
  15: { quas: 4, wex: 5, exort: 8 },
  16: { quas: 4, wex: 6, exort: 8 },
  17: { quas: 4, wex: 7, exort: 8 },
  18: { quas: 5, wex: 8, exort: 8 },
  19: { quas: 6, wex: 8, exort: 8 },
  20: { quas: 7, wex: 8, exort: 8 },
  21: { quas: 8, wex: 8, exort: 8 },
};

/** 获取指定等级默认加点；大于等于 21 级按满级处理。 */
export function getDefaultOrbLevels(heroLevel: number): Record<ElementKind, number> {
  const level = Math.max(1, Math.min(30, Math.floor(heroLevel)));
  return {
    ...(DEFAULT_LEVELING_PLAN[Math.min(level, 21)] ?? DEFAULT_LEVELING_PLAN[21]),
  };
}
