import { useEffect, useRef, useState } from "react";
import type { SpellId } from "../engine/types";
import { SPELLS, spellImage } from "../engine/spellData";
import { useI18n } from "../i18n";

interface RandomModeProps {
  pendingCast: { spell: SpellId; key: string } | null;
  bubbleInterval: number;
  bubbleDuration: number;
  maxBubbles: number;
  totalKeys: number;
  totalAttempts: number;
  validAttempts: number;
  apm: number;
  quickCastEvent: { id: number; spell: SpellId } | null;
  onHoverChange: (spell: SpellId | null) => void;
  onConfirm: (spell: SpellId) => boolean;
}

interface RandomBubble {
  id: number;
  spell: SpellId;
  x: number;
  y: number;
}

function randomSpell(): SpellId {
  const pool = SPELLS.map((meta) => meta.id);
  return pool[Math.floor(Math.random() * pool.length)];
}

function findNonOverlapPosition(existing: RandomBubble[]): { x: number; y: number } | null {
  for (let i = 0; i < 50; i += 1) {
    const x = 8 + Math.random() * 80;
    const y = 8 + Math.random() * 74;
    const valid = existing.every((bubble) => {
      const dx = bubble.x - x;
      const dy = bubble.y - y;
      return Math.sqrt(dx * dx + dy * dy) > 24;
    });
    if (valid) return { x, y };
  }
  return null;
}

/** 随机技能模式：多个随机位置的气泡依次出现，玩家切换并确认释放。 */
export function RandomMode({
  pendingCast,
  bubbleInterval,
  bubbleDuration,
  maxBubbles,
  totalKeys,
  totalAttempts,
  validAttempts,
  apm,
  quickCastEvent,
  onHoverChange,
  onConfirm,
}: RandomModeProps) {
  const { t } = useI18n();
  const [bubbles, setBubbles] = useState<RandomBubble[]>([]);
  const [feedback, setFeedback] = useState("");
  const nextIdRef = useRef(1);
  const bubblesRef = useRef<RandomBubble[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  bubblesRef.current = bubbles;

  const removeBubble = (id: number) => {
    setBubbles((prev) => prev.filter((bubble) => bubble.id !== id));
  };

  useEffect(() => {
    const safeInterval = Number.isFinite(bubbleInterval) && bubbleInterval > 0 ? bubbleInterval : 1.5;
    const safeDuration = Number.isFinite(bubbleDuration) && bubbleDuration > 0 ? bubbleDuration : 2;

    const spawn = () => {
      const current = bubblesRef.current;
      if (current.length >= maxBubbles) return;
      const position = findNonOverlapPosition(current);
      if (!position) return;
      const id = nextIdRef.current++;
      const bubble: RandomBubble = { id, spell: randomSpell(), x: position.x, y: position.y };
      setBubbles((prev) => [...prev, bubble]);
      const timeoutId = window.setTimeout(() => removeBubble(id), safeDuration * 1000);
      timeoutsRef.current.push(timeoutId);
    };

    const timer = window.setInterval(spawn, safeInterval * 1000);
    return () => window.clearInterval(timer);
  }, [bubbleInterval, bubbleDuration, maxBubbles]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!quickCastEvent) return;
    const bubble = bubblesRef.current.find((item) => item.spell === quickCastEvent.spell);
    if (bubble) {
      removeBubble(bubble.id);
      setFeedback(t("random.success"));
    }
  }, [quickCastEvent, t]);

  const handleBubbleClick = (bubble: RandomBubble) => {
    const success = onConfirm(bubble.spell);
    setFeedback(success ? t("random.success") : t("random.fail"));
    if (success) {
      removeBubble(bubble.id);
    }
  };

  const effectiveRate = totalAttempts > 0 ? Math.round((validAttempts / totalAttempts) * 100) : 0;

  return (
    <div className="random-mode">
      <div className="random-stats">
        <div>
          <span className="stat-label">{t("random.validRate")}</span>
          <span className="stat-value">{effectiveRate}%</span>
        </div>
        <div>
          <span className="stat-label">APM</span>
          <span className="stat-value">{apm}</span>
        </div>
      </div>

      <div className="random-stage">
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={`random-bubble ${pendingCast ? "ready" : ""}`}
            style={{ left: `${bubble.x}%`, top: `${bubble.y}%` }}
            onMouseEnter={() => onHoverChange(bubble.spell)}
            onMouseLeave={() => onHoverChange(null)}
            onClick={() => handleBubbleClick(bubble)}
            title={t("random.clickHint")}
          >
            <img src={spellImage(bubble.spell)} alt="" />
          </div>
        ))}
      </div>

      <div className="random-message">
        <div className="random-feedback">{feedback || t("random.hint")}</div>
        <div className="random-slot-hint">
          {pendingCast ? t("random.pendingHint") : ""}
        </div>
      </div>
    </div>
  );
}
