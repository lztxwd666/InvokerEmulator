import type { ElementKind, GameConfig, ItemId, KeybindMode } from "./types";
import { ITEMS, LEGACY_CAST_KEYS } from "./spellData";
import { DEFAULT_CONFIG, normalizeOrbLevels } from "./invoker";

const ELEMENTS: ElementKind[] = ["quas", "wex", "exort"];
const ITEM_KEY_POOL = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Z", "X", "C", "V", "B", "N", "M", "G", "H", "J", "K", "L"];

function reservedKeys(keybindMode: KeybindMode): string[] {
  return keybindMode === "legacy"
    ? ["Q", "W", "E", "R", ...Object.values(LEGACY_CAST_KEYS)]
    : ["Q", "W", "E", "R", "D", "F"];
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return fallback;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function validElementArray(value: unknown): ElementKind[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<ElementKind>(ELEMENTS);
  return value.filter((item): item is ElementKind => valid.has(item as ElementKind)).slice(0, 3);
}

/** 将用户输入的物品快捷键规范化为统一格式。支持单字符键和鼠标侧键。 */
export function normalizeItemHotkey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (/^(MOUSE|MB|SIDE)[345]$/.test(upper)) {
    return `MOUSE${upper.slice(-1)}`;
  }
  if (/^M[345]$/.test(upper)) {
    return `MOUSE${upper.slice(1)}`;
  }
  const xButton = upper.match(/^X(?:BUTTON|BTN|B)?([12])$/);
  if (xButton) {
    return xButton[1] === "1" ? "MOUSE4" : "MOUSE5";
  }
  if (trimmed.length === 1) {
    return trimmed.toUpperCase();
  }
  return "";
}

/** 规范化物品快捷键：支持单字符、鼠标侧键、避开技能键且物品间不重复。 */
export function sanitizeItemKeys(
  input: Partial<Record<ItemId, string>> | Record<ItemId, string> | null | undefined,
  keybindMode: KeybindMode,
): Record<ItemId, string> {
  const result = { ...DEFAULT_CONFIG.itemKeys };
  const reserved = new Set(reservedKeys(keybindMode));
  const used = new Set<string>();

  const fallbackFor = (item: ItemId): string => {
    if (item === "refresher") return "5";
    if (item === "sheepstick") return keybindMode === "legacy" ? "1" : "Z";
    if (item === "meteor_hammer") return keybindMode === "legacy" ? "2" : "X";
    return keybindMode === "legacy" ? "3" : "C";
  };

  for (const item of ITEMS) {
    const raw = typeof input?.[item.id] === "string" ? input[item.id]!.trim() : "";
    const validRaw = normalizeItemHotkey(raw);
    let value = validRaw && !reserved.has(validRaw) && !used.has(validRaw) ? validRaw : "";

    if (!value) {
      const fallback = fallbackFor(item.id);
      if (!reserved.has(fallback) && !used.has(fallback)) {
        value = fallback;
      }
    }

    if (!value || reserved.has(value) || used.has(value)) {
      const free = ITEM_KEY_POOL.find((key) => !reserved.has(key) && !used.has(key));
      value = free ?? fallbackFor(item.id);
    }

    result[item.id] = value;
    used.add(value);
  }

  return result;
}

function defaultConfigCopy(): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    orbLevels: { ...DEFAULT_CONFIG.orbLevels },
    itemKeys: { ...DEFAULT_CONFIG.itemKeys },
    initialOrbs: [...DEFAULT_CONFIG.initialOrbs],
  };
}

