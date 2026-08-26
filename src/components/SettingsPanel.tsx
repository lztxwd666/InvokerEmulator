import { useState } from "react";
import type { ElementKind, GameConfig, ItemId, KeybindMode, CastMode, ComboMode } from "../engine/types";
import { computeAttributes, invokeCooldown } from "../engine/invoker";
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
    setDraft((prev) => ({
      ...prev,
      orbLevels: { ...prev.orbLevels, [element]: level },
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
  const conflictItem = ITEMS.find((item) =>
    reservedKeys.includes(draft.itemKeys[item.id].toUpperCase()),
  );

  const apply = () => {
    const heroLevel = Math.max(1, Math.min(30, Number(heroLevelText) || 1));
    const dummyMaxHp = Math.max(100, Number(dummyHpText) || 100);
    const dummyMaxMana = Math.max(0, Number(dummyManaText) || 0);
    const itemKeys = { ...draft.itemKeys };
    for (const item of ITEMS) {
      const value = itemKeys[item.id].trim().slice(0, 1).toUpperCase();
      const fallback =
        item.id === "refresher"
          ? "5"
          : item.id === "sheepstick"
            ? draft.keybindMode === "legacy"
              ? "1"
              : "Z"
            : item.id === "meteor_hammer"
              ? draft.keybindMode === "legacy"
                ? "2"
                : "X"
              : draft.keybindMode === "legacy"
                ? "3"
                : "C";
      itemKeys[item.id] = value && !reservedKeys.includes(value) ? value : fallback;
    }
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
              onChange={(e) => setHeroLevelText(e.target.value.replace(/[^\d]/g, ""))}
            />
          </label>
          <span className="sub-title">{t("settings.orbLevel")}</span>
          {ELEMENTS.map((element) => (
            <label key={element} className="orb-level-row">
              <span>{elementName(element)}</span>
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={draft.orbLevels[element]}
                onChange={(e) => setOrbLevel(element, Number(e.target.value))}
              />
              <b>{draft.orbLevels[element]}</b>
            </label>
          ))}
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
          {ITEMS.map((item) => (
            <label key={item.id}>
              <span>{langItemName(item.id)}</span>
              <input
                type="text"
                maxLength={1}
                value={draft.itemKeys[item.id]}
                onChange={(e) => setItemKey(item.id, e.target.value.toUpperCase())}
              />
            </label>
          ))}
          {conflictItem && <span className="settings-warning">{t("settings.itemKeyConflict")}</span>}
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
