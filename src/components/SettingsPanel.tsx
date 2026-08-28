import { useState } from "react";
import type { ElementKind, GameConfig, ItemId, KeybindMode, CastMode, ComboMode } from "../engine/types";
import {
  autoOrbLevels,
  computeAttributes,
  getOrbMaxLevel,
  getTotalAbilityPoints,
  invokeCooldown,
  normalizeOrbLevels,
} from "../engine/invoker";
import { normalizeItemHotkey, sanitizeItemKeys } from "../engine/config";
import { ITEMS, LEGACY_CAST_KEYS } from "../engine/spellData";
import { useI18n } from "../i18n";

interface SettingsPanelProps {
  config: GameConfig;
  onApply: (config: GameConfig) => void;
  onClose: () => void;
}

const ELEMENTS: ElementKind[] = ["quas", "wex", "exort"];

/** 训练设置：等级、键位、施法模式、连招模式、物品和假人属性。 */
export function SettingsPanel({ config, onApply, onClose }: SettingsPanelProps) {
  const { t, lang, elementName } = useI18n();
  const [heroLevelText, setHeroLevelText] = useState(String(config.heroLevel));
  const [dummyHpText, setDummyHpText] = useState(String(config.dummyMaxHp));
  const [dummyManaText, setDummyManaText] = useState(String(config.dummyMaxMana));
  const [draft, setDraft] = useState<GameConfig>(config);

  const setOrbLevel = (element: ElementKind, level: number) => {
    setDraft((prev) => {
      const max = getOrbMaxLevel(prev, element);
      const isChosen = prev.aghanimsScepter && prev.aghsOrb === element;
      let value = Math.max(0, Math.min(max, level));
      const levels = { ...prev.orbLevels, [element]: value };

      if (!isChosen) {
        // 非神杖强化球必须受总技能点约束；神杖强化球的 +1 不占用技能点。
        const regularCap = prev.heroLevel >= 14 ? 8 : Math.ceil(prev.heroLevel / 2);
        const chosenBase = prev.aghanimsScepter
          ? Math.min(regularCap, prev.orbLevels[prev.aghsOrb])
          : prev.orbLevels[prev.aghsOrb];
        const otherTotal =
          prev.orbLevels.quas + prev.orbLevels.wex + prev.orbLevels.exort -
          prev.orbLevels[element];
        const budget = getTotalAbilityPoints(prev.heroLevel) - chosenBase;
        value = Math.max(0, Math.min(max, level, Math.max(0, budget - (otherTotal - prev.orbLevels[element]))));
        levels[element] = value;
      }

      if (prev.aghanimsScepter) {
        if (value === 9 && prev.aghsOrb !== element) {
          // 只能存在一个 9 级球，拖动到其他元素时，旧的 9 级球降为 8 级
          levels[prev.aghsOrb] = Math.min(levels[prev.aghsOrb], 8);
          return { ...prev, orbLevels: levels, aghsOrb: element };
        }
      }
      return { ...prev, orbLevels: levels };
    });
  };

  const applyHeroLevel = (heroLevel: number) => {
    setDraft((prev) => ({
      ...prev,
      heroLevel,
      orbLevels: autoOrbLevels({
        heroLevel,
        aghanimsScepter: prev.aghanimsScepter,
        aghsOrb: prev.aghsOrb,
      }),
    }));
  };

  const setItemKey = (item: ItemId, key: string) => {
    setDraft((prev) => ({
      ...prev,
      itemKeys: { ...prev.itemKeys, [item]: key },
    }));
  };

  const attr = computeAttributes(draft);
  const invokeCd = invokeCooldown(draft.orbLevels);
  const reservedKeys =
    draft.keybindMode === "legacy"
      ? ["Q", "W", "E", "R", ...Object.values(LEGACY_CAST_KEYS)]
      : ["Q", "W", "E", "R", "D", "F"];
  const normalizedItemKey = (item: ItemId): string => normalizeItemHotkey(draft.itemKeys[item]);
  const conflictItem = ITEMS.find((item) => reservedKeys.includes(normalizedItemKey(item.id)));
  const duplicateItem = ITEMS.find((item) =>
    normalizedItemKey(item.id) !== "" &&
    ITEMS.findIndex((other) => other.id !== item.id && normalizedItemKey(other.id) === normalizedItemKey(item.id)) >= 0
  );

  const apply = () => {
    const heroLevel = Math.max(1, Math.min(30, Number(heroLevelText) || 1));
    const dummyMaxHp = Math.max(100, Number(dummyHpText) || 100);
    const dummyMaxMana = Math.max(0, Number(dummyManaText) || 0);
    const itemKeys = sanitizeItemKeys(draft.itemKeys, draft.keybindMode);
    onApply({
      ...draft,
      heroLevel,
      dummyMaxHp,
      dummyMaxMana,
      itemKeys,
    });
  };

  return (
    <div className="settings-backdrop">
      <div className="settings-panel">
        <h3>{t("settings.title")}</h3>

        <div className="settings-card">
          <h4 className="card-title title-basic">{t("settings.cardBasic")}</h4>
          <label>
            {t("settings.heroLevel")}
            <input
              type="text"
              inputMode="numeric"
              value={heroLevelText}
              onChange={(e) => {
                const text = e.target.value.replace(/[^\d]/g, "");
                setHeroLevelText(text);
                if (text !== "") {
                  const level = Math.max(1, Math.min(30, Number(text) || 1));
                  applyHeroLevel(level);
                }
              }}
            />
          </label>
          <span className="sub-title">{t("settings.orbLevel")}</span>
          {ELEMENTS.map((element) => (
            <label key={element} className="orb-level-row">
              <span>{elementName(element)}</span>
              <input
                type="range"
                min={0}
                max={getOrbMaxLevel(draft, element)}
                step={1}
                value={draft.orbLevels[element]}
                onChange={(e) => setOrbLevel(element, Number(e.target.value))}
              />
              <b>{draft.orbLevels[element]}</b>
            </label>
          ))}
          <label className="check-row">
            <span>{t("settings.aghsScepter")}</span>
            <input
              type="checkbox"
              checked={draft.aghanimsScepter}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  aghanimsScepter: e.target.checked,
                  orbLevels: autoOrbLevels({
                    heroLevel: prev.heroLevel,
                    aghanimsScepter: e.target.checked,
                    aghsOrb: prev.aghsOrb,
                  }),
                }))
              }
            />
          </label>
          {draft.aghanimsScepter && (
            <label>
              <span>{t("settings.aghsOrb")}</span>
              <select
                value={draft.aghsOrb}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    aghsOrb: e.target.value as ElementKind,
                    orbLevels: autoOrbLevels({
                      heroLevel: prev.heroLevel,
                      aghanimsScepter: true,
                      aghsOrb: e.target.value as ElementKind,
                    }),
                  }))
                }
              >
                {ELEMENTS.map((element) => (
                  <option key={element} value={element}>{elementName(element)}</option>
                ))}
              </select>
            </label>
          )}
          <span className="hint">
            {t("settings.orbPoints")}: {normalizeOrbLevels(draft.orbLevels, draft).quas + normalizeOrbLevels(draft.orbLevels, draft).wex + normalizeOrbLevels(draft.orbLevels, draft).exort} / {getTotalAbilityPoints(draft.heroLevel)}
          </span>
        </div>

        <div className="settings-info">
          <div>{t("settings.invokeCd")}: {invokeCd.toFixed(2)}s</div>
          <div>{t("settings.mana")}: {Math.round(attr.maxMana)}</div>
          <div>{t("settings.hp")}: {Math.round(attr.maxHp)}</div>
        </div>

        <div className="settings-card">
          <h4 className="card-title title-keys">{t("settings.cardKeys")}</h4>
          <label>
            {t("settings.keybindMode")}
            <select
              value={draft.keybindMode}
              onChange={(e) => setDraft({ ...draft, keybindMode: e.target.value as KeybindMode })}
            >
              <option value="qwer">{t("settings.keybindQwer")}</option>
              <option value="legacy">{t("settings.keybindLegacy")}</option>
            </select>
          </label>

          <span className="sub-title">{t("settings.itemKeys")}</span>
          <span className="hint">{t("settings.itemKeyHint")}</span>
          {ITEMS.map((item) => (
            <label key={item.id}>
              <span>{langItemName(item.id)}</span>
              <input
                type="text"
                maxLength={8}
                value={draft.itemKeys[item.id]}
                onChange={(e) => setItemKey(item.id, e.target.value.toUpperCase())}
              />
            </label>
          ))}
          {conflictItem && <span className="settings-warning">{t("settings.itemKeyConflict")}</span>}
          {duplicateItem && <span className="settings-warning">{t("settings.itemKeyDuplicate")}</span>}
        </div>

        <div className="settings-card">
          <h4 className="card-title title-cast">{t("settings.cardCastCombo")}</h4>
          <label>
            {t("settings.castMode")}
            <select
              value={draft.castMode}
              onChange={(e) => setDraft({ ...draft, castMode: e.target.value as CastMode })}
            >
              <option value="mouse">{t("settings.castMouseRecommended")}</option>
              <option value="instant">{t("settings.castInstant")}</option>
            </select>
          </label>
          <label>
            {t("settings.comboMode")}
            <select
              value={draft.comboMode}
              onChange={(e) => setDraft({ ...draft, comboMode: e.target.value as ComboMode })}
            >
              <option value="preload">
                {draft.keybindMode === "legacy" ? t("settings.comboPreloadLegacy") : t("settings.comboPreload")}
              </option>
              <option value="instant">{t("settings.comboInstant")}</option>
            </select>
          </label>
          <div className="quickcast-setting">
            <span className="sub-title">{t("settings.quickcastModifier")}</span>
            <div className="segmented-control">
              {(["Alt", "Ctrl", "Shift"] as const).map((modifier) => (
                <button
                  key={modifier}
                  className={draft.quickcastModifier === modifier ? "active" : ""}
                  onClick={() => setDraft({ ...draft, quickcastModifier: modifier })}
                >
                  {modifier}
                </button>
              ))}
            </div>
            <span className="hint">{t("settings.quickcastHint")}</span>
          </div>
          <label className="check-row">
            <span>{t("settings.infiniteMana")}</span>
            <input
              type="checkbox"
              checked={draft.infiniteMana}
              onChange={(e) => setDraft({ ...draft, infiniteMana: e.target.checked })}
            />
          </label>
          <label className="check-row">
            <span>{t("settings.muted")}</span>
            <input
              type="checkbox"
              checked={draft.muted}
              onChange={(e) => setDraft({ ...draft, muted: e.target.checked })}
            />
          </label>
        </div>

        <div className="settings-card">
          <h4 className="card-title title-random">{t("settings.cardRandom")}</h4>
          <label>
            <span>{t("settings.randomInterval")}</span>
            <input
              type="range"
              min={0.3}
              max={5}
              step={0.1}
              value={draft.randomBubbleInterval}
              onChange={(e) => setDraft({ ...draft, randomBubbleInterval: Number(e.target.value) })}
            />
            <b>{draft.randomBubbleInterval.toFixed(1)}s</b>
          </label>
          <label>
            <span>{t("settings.randomDuration")}</span>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.1}
              value={draft.randomBubbleDuration}
              onChange={(e) => setDraft({ ...draft, randomBubbleDuration: Number(e.target.value) })}
            />
            <b>{draft.randomBubbleDuration.toFixed(1)}s</b>
          </label>
          <label>
            <span>{t("settings.randomMaxBubbles")}</span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={draft.randomMaxBubbles}
              onChange={(e) => setDraft({ ...draft, randomMaxBubbles: Number(e.target.value) })}
            />
            <b>{draft.randomMaxBubbles}</b>
          </label>
        </div>

        <div className="settings-card">
          <h4 className="card-title title-dummy">{t("settings.cardDummy")}</h4>
          <label>
            {t("settings.dummyHp")}
            <input
              type="text"
              inputMode="numeric"
              value={dummyHpText}
              onChange={(e) => setDummyHpText(e.target.value.replace(/[^\d]/g, ""))}
            />
          </label>
          <label>
            {t("settings.dummyMana")}
            <input
              type="text"
              inputMode="numeric"
              value={dummyManaText}
              onChange={(e) => setDummyManaText(e.target.value.replace(/[^\d]/g, ""))}
            />
          </label>
        </div>

        <div className="settings-actions">
          <button onClick={onClose}>{t("settings.close")}</button>
          <button onClick={apply}>{t("settings.apply")}</button>
        </div>
      </div>
    </div>
  );

  function langItemName(item: ItemId): string {
    const meta = ITEMS.find((x) => x.id === item)!;
    return lang === "zh" ? meta.nameZh : meta.nameEn;
  }
}
