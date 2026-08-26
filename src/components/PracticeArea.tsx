import type { InvokerState, PlanStep } from "../engine/types";
import { useI18n } from "../i18n";

interface PracticeAreaProps {
  state: InvokerState;
  event: string;
  mouseMode: boolean;
  pending: boolean;
  plan: PlanStep[];
  currentStep: number;
  onLeftClick: () => void;
  onRightClick: () => void;
}

/** 练习场地：可点击的训练假人、事件反馈和当前球序提示。 */
export function PracticeArea({
  state,
  event,
  mouseMode,
  pending,
  plan,
  currentStep,
  onLeftClick,
  onRightClick,
}: PracticeAreaProps) {
  const { t } = useI18n();
  const stepImage = (step: PlanStep): string => {
    if (step.type === "orb") {
      return step.element === "quas" ? "images/abilities/invoker_quas.png" : step.element === "wex" ? "images/abilities/invoker_wex.png" : "images/abilities/invoker_exort.png";
    }
    if (step.type === "invoke") return "images/abilities/invoker_invoke.png";
    if (step.type === "item") return `images/items/${step.item === "sheepstick" ? "sheepstick" : step.item === "meteor_hammer" ? "meteor_hammer" : step.item === "travel_boots" ? "travel_boots" : "refresher"}.png`;
    return `images/abilities/${step.spell}.png`;
  };

  return (
    <div className={`practice-area ${mouseMode ? "clickable" : ""}`}>
      {plan.length > 0 && (
        <div className="plan-overlay">
          <span className="section-title">{t("combo.optimal")}</span>
          <div className="plan-steps">
            {plan.map((step, index) => (
              <div
                key={index}
                className={`plan-step ${index === currentStep ? "current" : index < currentStep ? "done" : ""}`}
              >
                <img src={stepImage(step)} alt="" />
                <span className="key-badge">{step.key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div
        className={`dummy ${mouseMode ? "clickable" : ""} ${pending ? "pending" : ""}`}
        onClick={mouseMode ? onLeftClick : undefined}
        onContextMenu={(e) => {
          if (mouseMode) {
            e.preventDefault();
            onRightClick();
          }
        }}
      >
        <img src="images/heroes/invoker_icon.png" alt={t("hud.dummy")} />
        <div className="dummy-label">{t("hud.dummy")}</div>
        <div className="dummy-hp-bar">
          <div
            className="fill"
            style={{ width: `${(state.dummy.hp / state.dummy.maxHp) * 100}%` }}
          />
        </div>
        <span className="dummy-hp-text">
          {Math.round(state.dummy.hp)} / {state.dummy.maxHp}
        </span>
      </div>
      <div className="event-log">{event || t("hud.wait")}</div>
    </div>
  );
}
