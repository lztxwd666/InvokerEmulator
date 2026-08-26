import type { ElementKind, GameConfig, InvokerState, ItemId, SpellId } from "./types";
import { CATACLYSM_META, INVOKE, ITEM_BY_ID, ITEMS, SPELL_BY_ID, VALUES, valueAt, spellFromOrbs } from "./spellData";

/** 卡尔官方基础属性与成长。 */
const BASE_STATS = {
  strength: 19,
  strengthGain: 2.5,
  agility: 14,
  agilityGain: 2.0,
  intelligence: 22,
  intelligenceGain: 4.0,
};

export const DEFAULT_CONFIG: GameConfig = {
  configVersion: 3,
  heroLevel: 12,
  orbLevels: { quas: 7, wex: 7, exort: 7 },
  initialOrbs: [],
  dummyMaxHp: 2000,
  dummyMaxMana: 1000,
  keybindMode: "qwer",
  itemKeys: {
    refresher: "5",
    sheepstick: "Z",
    meteor_hammer: "X",
    travel_boots: "C",
  },
  castMode: "mouse",
  comboMode: "preload",
  infiniteMana: false,
  muted: false,
  aghanimsScepter: false,
};

/** 计算英雄属性。Quas/Wex/Exort 分别提供力量/敏捷/智力加成。 */
export function computeAttributes(config: GameConfig) {
  const level = Math.max(1, config.heroLevel);
  const strength =
    BASE_STATS.strength +
    BASE_STATS.strengthGain * (level - 1) +
    config.orbLevels.quas;
  const agility =
    BASE_STATS.agility +
    BASE_STATS.agilityGain * (level - 1) +
    config.orbLevels.wex;
  const intelligence =
    BASE_STATS.intelligence +
    BASE_STATS.intelligenceGain * (level - 1) +
    config.orbLevels.exort;
  const maxHp = 120 + strength * 22;
  const maxMana = 75 + intelligence * 12;
  return { strength, agility, intelligence, maxHp, maxMana };
}

/** Invoke 冷却只由元素总等级决定。 */
export function invokeCooldown(orbLevels: Record<ElementKind, number>): number {
  const total = orbLevels.quas + orbLevels.wex + orbLevels.exort;
  return Math.max(0, INVOKE.baseCooldown - total * INVOKE.reductionPerOrbLevel);
}

export function createInitialState(config: GameConfig = DEFAULT_CONFIG): InvokerState {
  const spellCooldowns = Object.fromEntries(
    Object.values(SPELL_BY_ID).map((s) => [s.id, 0]),
  ) as Record<SpellId, number>;
  const itemCooldowns = Object.fromEntries(
    ITEMS.map((i) => [i.id, 0]),
  ) as Record<ItemId, number>;
  const attr = computeAttributes(config);
  return {
    orbs: [...config.initialOrbs].slice(0, 3),
    orbLevels: { ...config.orbLevels },
    heroLevel: config.heroLevel,
    invokedSlots: [null, null],
    spellCooldowns,
    itemCooldowns,
    invokeCooldown: 0,
    mana: attr.maxMana,
    maxMana: attr.maxMana,
    hp: attr.maxHp,
    maxHp: attr.maxHp,
    infiniteMana: config.infiniteMana,
    aghanimsScepter: config.aghanimsScepter,
    cataclysmCooldown: 0,
    dummy: {
      hp: config.dummyMaxHp,
      maxHp: config.dummyMaxHp,
      mana: config.dummyMaxMana,
      maxMana: config.dummyMaxMana,
    },
  };
}

export interface ActionResult {
  state: InvokerState;
  event?: string;
  damage?: number;
}

function clone(state: InvokerState): InvokerState {
  return structuredClone(state);
}

type Lang = "zh" | "en";

const ELEMENT_NAMES: Record<ElementKind, { zh: string; en: string }> = {
  quas: { zh: "冰", en: "Quas" },
  wex: { zh: "雷", en: "Wex" },
  exort: { zh: "火", en: "Exort" },
};

function spellName(spell: SpellId, lang: Lang): string {
  const meta = SPELL_BY_ID[spell];
  return lang === "zh" ? meta.nameCn : meta.name;
}

/** 释放一个元素球；超过三个时替换最旧的球。 */
export function castElement(state: InvokerState, element: ElementKind, lang: Lang = "zh"): ActionResult {
  const next = clone(state);
  if (next.orbs.length < 3) {
    next.orbs = [...next.orbs, element];
  } else {
    next.orbs = [next.orbs[1], next.orbs[2], element];
  }
  return {
    state: next,
    event: `${lang === "zh" ? "切换" : "Switch"} ${ELEMENT_NAMES[element][lang]}`,
  };
}

