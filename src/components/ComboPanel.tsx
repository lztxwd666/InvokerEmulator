import { useState } from "react";
import type { Combo, ComboAction, ElementKind, PlanStep, SpellId } from "../engine/types";
import { CATACLYSM_ID, CATACLYSM_META, elementImage, itemImage, ITEMS, SPELL_BY_ID, SPELLS, spellImage } from "../engine/spellData";
import { planCombo, type PlannerOptions } from "../engine/planner";
import { useI18n } from "../i18n";

interface ComboPanelProps {
  combos: Combo[];
  activeCombo: Combo | null;
  previewOrbs: ElementKind[];
  previewOptions: PlannerOptions;
  onSelect: (combo: Combo) => void;
  onSaveCustomCombo: (combo: Combo) => void;
  onRemoveCustomCombo: (id: string) => void;
  aghanimsScepter: boolean;
}

function actionImage(action: ComboAction): string {
  if (action.type === "cataclysm") return spellImage(CATACLYSM_ID);
  if (action.type === "spell") return spellImage(action.spell);
  return itemImage(action.item);
}

function stepImage(step: PlanStep): string {
  if (step.type === "orb") return elementImage(step.element);
  if (step.type === "invoke") return "images/abilities/invoker_invoke.png";
  if (step.type === "item") return itemImage(step.item);
  return spellImage(step.spell);
}

/** 连招面板：内置连招、图标化按键步骤、自定义技能组合。 */
export function ComboPanel({
  combos,
  activeCombo,
  previewOrbs,
  previewOptions,
  onSelect,
  onSaveCustomCombo,
  onRemoveCustomCombo,
  aghanimsScepter,
}: ComboPanelProps) {
  const { t, spellName, lang } = useI18n();
  const [customName, setCustomName] = useState("");
  const [customActions, setCustomActions] = useState<ComboAction[]>([]);
  const previewPlan = planCombo(customActions, previewOrbs, previewOptions);

  const saveCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed || customActions.length === 0) return;
    const fallbackZh = customActions
      .map((a) => {
        if (a.type === "spell") return SPELL_BY_ID[a.spell].nameCn;
        if (a.type === "cataclysm") return CATACLYSM_META.nameCn;
        return ITEMS.find((i) => i.id === a.item)?.nameZh ?? "";
      })
      .join(" ");
    const fallbackEn = customActions
      .map((a) => {
        if (a.type === "spell") return SPELL_BY_ID[a.spell].name;
        if (a.type === "cataclysm") return CATACLYSM_META.name;
        return ITEMS.find((i) => i.id === a.item)?.nameEn ?? "";
      })
      .join(" ");
    onSaveCustomCombo({
      id: `custom_${Date.now()}`,
      nameZh: lang === "zh" ? trimmed : fallbackZh,
      nameEn: lang === "en" ? trimmed : fallbackEn,
      actions: customActions,
    });
    setCustomName("");
    setCustomActions([]);
  };

  return (
    <div className="combo-panel">
      <h3>{t("combo.title")}</h3>

      <div className="combo-list">
        {combos.map((combo) => (
          <div key={combo.id} className="combo-row">
            <button
              className={`combo-item ${activeCombo?.id === combo.id ? "active" : ""}`}
              onClick={() => onSelect(combo)}
            >
              <span className="combo-name">{lang === "zh" ? combo.nameZh : combo.nameEn}</span>
              <span className="combo-icons">
                {combo.actions.map((action, index) => (
                  <img key={index} src={actionImage(action)} alt="" />
                ))}
              </span>
            </button>
            {combo.id.startsWith("custom_") && (
              <button
                className="combo-remove"
                title={t("combo.removeCombo")}
                onClick={() => onRemoveCustomCombo(combo.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="custom-combo">
        <h4>{t("combo.customTitle")}</h4>
        <p className="hint">{t("combo.customHint")}</p>
        <div className="spell-picker">
          {SPELLS.map((meta) => {
            if (meta.id === "invoker_sun_strike" && aghanimsScepter) {
              return (
                <button
                  key={meta.id}
                  className="picker-spell picker-cataclysm"
                  onClick={() => setCustomActions((prev) => [...prev, { type: "cataclysm" }])}
                  title={lang === "zh" ? `${CATACLYSM_META.nameCn}（需双击触发）` : `${CATACLYSM_META.name} (double press)`}
                >
                  <img src={spellImage(CATACLYSM_ID)} alt={lang === "zh" ? CATACLYSM_META.nameCn : CATACLYSM_META.name} />
                  <span className="picker-double">{lang === "zh" ? "双击" : "x2"}</span>
                </button>
              );
            }
            return (
              <button
                key={meta.id}
                className="picker-spell"
                onClick={() => setCustomActions((prev) => [...prev, { type: "spell", spell: meta.id as SpellId }])}
                title={spellName(meta.id)}
              >
                <img src={`images/abilities/${meta.id}.png`} alt={spellName(meta.id)} />
              </button>
            );
          })}
          {ITEMS.map((item) => (
            <button
              key={item.id}
              className="picker-spell"
              onClick={() => setCustomActions((prev) => [...prev, { type: "item", item: item.id }])}
              title={lang === "zh" ? item.nameZh : item.nameEn}
            >
              <img src={itemImage(item.id)} alt={lang === "zh" ? item.nameZh : item.nameEn} />
            </button>
          ))}
        </div>

        <div className="selected-actions">
          <span>{t("combo.selected")}:</span>
          {customActions.length === 0 && <span className="empty-hint">{t("combo.customHint")}</span>}
          {customActions.map((action, index) => (
            <button
              key={index}
              className="selected-action"
              onClick={() => setCustomActions((prev) => prev.filter((_, i) => i !== index))}
              title={t("combo.remove")}
            >
              <img src={actionImage(action)} alt="" />
              {action.type === "cataclysm" && (
                <span className="selected-double">{lang === "zh" ? "双击" : "x2"}</span>
              )}
            </button>
          ))}
        </div>

        {customActions.length > 0 && (
          <div className="combo-plan">
            <div className="combo-progress">{t("combo.optimal")}</div>
            <div className="plan-steps">
              {previewPlan.map((step, index) => (
                <div key={index} className="plan-step">
                  <img src={stepImage(step)} alt="" />
                  <span className="key-badge">{step.key}</span>
                  {step.type === "cast" && step.spell === CATACLYSM_ID && (
                    <span className="step-double">{lang === "zh" ? "双击" : "x2"}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <input
          placeholder={t("combo.name")}
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
        />
        <div className="custom-actions">
          <button onClick={() => setCustomActions([])}>{t("combo.clear")}</button>
          <button onClick={saveCustom}>{t("combo.save")}</button>
        </div>
      </div>
    </div>
  );
}
