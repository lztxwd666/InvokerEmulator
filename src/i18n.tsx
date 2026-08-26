import { createContext, useContext, useState, type ReactNode } from "react";
import type { ElementKind, SpellId } from "./engine/types";
import { SPELL_BY_ID } from "./engine/spellData";

export type Lang = "zh" | "en";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  elementName: (element: ElementKind) => string;
  spellName: (spell: SpellId) => string;
}

const STRINGS: Record<string, { zh: string; en: string }> = {
  "app.title": { zh: "卡尔练习器", en: "Invoker Emulator" },
  "app.reset": { zh: "重置", en: "Reset" },
  "app.dummyReset": { zh: "假人满状态", en: "Full Dummy State" },
  "app.settings": { zh: "设置", en: "Settings" },
  "app.free": { zh: "自由练习", en: "Free Practice" },
  "app.language": { zh: "EN", en: "中文" },
  "hud.invoke": { zh: "元素祈唤", en: "Invoke" },
  "hud.orbQueue": { zh: "当前元素球", en: "Active Orbs" },
  "hud.invoked": { zh: "已祈唤技能", en: "Invoked Spells" },
  "hud.mana": { zh: "魔法", en: "Mana" },
  "hud.hp": { zh: "生命", en: "Health" },
  "hud.dummyMana": { zh: "假人魔法", en: "Dummy Mana" },
  "hud.dummyHp": { zh: "假人生命", en: "Dummy HP" },
  "hud.dummy": { zh: "0 抗性假人", en: "0 Resistance Dummy" },
  "hud.wait": { zh: "等待操作", en: "Waiting for input" },
  "hud.heroStatus": { zh: "卡尔状态", en: "Invoker Status" },
  "hud.dummyStatus": { zh: "假人状态（0 抗性）", en: "Dummy Status (0 Resistance)" },
  "combo.title": { zh: "连招练习", en: "Combo Practice" },
  "combo.customTitle": { zh: "自定义连招", en: "Custom Combo" },
  "combo.customHint": { zh: "点击技能图标，按释放顺序组成连招", en: "Click spell icons in cast order to build a combo" },
  "combo.selected": { zh: "已选技能", en: "Selected spells" },
  "combo.clear": { zh: "清空", en: "Clear" },
  "combo.name": { zh: "连招名称", en: "Combo name" },
  "combo.save": { zh: "保存连招", en: "Save combo" },
  "combo.remove": { zh: "移除", en: "Remove" },
  "combo.refresher": { zh: "刷新球", en: "Refresher Orb" },
  "combo.optimal": { zh: "最优按键", en: "Optimal keys" },
  "combo.start": { zh: "开始", en: "Start" },
  "combo.progress": { zh: "步骤", en: "Step" },
  "settings.title": { zh: "训练设置", en: "Training Settings" },
  "settings.cardBasic": { zh: "英雄与元素等级", en: "Hero and Element Levels" },
  "settings.cardKeys": { zh: "键位设置", en: "Keybindings" },
  "settings.cardCastCombo": { zh: "施法与连招", en: "Casting and Combo" },
  "settings.cardDummy": { zh: "假人设置", en: "Dummy Settings" },
  "settings.keybindMode": { zh: "键位模式", en: "Keybind mode" },
  "settings.keybindQwer": { zh: "QWER / DF", en: "QWER / DF" },
  "settings.keybindLegacy": { zh: "Dota 1 传统键位", en: "Legacy keys" },
    "settings.itemKey": { zh: "物品快捷键", en: "Item hotkey" },
  "settings.itemKeys": { zh: "物品快捷键", en: "Item hotkeys" },
  "settings.muted": { zh: "静音", en: "Mute sounds" },
  "settings.recommended": { zh: "（推荐）", en: " (Recommended)" },
  "settings.itemKeyConflict": { zh: "存在冲突的物品快捷键，应用时会恢复该物品的默认键", en: "Conflicting item hotkeys will be reset to their defaults on apply" },
  "settings.castMode": { zh: "施法模式", en: "Cast mode" },
    "settings.castInstant": { zh: "快速施法", en: "Quickcast" },
  "settings.castInstantRecommended": { zh: "快速施法（推荐）", en: "Quickcast (Recommended)" },
    "settings.castMouse": { zh: "普通施法（点击目标）", en: "Normal cast (click target)" },
  "settings.castMouseRecommended": { zh: "普通施法（点击目标，推荐）", en: "Normal cast (click target, Recommended)" },
  "settings.comboMode": { zh: "连招模式", en: "Combo mode" },
    "settings.comboInstant": { zh: "逐次祈唤释放", en: "Invoke and cast one by one" },
    "settings.comboPreload": { zh: "预存两个技能后释放（推荐）", en: "Preload two spells, then release (Recommended)" },
  "settings.comboPreloadRecommended": { zh: "预存两个技能后释放（推荐）", en: "Preload two spells, then release (Recommended)" },
    "settings.comboPreloadLegacy": { zh: "预存两个技能后按传统键释放（推荐）", en: "Preload two spells, then cast with legacy keys (Recommended)" },
  "settings.infiniteMana": { zh: "无限魔法", en: "Infinite mana" },
  "settings.heroLevel": { zh: "英雄等级", en: "Hero level" },
  "settings.orbLevel": { zh: "元素等级", en: "Orb levels" },
  "settings.invokeCd": { zh: "元素祈唤冷却", en: "Invoke cooldown" },
  "settings.mana": { zh: "最大魔法", en: "Max mana" },
  "settings.hp": { zh: "最大生命", en: "Max health" },
  "settings.dummyHp": { zh: "假人生命", en: "Dummy HP" },
  "settings.dummyMana": { zh: "假人魔法", en: "Dummy Mana" },
  "settings.close": { zh: "关闭", en: "Close" },
  "settings.apply": { zh: "应用", en: "Apply" },
  "event.insufficient": { zh: "当前球数不足，无法祈唤", en: "Not enough orbs to invoke" },
  "event.invokeCd": { zh: "元素祈唤冷却中", en: "Invoke is on cooldown" },
  "event.reinvoke": { zh: "重新祈唤 {spell}", en: "Re-invoked {spell}" },
  "event.invoked": { zh: "祈唤 {spell}", en: "Invoked {spell}" },
  "event.notInvoked": { zh: "该技能尚未祈唤", en: "Spell is not invoked" },
  "event.spellCd": { zh: "{spell} 冷却中", en: "{spell} is on cooldown" },
  "event.noMana": { zh: "魔法不足", en: "Not enough mana" },
  "event.cast": { zh: "释放 {spell}", en: "Cast {spell}" },
  "event.castDamage": { zh: "释放 {spell}，造成 {damage} 伤害", en: "Cast {spell}, dealt {damage} damage" },
  "event.orbSwitch": { zh: "切换 {element}", en: "Switch {element}" },
  "event.refresherUsed": { zh: "使用刷新球，技能冷却已重置", en: "Refresher Orb used, cooldowns reset" },
  "event.refresherCd": { zh: "刷新球冷却中", en: "Refresher Orb is on cooldown" },
  "event.slotEmpty": { zh: "{slot} 槽为空", en: "{slot} slot is empty" },
  "event.welcome": { zh: "欢迎使用卡尔练习器", en: "Welcome to Invoker Emulator" },
  "event.pendingCast": { zh: "请左键点击假人确认释放 {spell}", en: "Left click the dummy to cast {spell}" },
    "event.pendingForge": { zh: "请右键点击假人确认释放 {spell}", en: "Right click the dummy to cast {spell}" },
  "event.pendingItem": { zh: "请左键点击假人使用 {item}", en: "Left click the dummy to use {item}" },
  "event.travelDouble": { zh: "请左键点击假人，或双击 {key} 使用 {item}", en: "Left click the dummy, or double press {key} to use {item}" },
  "event.castCancelled": { zh: "已取消施法", en: "Cast cancelled" },
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");

  const t = (key: string): string => {
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[lang];
  };

  const elementName = (element: ElementKind): string => {
    if (lang === "zh") {
      return element === "quas" ? "冰" : element === "wex" ? "雷" : "火";
    }
    return element === "quas" ? "Quas" : element === "wex" ? "Wex" : "Exort";
  };

  const spellName = (spell: SpellId): string => {
    const meta = SPELL_BY_ID[spell];
    return lang === "zh" ? meta.nameCn : meta.name;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, elementName, spellName }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

/** 替换 {name} 占位符 */
export function formatTemplate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}
