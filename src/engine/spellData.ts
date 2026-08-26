import type { Combo, ComboAction, ElementKind, ItemId, SpellId } from "./types";

/** 技能基础元数据。中文名来自官方 schinese datafeed。 */
export interface SpellMeta {
  id: SpellId;
  name: string;
  nameCn: string;
  combination: ElementKind[];
  target: "unit" | "self" | "area" | "global_area" | "unit_ally";
  cooldown: number;
  manaCost: number;
  sound: string;
}

export const SPELLS: SpellMeta[] = [
  { id: "invoker_cold_snap", name: "Cold Snap", nameCn: "急速冷却", combination: ["quas", "quas", "quas"], target: "unit", cooldown: 18, manaCost: 100, sound: "Cold_Snap.mp3" },
  { id: "invoker_ghost_walk", name: "Ghost Walk", nameCn: "幽灵漫步", combination: ["quas", "quas", "wex"], target: "self", cooldown: 40, manaCost: 175, sound: "Ghost_Walk.mp3" },
  { id: "invoker_ice_wall", name: "Ice Wall", nameCn: "寒冰之墙", combination: ["quas", "quas", "exort"], target: "area", cooldown: 23, manaCost: 125, sound: "Ice_Wall.mp3" },
  { id: "invoker_emp", name: "E.M.P.", nameCn: "电磁脉冲", combination: ["wex", "wex", "wex"], target: "area", cooldown: 27, manaCost: 125, sound: "E.M.P..mp3" },
  { id: "invoker_tornado", name: "Tornado", nameCn: "强袭飓风", combination: ["quas", "wex", "wex"], target: "area", cooldown: 27, manaCost: 140, sound: "Tornado.mp3" },
  { id: "invoker_alacrity", name: "Alacrity", nameCn: "灵动迅捷", combination: ["wex", "wex", "exort"], target: "unit_ally", cooldown: 15, manaCost: 75, sound: "Alacrity.mp3" },
  { id: "invoker_chaos_meteor", name: "Chaos Meteor", nameCn: "混沌陨石", combination: ["exort", "exort", "wex"], target: "area", cooldown: 50, manaCost: 200, sound: "Chaos_Meteor.mp3" },
  { id: "invoker_sun_strike", name: "Sun Strike", nameCn: "阳炎冲击", combination: ["exort", "exort", "exort"], target: "global_area", cooldown: 23, manaCost: 175, sound: "Sun_Strike.mp3" },
  { id: "invoker_forge_spirit", name: "Forge Spirit", nameCn: "熔炉精灵", combination: ["quas", "exort", "exort"], target: "self", cooldown: 27, manaCost: 75, sound: "Forge_Spirit.mp3" },
  { id: "invoker_deafening_blast", name: "Deafening Blast", nameCn: "超震声波", combination: ["quas", "wex", "exort"], target: "area", cooldown: 36, manaCost: 250, sound: "Deafening_Blast.mp3" },
];

export const SPELL_BY_ID: Record<SpellId, SpellMeta> = Object.fromEntries(
  SPELLS.map((s) => [s.id, s]),
) as Record<SpellId, SpellMeta>;

/** Dota 1 传统键位：祈唤技能的固定施法键。 */
export const LEGACY_CAST_KEYS: Record<SpellId, string> = {
  invoker_cold_snap: "Y",
  invoker_ghost_walk: "V",
  invoker_ice_wall: "G",
  invoker_emp: "C",
  invoker_tornado: "X",
  invoker_alacrity: "Z",
  invoker_sun_strike: "T",
  invoker_forge_spirit: "F",
  invoker_chaos_meteor: "D",
  invoker_deafening_blast: "B",
};

/** 物品元数据。冷却和耗蓝来自官方 itemdata。 */
export interface ItemMeta {
  id: ItemId;
  nameZh: string;
  nameEn: string;
  image: string;
  sound: string;
  cooldown: number;
  manaCost: number;
  /** instant 不需要目标；target 普通施法需要点击假人；travel 支持双击或点击 */
  target: "instant" | "target" | "travel";
}

export const ITEMS: ItemMeta[] = [
  { id: "refresher", nameZh: "刷新球", nameEn: "Refresher Orb", image: "refresher.png", sound: "refresher.mp3", cooldown: 180, manaCost: 325, target: "instant" },
  { id: "sheepstick", nameZh: "邪恶镰刀", nameEn: "Scythe of Vyse", image: "sheepstick.png", sound: "sheepstick.mp3", cooldown: 20, manaCost: 250, target: "target" },
  { id: "meteor_hammer", nameZh: "陨星锤", nameEn: "Meteor Hammer", image: "meteor_hammer.png", sound: "meteor_hammer.mp3", cooldown: 24, manaCost: 75, target: "target" },
  { id: "travel_boots", nameZh: "远行鞋", nameEn: "Boots of Travel", image: "travel_boots.png", sound: "travel_boots.mp3", cooldown: 40, manaCost: 0, target: "travel" },
];

