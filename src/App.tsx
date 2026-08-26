import { useEffect, useRef, useState } from "react";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { CastableId, Combo, ElementKind, GameConfig, InvokerState, ItemId, PlanStep, SpellId } from "./engine/types";
import {
  castCataclysm,
  castElement,
  castSpell,
  createInitialState,
  invoke,
  resetDummy,
  tick,
  toggleAghanims,
  useItem,
  DEFAULT_CONFIG,
} from "./engine/invoker";
import { CATACLYSM_ID, ITEM_BY_ID, LEGACY_CAST_KEYS, SPELL_BY_ID } from "./engine/spellData";
import { planCombo } from "./engine/planner";
import { CONFIG_KEY, loadCombos, loadPersistedConfig, STORAGE_KEY } from "./engine/persistence";
import { useGlobalInput } from "./hooks/useGlobalInput";
import { HUD } from "./components/HUD";
import { ComboPanel } from "./components/ComboPanel";
import { PracticeArea } from "./components/PracticeArea";
import { RandomMode } from "./components/RandomMode";
import { SettingsPanel } from "./components/SettingsPanel";
import { playOrbSwitch, playSound, setMuted } from "./audio";
import { formatTemplate, useI18n } from "./i18n";

type ExpectedStep =
  | { type: "orb"; element: ElementKind; key: string }
  | { type: "invoke"; key: string; spell: SpellId }
  | { type: "cast"; key: string; spell: CastableId }
  | { type: "item"; key: string; item: ItemId };

function plannerOptions(config: GameConfig) {
  return {
    keybindMode: config.keybindMode,
    itemKeys: config.itemKeys,
    comboMode: config.comboMode,
  };
}

