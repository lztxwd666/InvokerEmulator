import type { ElementKind, InvokerState, ItemId, KeybindMode, SpellId } from "../engine/types";
import { elementImage, ITEMS, LEGACY_CAST_KEYS } from "../engine/spellData";
import { useI18n } from "../i18n";

interface HUDProps {
  state: InvokerState;
  keybindMode: KeybindMode;
  itemKeys: Record<ItemId, string>;
  pendingCast: { spell: SpellId; key: string } | null;
  pendingItem: { item: ItemId; key: string } | null;
  onCastElement: (element: ElementKind) => void;
  onInvoke: () => void;
  onCastSpell: (spell: SpellId) => void;
  onUseItem: (item: ItemId) => void;
}

const ELEMENT_ORDER: ElementKind[] = ["quas", "wex", "exort"];

/** 底部 HUD：状态栏、三球队列、Q/W/E/R/D/F 同排技能栏。 */
export function HUD({
  state,
  keybindMode,
  itemKeys,
  pendingCast,
  pendingItem,
  onCastElement,
  onInvoke,
  onCastSpell,
  onUseItem,
}: HUDProps) {
  const { t, lang, elementName, spellName } = useI18n();

  const slotKey = (slotIndex: number, spellId: SpellId | null): string => {
    if (!spellId) return keybindMode === "legacy" ? "-" : slotIndex === 0 ? "D" : "F";
    return keybindMode === "legacy" ? LEGACY_CAST_KEYS[spellId] : slotIndex === 0 ? "D" : "F";
  };

  return (
    <div className="bottom-hud">
      <div className="status-side left">
        <div className="hud-title-row">
          <span className="section-title">{t("hud.heroStatus")}</span>
        </div>
        <div className="bars">
          <div className="bar hp">
            <span>{t("hud.hp")} {Math.round(state.hp)}/{Math.round(state.maxHp)}</span>
            <div className="bar-fill" style={{ width: `${(state.hp / state.maxHp) * 100}%` }} />
          </div>
          <div className="bar mana">
            <span>{t("hud.mana")} {Math.round(state.mana)}/{Math.round(state.maxMana)}</span>
            <div className="bar-fill" style={{ width: `${(state.mana / state.maxMana) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="center-hud">
        <div className="hud-title-row">
          <span className="section-title">{t("hud.orbQueue")}</span>
          <div className="orb-queue">
          {[0, 1, 2].map((index) => {
            const orb = state.orbs[index];
            return (
              <div key={index} className={`orb-slot ${orb ? `orb-${orb}` : "empty"}`}>
                {orb && (
                  <img
                    key={orb}
                    className="orb-queue-icon"
                    src={elementImage(orb)}
                    alt={elementName(orb)}
                  />
                )}
              </div>
            );
          })}
          </div>
        </div>

        <div className="ability-row">
          {ELEMENT_ORDER.map((element) => (
            <button
              key={element}
              className={`ability-button orb-${element}`}
              onClick={() => onCastElement(element)}
              title={elementName(element)}
            >
              <img src={elementImage(element)} alt={elementName(element)} />
              <span className="key-badge">{element === "quas" ? "Q" : element === "wex" ? "W" : "E"}</span>
            </button>
          ))}

          <button
            className={`ability-button invoke-button ${pendingCast?.key === "R" ? "pending" : ""}`}
            onClick={onInvoke}
            title={t("hud.invoke")}
          >
            <img className="invoke-icon" src="images/abilities/invoker_invoke.png" alt={t("hud.invoke")} />
            <span className="key-badge">R</span>
            {state.invokeCooldown > 0 && (
              <span className="cooldown-overlay">{state.invokeCooldown.toFixed(1)}</span>
            )}
          </button>

          {[0, 1].map((slotIndex) => {
            const spellId = state.invokedSlots[slotIndex];
            const key = slotKey(slotIndex, spellId);
            return (
              <button
                key={slotIndex}
                className={`ability-button spell-slot ${pendingCast?.spell === spellId ? "pending" : ""}`}
                onClick={() => spellId && onCastSpell(spellId)}
                title={spellId ? `${spellName(spellId)} [${key}]` : key}
              >
                {spellId ? (
                  <>
                    <img src={`images/abilities/${spellId}.png`} alt={spellName(spellId)} />
                    <span className="key-badge">{key}</span>
                    {state.spellCooldowns[spellId] > 0 && (
                      <span className="cooldown-overlay">{state.spellCooldowns[spellId].toFixed(1)}</span>
                    )}
                  </>
                ) : (
                  <span className="empty-key">{key}</span>
                )}
              </button>
            );
          })}

          <div className="item-row">
            {ITEMS.map((item) => (
              <button
                key={item.id}
                className={`item-button ${pendingItem?.item === item.id ? "pending" : ""}`}
                onClick={() => onUseItem(item.id)}
                title={`${lang === "zh" ? item.nameZh : item.nameEn} [${itemKeys[item.id]}]`}
              >
                <img src={`images/items/${item.image}`} alt={lang === "zh" ? item.nameZh : item.nameEn} />
                <span className="key-badge">{itemKeys[item.id]}</span>
                {state.itemCooldowns[item.id] > 0 && (
                  <span className="cooldown-overlay">{state.itemCooldowns[item.id].toFixed(1)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="status-side right">
        <div className="hud-title-row">
          <span className="section-title">{t("hud.dummyStatus")}</span>
        </div>
        <div className="bars">
          <div className="bar hp">
            <span>{t("hud.dummyHp")} {Math.round(state.dummy.hp)}/{state.dummy.maxHp}</span>
            <div className="bar-fill" style={{ width: `${(state.dummy.hp / state.dummy.maxHp) * 100}%` }} />
          </div>
          <div className="bar mana">
            <span>{t("hud.dummyMana")} {Math.round(state.dummy.mana)}/{state.dummy.maxMana}</span>
            <div className="bar-fill" style={{ width: `${(state.dummy.mana / state.dummy.maxMana) * 100}%` }} />
          </div>
          {state.dummy.lastHit && <div className="last-hit">{state.dummy.lastHit}</div>}
        </div>
      </div>
    </div>
  );
}