export const ITEM_BY_ID: Record<ItemId, ItemMeta> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
) as Record<ItemId, ItemMeta>;

/** Invoke 基础参数 */
export const INVOKE = {
  baseCooldown: 7,
  reductionPerOrbLevel: 0.3,
  maxSlots: 2,
};

/** 官方数值表：按元素等级取值，等级从 1 开始。 */
export const VALUES = {
  quas: {
    hpRegenPerInstance: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    strengthPerLevel: 1,
  },
  wex: {
    moveSpeedPerInstance: [0.6, 1.2, 1.8, 2.4, 3, 3.6, 4.2, 4.8, 5.4],
    attackSpeedPerInstance: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    agilityPerLevel: 1,
  },
  exort: {
    bonusDamagePerInstance: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    intelligencePerLevel: 1,
  },
  coldSnap: {
    duration: [3, 3.4, 3.8, 4.2, 4.6, 5, 5.4, 5.8, 6.2],
    freezeDamage: [28, 36, 44, 52, 60, 68, 76, 84, 92],
    freezeCooldown: [0.8, 0.77, 0.74, 0.71, 0.68, 0.65, 0.62, 0.59, 0.56],
  },
  ghostWalk: {
    duration: 50,
    radius: 450,
    enemySlow: [20, 25, 30, 35, 40, 45, 50, 55, 60],
    hpRegen: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    manaRegen: [2, 4, 6, 8, 10, 12, 14, 16, 18],
  },
  iceWall: {
    duration: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    slow: [30, 45, 60, 75, 90, 105, 120, 135, 150],
    damagePerSecond: [30, 36, 42, 48, 54, 60, 66, 72, 78],
  },
  emp: {
    delay: 2.9,
    radius: 675,
    manaBurned: [100, 175, 250, 325, 400, 475, 550, 625, 700],
    damagePerManaPercent: 60,
  },
  tornado: {
    travelDistance: [1500, 1800, 2100, 2400, 2700, 3000, 3300, 3600, 3900],
    liftDuration: [1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8],
    baseDamage: 50,
    wexDamage: [45, 90, 135, 180, 225, 270, 315, 360, 405],
  },
  alacrity: {
    bonusAttackSpeed: [10, 22, 34, 46, 58, 70, 82, 94, 106],
    bonusDamage: [10, 22, 34, 46, 58, 70, 82, 94, 106],
    duration: 9,
  },
  chaosMeteor: {
    travelDistance: [465, 615, 780, 930, 1095, 1245, 1410, 1575, 1725],
    mainDamage: [55, 75, 95, 115, 135, 155, 175, 195, 215],
    burnDps: [10, 15, 20, 25, 30, 35, 40, 45, 50],
    landTime: 1.3,
    burnDuration: 3,
  },
  sunStrike: {
    delay: 1.7,
    radius: 175,
    damage: [175, 225, 275, 325, 375, 425, 475, 525, 575],
  },
  forgeSpirit: {
    damage: [20, 30, 40, 50, 60, 70, 80, 90, 100],
    armor: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    attackRange: [305, 360, 415, 470, 525, 580, 635, 690, 745],
    hp: [300, 400, 500, 600, 700, 800, 900, 1000, 1100],
    duration: [24, 30, 36, 42, 48, 54, 60, 66, 72],
  },
  deafeningBlast: {
    damage: [70, 110, 150, 190, 230, 270, 310, 350, 390],
    knockbackDuration: [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9],
    disarmDuration: [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5],
  },
};

export function valueAt(values: number[], level: number): number {
  const idx = Math.max(0, Math.min(values.length - 1, level - 1));
  return values[idx];
}

/** 根据当前三个球识别祈唤技能。球顺序无关。 */
export function spellFromOrbs(orbs: ElementKind[]): SpellId | null {
  if (orbs.length !== 3) return null;
  const key = [...orbs].sort().join(",");
  const map: Record<string, SpellId> = {
    "exort,exort,exort": "invoker_sun_strike",
    "exort,exort,quas": "invoker_forge_spirit",
    "exort,quas,quas": "invoker_ice_wall",
    "exort,exort,wex": "invoker_chaos_meteor",
    "exort,wex,wex": "invoker_alacrity",
    "quas,quas,quas": "invoker_cold_snap",
    "quas,quas,wex": "invoker_ghost_walk",
    "quas,wex,wex": "invoker_tornado",
    "exort,quas,wex": "invoker_deafening_blast",
    "wex,wex,wex": "invoker_emp",
  };
  return map[key] ?? null;
}