function sanitizeLevelingPlan(
  value: unknown,
): Partial<Record<number, Record<ElementKind, number>>> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const result: Partial<Record<number, Record<ElementKind, number>>> = {};
  for (const key of Object.keys(input)) {
    const heroLevel = Number(key);
    if (!Number.isFinite(heroLevel) || heroLevel < 1 || heroLevel > 30) continue;
    const entry = input[key] as Partial<Record<ElementKind, number>> | undefined;
    if (!entry || typeof entry !== "object") continue;
    result[heroLevel] = {
      quas: finiteNumber(entry.quas, 0, 0, 8),
      wex: finiteNumber(entry.wex, 0, 0, 8),
      exort: finiteNumber(entry.exort, 0, 0, 8),
    };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** 从持久化数据安全地构造完整训练配置，避免损坏数据导致运行时错误。 */
export function normalizeConfig(parsed: unknown): GameConfig {
  if (!parsed || typeof parsed !== "object") return defaultConfigCopy();

  const p = parsed as Partial<GameConfig>;
  if (
    p.heroLevel !== undefined &&
    (typeof p.heroLevel !== "number" ||
      !Number.isFinite(p.heroLevel) ||
      p.heroLevel < 1 ||
      p.heroLevel > 30)
  ) {
    return { ...defaultConfigCopy(), heroLevel: 30 };
  }
  const keybindMode: KeybindMode = p.keybindMode === "legacy" ? "legacy" : "qwer";
  const heroLevel = finiteNumber(p.heroLevel, DEFAULT_CONFIG.heroLevel, 1, 30);
  const aghanimsScepter = typeof p.aghanimsScepter === "boolean" ? p.aghanimsScepter : DEFAULT_CONFIG.aghanimsScepter;
  const aghsOrb: ElementKind =
    p.aghsOrb === "quas" || p.aghsOrb === "wex" || p.aghsOrb === "exort" ? p.aghsOrb : DEFAULT_CONFIG.aghsOrb;
  const orbLevels = normalizeOrbLevels(
    {
      quas: finiteNumber(p.orbLevels?.quas, 0, 0, 9),
      wex: finiteNumber(p.orbLevels?.wex, 0, 0, 9),
      exort: finiteNumber(p.orbLevels?.exort, 0, 0, 9),
    },
    { heroLevel, aghanimsScepter, aghsOrb },
  );

  return {
    configVersion: DEFAULT_CONFIG.configVersion,
    heroLevel,
    aghsOrb,
    orbLevels,
    levelingPlan: sanitizeLevelingPlan(p.levelingPlan),
    initialOrbs: validElementArray(p.initialOrbs),
    dummyMaxHp: finiteNumber(p.dummyMaxHp, DEFAULT_CONFIG.dummyMaxHp, 1, Number.MAX_SAFE_INTEGER),
    dummyMaxMana: finiteNumber(p.dummyMaxMana, DEFAULT_CONFIG.dummyMaxMana, 0, Number.MAX_SAFE_INTEGER),
    keybindMode,
    itemKeys: sanitizeItemKeys(p.itemKeys, keybindMode),
    castMode: p.castMode === "instant" || p.castMode === "mouse" ? p.castMode : DEFAULT_CONFIG.castMode,
    comboMode: p.comboMode === "instant" || p.comboMode === "preload" ? p.comboMode : DEFAULT_CONFIG.comboMode,
    quickcastModifier: p.quickcastModifier === "Ctrl" || p.quickcastModifier === "Shift" ? p.quickcastModifier : "Alt",
    randomBubbleInterval: finiteNumber(p.randomBubbleInterval, DEFAULT_CONFIG.randomBubbleInterval, 0.3, 10),
    randomBubbleDuration: finiteNumber(p.randomBubbleDuration, DEFAULT_CONFIG.randomBubbleDuration, 0.5, 10),
    randomMaxBubbles: finiteNumber(p.randomMaxBubbles, DEFAULT_CONFIG.randomMaxBubbles, 1, 10),
    infiniteMana: typeof p.infiniteMana === "boolean" ? p.infiniteMana : DEFAULT_CONFIG.infiniteMana,
    muted: typeof p.muted === "boolean" ? p.muted : DEFAULT_CONFIG.muted,
    aghanimsScepter,
  };
}