/** 执行 Invoke：根据当前三球生成技能到 D 槽，已有技能则仅交换。 */
export function invoke(state: InvokerState, lang: Lang = "zh"): ActionResult {
  const spell = spellFromOrbs(state.orbs);
  if (!spell || state.orbs.length !== 3) {
    return { state: clone(state), event: lang === "zh" ? "当前球数不足，无法祈唤" : "Not enough orbs to invoke" };
  }
  if (state.invokeCooldown > 0) {
    return { state: clone(state), event: lang === "zh" ? "元素祈唤冷却中" : "Invoke is on cooldown" };
  }

  const next = clone(state);
  const slotIndex = next.invokedSlots.indexOf(spell);

  if (slotIndex >= 0) {
    if (slotIndex === 1) {
      next.invokedSlots = [spell, next.invokedSlots[0]];
    }
    return { state: next, event: `${lang === "zh" ? "重新祈唤" : "Re-invoked"} ${spellName(spell, lang)}` };
  }

  next.invokedSlots = [spell, next.invokedSlots[0]];
  next.invokeCooldown = invokeCooldown(next.orbLevels);

  return {
    state: next,
    event: `${lang === "zh" ? "祈唤" : "Invoked"} ${spellName(spell, lang)}`,
  };
}

/** 释放已祈唤技能。数值按官方 datafeed 对 0 抗性假人结算。 */
export function castSpell(state: InvokerState, spell: SpellId, lang: Lang = "zh"): ActionResult {
  const meta = SPELL_BY_ID[spell];
  const next = clone(state);

  if (!next.invokedSlots.includes(spell)) {
    return { state: next, event: lang === "zh" ? "该技能尚未祈唤" : "Spell is not invoked" };
  }
  if (next.spellCooldowns[spell] > 0) {
    return { state: next, event: `${spellName(spell, lang)} ${lang === "zh" ? "冷却中" : "is on cooldown"}` };
  }
  if (next.mana < meta.manaCost) {
    return { state: next, event: lang === "zh" ? "魔法不足" : "Not enough mana" };
  }

  if (!next.infiniteMana) {
    next.mana -= meta.manaCost;
  }
  next.spellCooldowns[spell] = meta.cooldown;

  let damage = 0;
  let event = `${lang === "zh" ? "释放" : "Cast"} ${spellName(spell, lang)}`;

  switch (spell) {
    case "invoker_cold_snap": {
      damage = valueAt(VALUES.coldSnap.freezeDamage, next.orbLevels.quas);
      break;
    }
    case "invoker_emp": {
      const burned = Math.min(
        next.dummy.mana,
        valueAt(VALUES.emp.manaBurned, next.orbLevels.wex),
      );
      next.dummy.mana -= burned;
      damage = Math.round(burned * (VALUES.emp.damagePerManaPercent / 100));
      next.mana = Math.min(next.maxMana, next.mana + Math.round(burned * 0.25));
      break;
    }
    case "invoker_tornado": {
      damage =
        VALUES.tornado.baseDamage +
        valueAt(VALUES.tornado.wexDamage, next.orbLevels.wex);
      break;
    }
    case "invoker_chaos_meteor": {
      const main = valueAt(VALUES.chaosMeteor.mainDamage, next.orbLevels.exort);
      const burn = valueAt(VALUES.chaosMeteor.burnDps, next.orbLevels.exort);
      damage = main * 3 + burn * VALUES.chaosMeteor.burnDuration;
      break;
    }
    case "invoker_sun_strike": {
      damage = valueAt(VALUES.sunStrike.damage, next.orbLevels.exort);
      break;
    }
    case "invoker_ice_wall": {
      const dps = valueAt(VALUES.iceWall.damagePerSecond, next.orbLevels.exort);
      const duration = valueAt(VALUES.iceWall.duration, next.orbLevels.quas);
      damage = Math.round(dps * duration);
      break;
    }
    case "invoker_deafening_blast": {
      damage = valueAt(VALUES.deafeningBlast.damage, next.orbLevels.exort);
      break;
    }
    default:
      break;
  }

  if (damage > 0) {
    next.dummy.hp = Math.max(0, next.dummy.hp - damage);
    next.dummy.lastHit = `${spellName(spell, lang)}: -${damage}`;
    event += lang === "zh" ? `，造成 ${damage} 伤害` : `, dealt ${damage} damage`;
  }

  return { state: next, event, damage };
}