/** 技能图标路径 */
export function spellImage(spell: SpellId | "invoker_quas" | "invoker_wex" | "invoker_exort" | "invoker_invoke"): string {
  return `images/abilities/${spell}.png`;
}

export function elementImage(element: ElementKind): string {
  return spellImage(element === "quas" ? "invoker_quas" : element === "wex" ? "invoker_wex" : "invoker_exort");
}

export function itemImage(item: string): string {
  return `images/items/${item}.png`;
}

function spell(step: SpellId): ComboAction {
  return { type: "spell", spell: step };
}

/** 内置常用连招。只保存技能顺序，实际按键由 planner 从当前球序计算。 */
export const DEFAULT_COMBOS: Combo[] = [
  {
    id: "combo_tornado_emp_meteor_blast",
    nameZh: "飓风 电磁脉冲 陨石 超震声波",
    nameEn: "Tornado EMP Meteor Blast",
    actions: [
      spell("invoker_tornado"),
      spell("invoker_emp"),
      spell("invoker_chaos_meteor"),
      spell("invoker_deafening_blast"),
    ],
  },
  {
    id: "combo_cold_snap_emp_tornado_meteor",
    nameZh: "急速冷却 电磁脉冲 飓风 陨石",
    nameEn: "Cold Snap EMP Tornado Meteor",
    actions: [
      spell("invoker_cold_snap"),
      spell("invoker_emp"),
      spell("invoker_tornado"),
      spell("invoker_chaos_meteor"),
    ],
  },
  {
    id: "combo_tornado_sun_strike_meteor_blast",
    nameZh: "飓风 阳炎冲击 陨石 超震声波",
    nameEn: "Tornado Sun Strike Meteor Blast",
    actions: [
      spell("invoker_tornado"),
      spell("invoker_sun_strike"),
      spell("invoker_chaos_meteor"),
      spell("invoker_deafening_blast"),
    ],
  },
  {
    id: "combo_blast_meteor_sun_strike_refresher",
    nameZh: "超震声波 陨石 刷新球 超震声波 陨石 阳炎冲击",
    nameEn: "Blast Meteor Refresher Blast Meteor Sun Strike",
    actions: [
      spell("invoker_deafening_blast"),
      spell("invoker_chaos_meteor"),
      { type: "item", item: "refresher" },
      spell("invoker_deafening_blast"),
      spell("invoker_chaos_meteor"),
      spell("invoker_sun_strike"),
    ],
  },
  {
    id: "combo_cold_snap_alacrity_forge_spirit_blast",
    nameZh: "急速冷却 灵动迅捷 熔炉精灵 超震声波",
    nameEn: "Cold Snap Alacrity Forge Spirit Blast",
    actions: [
      spell("invoker_cold_snap"),
      spell("invoker_alacrity"),
      spell("invoker_forge_spirit"),
      spell("invoker_deafening_blast"),
    ],
  },
  {
    id: "combo_ghost_walk_ice_wall_tornado",
    nameZh: "幽灵漫步 寒冰之墙 飓风",
    nameEn: "Ghost Walk Ice Wall Tornado",
    actions: [
      spell("invoker_ghost_walk"),
      spell("invoker_ice_wall"),
      spell("invoker_tornado"),
    ],
  },
  {
    id: "combo_sun_strike_emp_refresher",
    nameZh: "阳炎冲击 电磁脉冲 刷新球 阳炎冲击 电磁脉冲",
    nameEn: "Sun Strike EMP Refresher Sun Strike EMP",
    actions: [
      spell("invoker_sun_strike"),
      spell("invoker_emp"),
      { type: "item", item: "refresher" },
      spell("invoker_sun_strike"),
      spell("invoker_emp"),
    ],
  },
  {
    id: "combo_tornado_emp_refresher_meteor_blast",
    nameZh: "飓风 电磁脉冲 刷新球 飓风 电磁脉冲 陨石 超震声波",
    nameEn: "Tornado EMP Refresher Tornado EMP Meteor Blast",
    actions: [
      spell("invoker_tornado"),
      spell("invoker_emp"),
      { type: "item", item: "refresher" },
      spell("invoker_tornado"),
      spell("invoker_emp"),
      spell("invoker_chaos_meteor"),
      spell("invoker_deafening_blast"),
    ],
  },

];