export default function App() {
  const { lang, setLang, t, spellName } = useI18n();
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [state, setState] = useState<InvokerState>(() => createInitialState(DEFAULT_CONFIG));
  const [event, setEvent] = useState(t("event.welcome"));
  const [combos, setCombos] = useState<Combo[]>(loadCombos);
  const [activeCombo, setActiveCombo] = useState<Combo | null>(null);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [randomMode, setRandomMode] = useState(false);
  const [randomStats, setRandomStats] = useState({ keys: 0, attempts: 0, valid: 0 });
  const [randomQuickCast, setRandomQuickCast] = useState<{ id: number; spell: SpellId } | null>(null);
  const randomHoveredSpellRef = useRef<SpellId | null>(null);
  const randomStartRef = useRef(0);
  const [pendingCast, setPendingCast] = useState<{ spell: SpellId; key: string } | null>(null);
  const [pendingItem, setPendingItem] = useState<{ item: ItemId; key: string } | null>(null);
  const lastTravelPressRef = useRef<{ item: ItemId; time: number } | null>(null);
  const lastCataclysmPressRef = useRef<{ spell: CastableId; time: number } | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const planRef = useRef(plan);
  planRef.current = plan;
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  /** 同步更新 stateRef，避免快速连按键盘时读到过期状态。 */
  const commit = (next: InvokerState) => {
    stateRef.current = next;
    setState(next);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((prev) => {
        const next = tick(prev, 0.1);
        stateRef.current = next;
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combos));
    } catch {
      // 忽略本地存储写入失败
    }
  }, [combos]);

  useEffect(() => {
    if (!configLoaded) return;
    const data = JSON.stringify(config);
    try {
      localStorage.setItem(CONFIG_KEY, data);
    } catch {
      // 忽略 localStorage 写入失败
    }
    if ("__TAURI_INTERNALS__" in window) {
      tauriInvoke("save_config", { data }).catch(() => {
        // 文件写入失败时保留 localStorage 副本
      });
    }
  }, [config, configLoaded]);

  useEffect(() => {
    document.title = t("app.title");
  }, [lang, t]);

  useEffect(() => {
    loadPersistedConfig().then((loaded) => {
      setConfig(loaded);
      commit(createInitialState(loaded));
      setConfigLoaded(true);
    });
    // 仅启动时加载一次
  }, []);

  useEffect(() => {
    setMuted(config.muted);
  }, [config.muted]);

  useEffect(() => {
    // 切换语言后重置提示，避免旧语言文案残留
    setEvent(t("event.welcome"));
    setState((prev) => {
      const next = {
        ...prev,
        dummy: { ...prev.dummy, lastHit: undefined },
      };
      stateRef.current = next;
      return next;
    });
  }, [lang]);

  const performElement = (element: ElementKind) => {
    const result = castElement(stateRef.current, element, lang);
    commit(result.state);
    setPendingCast(null);
    setPendingItem(null);
    lastTravelPressRef.current = null;
    lastCataclysmPressRef.current = null;
    setEvent(result.event ?? "");
    playOrbSwitch(element);
  };

  const performInvoke = (): boolean => {
    const result = invoke(stateRef.current, lang, randomMode);
    commit(result.state);
    setPendingCast(null);
    setPendingItem(null);
    lastTravelPressRef.current = null;
    lastCataclysmPressRef.current = null;
    setEvent(result.event ?? "");
    const invokeSucceeded =
      result.event?.startsWith("祈唤") ||
      result.event?.startsWith("重新祈唤") ||
      result.event?.startsWith("Invoked") ||
      result.event?.startsWith("Re-invoked");
    if (invokeSucceeded) {
      playSound("Invoke.mp3", 0.85);
      return true;
    }
    return false;
  };

  const castSpellAction = (spell: SpellId): boolean => {
    const result = castSpell(stateRef.current, spell, lang, randomMode);
    commit(result.state);
    lastCataclysmPressRef.current = null;
    setEvent(result.event ?? "");
    const prefix = lang === "zh" ? "释放" : "Cast";
    if (result.event?.startsWith(prefix)) {
      playSound(SPELL_BY_ID[spell].sound, 0.8);
      return true;
    }
    return false;
  };

  const performCataclysm = (): boolean => {
    const result = castCataclysm(stateRef.current, lang);
    commit(result.state);
    setPendingCast(null);
    setPendingItem(null);
    lastTravelPressRef.current = null;
    lastCataclysmPressRef.current = null;
    setEvent(result.event ?? "");
    const prefix = lang === "zh" ? "释放" : "Cast";
    if (result.event?.startsWith(prefix)) {
      playSound("Sun_Strike_cast.mp3", 0.8);
      return true;
    }
    return false;
  };

  const performToggleAghanims = () => {
    const result = toggleAghanims(stateRef.current, lang);
    const enabled = result.state.aghanimsScepter;
    const orbLevels = enabled
      ? result.state.orbLevels
      : {
          quas: Math.min(7, result.state.orbLevels.quas),
          wex: Math.min(7, result.state.orbLevels.wex),
          exort: Math.min(7, result.state.orbLevels.exort),
        };
    const nextState = { ...result.state, orbLevels };
    commit(nextState);
    setConfig((prev) => ({ ...prev, aghanimsScepter: enabled, orbLevels }));
    lastCataclysmPressRef.current = null;
    setEvent(result.event ?? "");
  };

  const performItemAction = (item: ItemId): boolean => {
    const result = useItem(stateRef.current, item, lang);
    commit(result.state);
    setPendingCast(null);
    setPendingItem(null);
    lastTravelPressRef.current = null;
    lastCataclysmPressRef.current = null;
    setEvent(result.event ?? "");
    const prefix = lang === "zh" ? "使用" : "Use";
    if (result.event?.startsWith(prefix) || result.event?.includes(lang === "zh" ? "远行鞋" : "Boots of Travel")) {
      playSound(ITEM_BY_ID[item].sound, 0.85);
      return true;
    }
    return false;
  };

  const itemForKey = (key: string): ItemId | null => {
    const entry = Object.entries(config.itemKeys).find(([, value]) => value.toUpperCase() === key);
    return (entry?.[0] as ItemId | undefined) ?? null;
  };

  const handleItemKey = (key: string) => {
    const item = itemForKey(key);
    if (!item) return;
    const meta = ITEM_BY_ID[item];

    if (config.castMode === "instant" || meta.target === "instant") {
      if (performItemAction(item)) advancePlan({ type: "item", key, item });
      return;
    }

    if (item === "travel_boots") {
      const now = performance.now();
      const last = lastTravelPressRef.current;
      if (last && last.item === item && now - last.time <= 400) {
        lastTravelPressRef.current = null;
        setPendingItem(null);
        if (performItemAction(item)) advancePlan({ type: "item", key, item });
        return;
      }
      lastTravelPressRef.current = { item, time: now };
    }

    if (item !== "travel_boots") {
      lastTravelPressRef.current = null;
    }
    lastCataclysmPressRef.current = null;
    setPendingCast(null);
    setPendingItem({ item, key });
    setEvent(
      formatTemplate(t(item === "travel_boots" ? "event.travelDouble" : "event.pendingItem"), {
        item: lang === "zh" ? meta.nameZh : meta.nameEn,
        key,
      }),
    );
  };

  const itemForKeyRef = useRef(itemForKey);
  itemForKeyRef.current = itemForKey;
  const handleItemKeyRef = useRef(handleItemKey);
  handleItemKeyRef.current = handleItemKey;

  const spellForKey = (key: string): SpellId | null => {
    if (config.keybindMode === "legacy") {
      const entry = Object.entries(LEGACY_CAST_KEYS).find(([, value]) => value === key);
      return (entry?.[0] as SpellId | undefined) ?? null;
    }
    const slot = key === "D" ? 0 : key === "F" ? 1 : -1;
    if (slot < 0) return null;
    return stateRef.current.invokedSlots[slot];
  };

  const castKeyForSpell = (spell: SpellId): string => {
    if (config.keybindMode === "legacy") return LEGACY_CAST_KEYS[spell];
    const slot = stateRef.current.invokedSlots.indexOf(spell);
    return slot === 0 ? "D" : "F";
  };

  /** 处理施法按键：instant 直接释放，mouse 模式按技能类型进入待确认状态。 */
  const handleCastKey = (key: string) => {
    const spell = spellForKey(key);
    if (!spell) {
      setEvent(lang === "zh" ? `${key} 槽为空` : `${key} slot is empty`);
      return;
    }

    if (randomMode && config.castMode === "instant" && spell && randomHoveredSpellRef.current === spell) {
      lastCataclysmPressRef.current = null;
      setPendingCast(null);
      setPendingItem(null);
      const ok = castSpellAction(spell);
      setRandomStats((prev) => ({
        ...prev,
        attempts: prev.attempts + 1,
        valid: ok ? prev.valid + 1 : prev.valid,
      }));
      if (ok) {
        setRandomQuickCast({ id: Date.now(), spell });
      }
      return;
    }

    const canCataclysm = stateRef.current.aghanimsScepter && spell === "invoker_sun_strike" && config.castMode === "mouse";

    if (config.castMode === "mouse") {
      if (!randomMode && (spell === "invoker_ghost_walk" || spell === "invoker_ice_wall")) {
        setPendingCast(null);
        setPendingItem(null);
        lastTravelPressRef.current = null;
        if (castSpellAction(spell)) {
          if (!advancePlan({ type: "cast", key, spell })) reportWrongStep({ type: "cast", key, spell });
        }
        return;
      }

      if (canCataclysm) {
        const now = performance.now();
        const last = lastCataclysmPressRef.current;
        if (last && last.spell === CATACLYSM_ID && now - last.time <= 400) {
          lastCataclysmPressRef.current = null;
          setPendingCast(null);
          setPendingItem(null);
          if (performCataclysm()) {
            if (!advancePlan({ type: "cast", key, spell: CATACLYSM_ID })) reportWrongStep({ type: "cast", key, spell: CATACLYSM_ID });
          }
          return;
        }
        lastCataclysmPressRef.current = { spell: CATACLYSM_ID, time: now };
      } else {
        lastCataclysmPressRef.current = null;
      }

      const needsRightClick = spell === "invoker_forge_spirit";
      setPendingItem(null);
      lastTravelPressRef.current = null;
      setPendingCast({ spell, key });
      setEvent(
        formatTemplate(t(needsRightClick ? "event.pendingForge" : "event.pendingCast"), {
          spell: spellName(spell),
        }),
      );
      return;
    }

    lastCataclysmPressRef.current = null;
    if (castSpellAction(spell)) {
      if (!advancePlan({ type: "cast", key, spell })) reportWrongStep({ type: "cast", key, spell });
    }
  };

  const confirmCast = (button: "left" | "right") => {
    if (!pendingCast) return;
    const { spell, key } = pendingCast;
    if (spell === "invoker_forge_spirit") {
      if (button !== "right") {
        setPendingCast(null);
        setPendingItem(null);
        setEvent(t("event.castCancelled"));
        return;
      }
      if (castSpellAction(spell)) {
        if (!advancePlan({ type: "cast", key, spell })) reportWrongStep({ type: "cast", key, spell });
      }
    } else {
      if (button !== "left") {
        setPendingCast(null);
        setPendingItem(null);
        setEvent(t("event.castCancelled"));
        return;
      }
      if (castSpellAction(spell)) {
        if (!advancePlan({ type: "cast", key, spell })) reportWrongStep({ type: "cast", key, spell });
      }
    }
    setPendingCast(null);
    setPendingItem(null);
  };

  const confirmItem = (button: "left" | "right") => {
    if (!pendingItem) return;
    const { item, key } = pendingItem;
    if (button !== "left") {
      setPendingItem(null);
      lastTravelPressRef.current = null;
      setEvent(t("event.castCancelled"));
      return;
    }
    if (performItemAction(item)) advancePlan({ type: "item", key, item });
    setPendingItem(null);
  };

  const advancePlan = (expected: ExpectedStep): boolean => {
    const steps = planRef.current;
    const current = steps[currentStepRef.current];
    if (!current) return false;
    if (current.type !== expected.type || current.key !== expected.key) return false;
    if (current.type === "orb" && expected.type === "orb" && current.element !== expected.element) return false;
    if (current.type === "invoke" && expected.type === "invoke" && current.spell !== expected.spell) return false;
    if (current.type === "cast" && expected.type === "cast" && current.spell !== expected.spell) return false;
    if (current.type === "item" && expected.type === "item" && current.item !== expected.item) return false;

    const next = Math.min(currentStepRef.current + 1, steps.length);
    currentStepRef.current = next;
    setCurrentStep(next);
    if (next >= steps.length) {
      const fresh = createInitialState(config);
      commit(fresh);
      currentStepRef.current = 0;
      setCurrentStep(0);
      setPendingCast(null);
      setPendingItem(null);
      setEvent(
        lang === "zh"
          ? "连招完成，技能已刷新，可以再次练习"
          : "Combo complete. Cooldowns refreshed for another run",
      );
    }
    return true;
  };

  const reportWrongStep = (expected?: ExpectedStep) => {
    const steps = planRef.current;
    if (steps.length === 0) return;
    const current = steps[currentStepRef.current];
    if (!current) return;
    const sameType = current.type === expected?.type;
    const sameKey = current.key === expected?.key;
    if (sameType && sameKey) {
      setEvent(
        lang === "zh"
          ? "按键正确，但产生的技能与连招不符"
          : "Correct key, but the expected action was not produced",
      );
    } else {
      setEvent(
        lang === "zh"
          ? "按键不符合当前步骤"
          : "The pressed key does not match the current step",
      );
    }
  };

  const handleKeyDown = (key: string) => {
    if (key === "Q" || key === "W" || key === "E") {
      const element: ElementKind = key === "Q" ? "quas" : key === "W" ? "wex" : "exort";
      performElement(element);
      if (!advancePlan({ type: "orb", element, key })) reportWrongStep({ type: "orb", element, key });
      return;
    }
    if (key === "R") {
      const ok = performInvoke();
      if (!ok) return;
      const actual = stateRef.current.invokedSlots[0];
      if (actual && !advancePlan({ type: "invoke", key, spell: actual })) reportWrongStep({ type: "invoke", key, spell: actual });
      return;
    }
    if (Object.values(config.itemKeys).some((value) => value.toUpperCase() === key)) {
      handleItemKey(key);
      return;
    }
    if (
      (config.keybindMode === "qwer" && (key === "D" || key === "F")) ||
      (config.keybindMode === "legacy" && Object.values(LEGACY_CAST_KEYS).includes(key))
    ) {
      handleCastKey(key);
      return;
    }
  };

  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;

  const isQuickcastModifier = (modifiers: { alt: boolean; ctrl: boolean; shift: boolean }): boolean => {
    const modifier = config.quickcastModifier;
    return (
      (modifier === "Alt" && modifiers.alt) ||
      (modifier === "Ctrl" && modifiers.ctrl) ||
      (modifier === "Shift" && modifiers.shift)
    );
  };

  const handleQuickcastKey = (key: string): boolean => {
    const item = itemForKey(key);
    if (item === "travel_boots") {
      lastTravelPressRef.current = null;
      setPendingCast(null);
      setPendingItem(null);
      if (performItemAction(item)) advancePlan({ type: "item", key, item });
      return true;
    }

    const spell = spellForKey(key);
    if (randomMode && spell && randomHoveredSpellRef.current === spell) {
      lastCataclysmPressRef.current = null;
      setPendingCast(null);
      setPendingItem(null);
      const ok = castSpellAction(spell);
      setRandomStats((prev) => ({
        ...prev,
        attempts: prev.attempts + 1,
        valid: ok ? prev.valid + 1 : prev.valid,
      }));
      if (ok) {
        setRandomQuickCast({ id: Date.now(), spell });
      }
      return true;
    }

    if (spell === "invoker_sun_strike" && stateRef.current.aghanimsScepter) {
      lastCataclysmPressRef.current = null;
      setPendingCast(null);
      setPendingItem(null);
      if (performCataclysm()) {
        if (!advancePlan({ type: "cast", key, spell: CATACLYSM_ID })) reportWrongStep({ type: "cast", key, spell: CATACLYSM_ID });
      }
      return true;
    }

    return false;
  };

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  useGlobalInput({
    enabled: !settingsOpen,
    onHotkey: (key, modifiers) => {
      if (randomMode) {
        setRandomStats((prev) => ({ ...prev, keys: prev.keys + 1 }));
      }
      if (isQuickcastModifier(modifiers)) {
        return handleQuickcastKey(key);
      }
      if (modifiers.alt || modifiers.ctrl || modifiers.shift) return false;
      handleKeyDownRef.current(key);
      return true;
    },
    onMouseHotkey: (key) => {
      if (!itemForKeyRef.current(key)) return false;
      handleItemKeyRef.current(key);
      return true;
    },
    onEscape: () => {
      if (settingsOpen) {
        setSettingsOpen(false);
      } else {
        setPendingCast(null);
        setPendingItem(null);
        lastTravelPressRef.current = null;
        lastCataclysmPressRef.current = null;
      }
    },
  });

  const selectCombo = (combo: Combo) => {
    const needsAghs = combo.actions.some((action) => action.type === "cataclysm");
    const effectiveConfig = needsAghs && !config.aghanimsScepter
      ? { ...config, aghanimsScepter: true }
      : config;
    if (effectiveConfig !== config) {
      setConfig(effectiveConfig);
    }
    const fresh = createInitialState(effectiveConfig);
    commit(fresh);
    const computedPlan = planCombo(combo.actions, fresh.orbs, plannerOptions(effectiveConfig));
    planRef.current = computedPlan;
    currentStepRef.current = 0;
    setPendingCast(null);
    setPendingItem(null);
    setActiveCombo(combo);
    setPlan(computedPlan);
    setCurrentStep(0);
    const aghsNotice = effectiveConfig !== config
      ? lang === "zh" ? "，已自动开启阿哈利姆神杖" : ", Aghanim's Scepter enabled automatically"
      : "";
    setEvent(lang === "zh" ? `开始连招：${combo.nameZh}${aghsNotice}` : `Combo started: ${combo.nameEn}${aghsNotice}`);
  };

  const saveCustomCombo = (combo: Combo) => {
    setCombos((prev) => [...prev, combo]);
    selectCombo(combo);
  };

  const removeCustomCombo = (id: string) => {
    setCombos((prev) => prev.filter((combo) => combo.id !== id));
    if (activeCombo?.id === id) {
      setActiveCombo(null);
      planRef.current = [];
      currentStepRef.current = 0;
      setPlan([]);
      setCurrentStep(0);
      setPendingCast(null);
      setPendingItem(null);
    }
  };

  const applySettings = (nextConfig: GameConfig) => {
    setConfig(nextConfig);
    const next = createInitialState(nextConfig);
    commit(next);
    setPendingCast(null);
    setPendingItem(null);
    if (activeCombo) {
      const computedPlan = planCombo(activeCombo.actions, next.orbs, plannerOptions(nextConfig));
      planRef.current = computedPlan;
      currentStepRef.current = 0;
      setPlan(computedPlan);
      setCurrentStep(0);
    } else {
      planRef.current = [];
      currentStepRef.current = 0;
      setPlan([]);
      setCurrentStep(0);
    }
    setSettingsOpen(false);
    setEvent(lang === "zh" ? "设置已应用" : "Settings applied");
  };

  const toggleRandomMode = () => {
    if (!randomMode) {
      randomStartRef.current = performance.now();
      setRandomStats({ keys: 0, attempts: 0, valid: 0 });
      setRandomQuickCast(null);
      randomHoveredSpellRef.current = null;
      const next = {
        ...stateRef.current,
        invokeCooldown: 0,
        spellCooldowns: Object.fromEntries(
          Object.keys(stateRef.current.spellCooldowns).map((key) => [key, 0]),
        ) as InvokerState["spellCooldowns"],
        cataclysmCooldown: 0,
      };
      commit(next);
    }
    setRandomMode(!randomMode);
    setPendingCast(null);
    setPendingItem(null);
    lastTravelPressRef.current = null;
    lastCataclysmPressRef.current = null;
  };

  const handleRandomConfirm = (spell: SpellId): boolean => {
    if (!pendingCast || pendingCast.spell !== spell) {
      setRandomStats((prev) => ({ ...prev, attempts: prev.attempts + 1 }));
      return false;
    }
    const ok = castSpellAction(spell);
    setPendingCast(null);
    setPendingItem(null);
    setRandomStats((prev) => ({
      ...prev,
      attempts: prev.attempts + 1,
      valid: ok ? prev.valid + 1 : prev.valid,
    }));
    return ok;
  };

  const resetPractice = () => {
    const fresh = createInitialState(config);
    commit(fresh);
    setActiveCombo(null);
    setPendingCast(null);
    setPendingItem(null);
    planRef.current = [];
    currentStepRef.current = 0;
    setPlan([]);
    setCurrentStep(0);
    setEvent(t("event.welcome"));
  };

  const randomElapsedMinutes = randomStartRef.current ? (performance.now() - randomStartRef.current) / 60000 : 0;
  const randomApm = randomElapsedMinutes > 0 ? Math.round(randomStats.keys / randomElapsedMinutes) : 0;

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t("app.title")}</h1>
        <div className="header-actions">
          <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}>{t("app.language")}</button>
          <button className={randomMode ? "active" : ""} onClick={toggleRandomMode}>{t("app.randomMode")}</button>
          <button onClick={() => setSettingsOpen(true)}>{t("app.settings")}</button>
          <button onClick={resetPractice}>{t("app.reset")}</button>
          <button onClick={() => commit(resetDummy(stateRef.current))}>{t("app.dummyReset")}</button>
        </div>
      </header>

      <main className="main-layout">
        {randomMode ? (
          <RandomMode
            pendingCast={pendingCast}
            bubbleInterval={config.randomBubbleInterval}
            bubbleDuration={config.randomBubbleDuration}
            maxBubbles={config.randomMaxBubbles}
            totalKeys={randomStats.keys}
            totalAttempts={randomStats.attempts}
            validAttempts={randomStats.valid}
            apm={randomApm}
            quickCastEvent={randomQuickCast}
            onHoverChange={(spell) => {
              randomHoveredSpellRef.current = spell;
            }}
            onConfirm={handleRandomConfirm}
          />
        ) : (
          <>
            <PracticeArea
              state={state}
              event={event}
              mouseMode={config.castMode === "mouse"}
              pending={pendingCast !== null || pendingItem !== null}
              plan={plan}
              currentStep={currentStep}
              onLeftClick={() => {
                confirmCast("left");
                confirmItem("left");
              }}
              onRightClick={() => {
                confirmCast("right");
                confirmItem("right");
              }}
            />
            <ComboPanel
              combos={combos}
              activeCombo={activeCombo}
              previewOrbs={config.initialOrbs}
              previewOptions={plannerOptions(config)}
              onSelect={selectCombo}
              onSaveCustomCombo={saveCustomCombo}
              onRemoveCustomCombo={removeCustomCombo}
              aghanimsScepter={config.aghanimsScepter}
            />
          </>
        )}
      </main>

      <HUD
        state={state}
        keybindMode={config.keybindMode}
        itemKeys={config.itemKeys}
        pendingCast={pendingCast}
        pendingItem={pendingItem}
        aghanimsScepter={config.aghanimsScepter}
        onToggleAghanims={performToggleAghanims}
        onCastElement={(element) => {
          performElement(element);
          const key = element === "quas" ? "Q" : element === "wex" ? "W" : "E";
          if (!advancePlan({ type: "orb", element, key })) reportWrongStep({ type: "orb", element, key });
        }}
        onInvoke={() => {
          const ok = performInvoke();
          if (!ok) return;
          const actual = stateRef.current.invokedSlots[0];
          if (actual && !advancePlan({ type: "invoke", key: "R", spell: actual })) reportWrongStep({ type: "invoke", key: "R", spell: actual });
        }}
        onCastSpell={(spell) => {
          const key = castKeyForSpell(spell);
          handleCastKey(key);
        }}
        onUseItem={(item: ItemId) => {
          handleItemKey(config.itemKeys[item].toUpperCase());
        }}
      />

      {settingsOpen && (
        <SettingsPanel config={config} onApply={applySettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