/** 使用物品。数值来自官方 itemdata。 */
export function useItem(state: InvokerState, item: ItemId, lang: Lang = "zh"): ActionResult {
  const meta = ITEM_BY_ID[item];
  const next = clone(state);
  const itemName = lang === "zh" ? meta.nameZh : meta.nameEn;

  if (next.itemCooldowns[item] > 0) {
    return { state: next, event: `${itemName} ${lang === "zh" ? "冷却中" : "is on cooldown"}` };
  }
  if (!next.infiniteMana && next.mana < meta.manaCost) {
    return { state: next, event: lang === "zh" ? "魔法不足" : "Not enough mana" };
  }

  if (!next.infiniteMana) {
    next.mana -= meta.manaCost;
  }
  next.itemCooldowns[item] = meta.cooldown;

  let event = `${lang === "zh" ? "使用" : "Use"} ${itemName}`;
  if (item === "refresher") {
    for (const key of Object.keys(next.spellCooldowns) as SpellId[]) {
      next.spellCooldowns[key] = 0;
    }
    next.invokeCooldown = 0;
    next.cataclysmCooldown = 0;
    event += lang === "zh" ? "，技能冷却已重置" : ", cooldowns reset";
  } else if (item === "meteor_hammer") {
    const damage = 130 + 50 * 6;
    next.dummy.hp = Math.max(0, next.dummy.hp - damage);
    next.dummy.lastHit = `${itemName}: -${damage}`;
    event += lang === "zh" ? `，造成 ${damage} 伤害` : `, dealt ${damage} damage`;
  } else if (item === "sheepstick") {
    next.dummy.lastHit = lang === "zh" ? "邪恶镰刀：妖术" : "Scythe of Vyse: Hex";
  } else if (item === "travel_boots") {
    event = lang === "zh" ? "远行鞋传送至假人" : "Boots of Travel teleported to dummy";
  }

  return { state: next, event };
}

/** 切换阿哈利姆神杖的开启状态。神杖不是消耗型物品，而是开关。 */
export function toggleAghanims(state: InvokerState, lang: Lang = "zh"): ActionResult {
  const next = clone(state);
  next.aghanimsScepter = !next.aghanimsScepter;
  return {
    state: next,
    event: next.aghanimsScepter
      ? lang === "zh" ? "阿哈利姆神杖已开启，天火强化为毁天灭地" : "Aghanim's Scepter enabled: Sun Strike enhanced to Cataclysm"
      : lang === "zh" ? "阿哈利姆神杖已关闭" : "Aghanim's Scepter disabled",
  };
}

/** 释放毁天灭地：阿哈利姆神杖强化后的天火，使用独立冷却。 */
export function castCataclysm(state: InvokerState, lang: Lang = "zh"): ActionResult {
  const next = clone(state);
  const spell = "invoker_sun_strike" as SpellId;
  const meta = CATACLYSM_META;

  if (!next.aghanimsScepter) {
    return { state: next, event: lang === "zh" ? "需要开启阿哈利姆神杖" : "Aghanim's Scepter is required" };
  }
  if (!next.invokedSlots.includes(spell)) {
    return { state: next, event: lang === "zh" ? "该技能尚未祈唤" : "Spell is not invoked" };
  }
  if (next.cataclysmCooldown > 0) {
    return { state: next, event: `${meta.nameCn} ${lang === "zh" ? "冷却中" : "is on cooldown"}` };
  }
  if (!next.infiniteMana && next.mana < meta.manaCost) {
    return { state: next, event: lang === "zh" ? "魔法不足" : "Not enough mana" };
  }

  if (!next.infiniteMana) {
    next.mana -= meta.manaCost;
  }
  next.cataclysmCooldown = meta.cooldown;

  const base = valueAt(VALUES.sunStrike.damage, next.orbLevels.exort);
  const damage = Math.round(base * 0.75 * 2);
  next.dummy.hp = Math.max(0, next.dummy.hp - damage);
  next.dummy.lastHit = `${meta.nameCn}: -${damage}`;

  return {
    state: next,
    damage,
    event: `${lang === "zh" ? "释放" : "Cast"} ${meta.nameCn}${lang === "zh" ? `，造成 ${damage} 伤害` : `, dealt ${damage} damage`}`,
  };
}

/** 推进冷却。dt 单位为秒。 */
export function tick(state: InvokerState, dt: number): InvokerState {
  const next = clone(state);
  next.invokeCooldown = Math.max(0, next.invokeCooldown - dt);
  for (const key of Object.keys(next.spellCooldowns) as SpellId[]) {
    next.spellCooldowns[key] = Math.max(0, next.spellCooldowns[key] - dt);
  }
  for (const key of Object.keys(next.itemCooldowns) as ItemId[]) {
    next.itemCooldowns[key] = Math.max(0, next.itemCooldowns[key] - dt);
  }
  next.cataclysmCooldown = Math.max(0, next.cataclysmCooldown - dt);
  return next;
}

/** 重置假人生命和魔法。 */
export function resetDummy(state: InvokerState): InvokerState {
  const next = clone(state);
  next.dummy = {
    hp: next.dummy.maxHp,
    maxHp: next.dummy.maxHp,
    mana: next.dummy.maxMana,
    maxMana: next.dummy.maxMana,
  };
  return next;
}

/** 按新配置重建状态。 */
export function applyConfig(state: InvokerState, config: GameConfig): InvokerState {
  const next = createInitialState(config);
  next.orbs = [...state.orbs].slice(0, 3);
  return next;
}
