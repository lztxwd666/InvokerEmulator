import { useEffect, useRef, useState } from "react";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { Combo, ElementKind, GameConfig, InvokerState, ItemId, PlanStep, SpellId } from "./engine/types";
import {
  castElement,
  castSpell,
  createInitialState,
  invoke,
  resetDummy,
  tick,
  useItem,
  DEFAULT_CONFIG,
} from "./engine/invoker";
import { DEFAULT_COMBOS, ITEM_BY_ID, LEGACY_CAST_KEYS, SPELL_BY_ID } from "./engine/spellData";
import { planCombo } from "./engine/planner";
import { HUD } from "./components/HUD";
import { ComboPanel } from "./components/ComboPanel";
import { PracticeArea } from "./components/PracticeArea";
import { SettingsPanel } from "./components/SettingsPanel";
import { playOrbSwitch, playSound, setMuted } from "./audio";
import { formatTemplate, useI18n } from "./i18n";

const STORAGE_KEY = "invoker_custom_combos";
const CONFIG_KEY = "invoker_config";

function normalizeConfig(parsed: Partial<GameConfig> | null): GameConfig {
  if (!parsed || typeof parsed.heroLevel !== "number") return DEFAULT_CONFIG;
  const merged = { ...DEFAULT_CONFIG, ...parsed, configVersion: DEFAULT_CONFIG.configVersion };
  if (parsed.configVersion !== DEFAULT_CONFIG.configVersion) {
    // 旧版配置缺少新增字段时，使用新版的推荐默认值
    merged.castMode = DEFAULT_CONFIG.castMode;
    merged.comboMode = DEFAULT_CONFIG.comboMode;
    merged.itemKeys = DEFAULT_CONFIG.itemKeys;
    merged.muted = DEFAULT_CONFIG.muted;
    merged.initialOrbs = DEFAULT_CONFIG.initialOrbs;
  }
  if (merged.keybindMode === "legacy") {
    // 传统键位下避免物品键与技能施法键冲突
    const reserved = new Set(["Q", "W", "E", "R", ...Object.values(LEGACY_CAST_KEYS)]);
    const fallbacks = { refresher: "5", sheepstick: "1", meteor_hammer: "2", travel_boots: "3" };
    for (const item of Object.keys(merged.itemKeys) as (keyof typeof merged.itemKeys)[]) {
      if (reserved.has(merged.itemKeys[item].toUpperCase())) {
        merged.itemKeys[item] = fallbacks[item];
      }
    }
  }
  return merged;
}

async function loadPersistedConfig(): Promise<GameConfig> {
  try {
    if ("__TAURI_INTERNALS__" in window) {
      const raw = await tauriInvoke<string | null>("load_config");
      if (raw) return normalizeConfig(JSON.parse(raw) as Partial<GameConfig>);
    }
  } catch {
    // 文件读取失败时回退到 localStorage
  }
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return normalizeConfig(JSON.parse(raw) as Partial<GameConfig>);
  } catch {
    // localStorage 不可用时使用默认配置
  }
  return DEFAULT_CONFIG;
}

function loadCombos(): Combo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Combo[];
      if (Array.isArray(parsed) && parsed.every((c) => Array.isArray(c.actions) && typeof c.nameZh === "string" && typeof c.nameEn === "string")) {
        return parsed;
      }
    }
  } catch {
    // 旧版本或存储不可用时回退到内置连招
  }
  return DEFAULT_COMBOS;
}

type ExpectedStep =
  | { type: "orb"; element: ElementKind; key: string }
  | { type: "invoke"; key: string; spell: SpellId }
  | { type: "cast"; key: string; spell: SpellId }
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
  const [pendingCast, setPendingCast] = useState<{ spell: SpellId; key: string } | null>(null);
  const [pendingItem, setPendingItem] = useState<{ item: ItemId; key: string } | null>(null);
  const lastTravelPressRef = useRef<{ item: ItemId; time: number } | null>(null);

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
    setEvent(result.event ?? "");
    playOrbSwitch(element);
  };

  const performInvoke = (): boolean => {
    const result = invoke(stateRef.current, lang);
    commit(result.state);
    setPendingCast(null);
    setPendingItem(null);
    lastTravelPressRef.current = null;
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
    const result = castSpell(stateRef.current, spell, lang);
    commit(result.state);
    setEvent(result.event ?? "");
    const prefix = lang === "zh" ? "释放" : "Cast";
    if (result.event?.startsWith(prefix)) {
      playSound(SPELL_BY_ID[spell].sound, 0.8);
      return true;
    }
    return false;
  };

  const performItemAction = (item: ItemId): boolean => {
    const result = useItem(stateRef.current, item, lang);
    commit(result.state);
    setPendingCast(null);
    setPendingItem(null);
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

    setPendingCast(null);
    setPendingItem({ item, key });
    setEvent(
      formatTemplate(t(item === "travel_boots" ? "event.travelDouble" : "event.pendingItem"), {
        item: lang === "zh" ? meta.nameZh : meta.nameEn,
        key,
      }),
    );
  };

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

    if (config.castMode === "mouse") {
      if (spell === "invoker_ghost_walk" || spell === "invoker_ice_wall") {
        if (castSpellAction(spell)) {
          if (!advancePlan({ type: "cast", key, spell })) reportWrongStep();
        }
        return;
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

    if (castSpellAction(spell)) {
      if (!advancePlan({ type: "cast", key, spell })) reportWrongStep();
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
        if (!advancePlan({ type: "cast", key, spell })) reportWrongStep();
      }
    } else {
      if (button !== "left") {
        setPendingCast(null);
    setPendingItem(null);
        setEvent(t("event.castCancelled"));
        return;
      }
      if (castSpellAction(spell)) {
        if (!advancePlan({ type: "cast", key, spell })) reportWrongStep();
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

  const reportWrongStep = () => {
    if (planRef.current.length === 0) return;
    setEvent(lang === "zh" ? "按键正确，但产生的技能与连招不符" : "Correct key, but the expected action was not produced");
  };

  const handleKeyDown = (key: string) => {
    if (key === "Q" || key === "W" || key === "E") {
      const element: ElementKind = key === "Q" ? "quas" : key === "W" ? "wex" : "exort";
      performElement(element);
      if (!advancePlan({ type: "orb", element, key })) reportWrongStep();
      return;
    }
    if (key === "R") {
      const ok = performInvoke();
      if (!ok) return;
      const actual = stateRef.current.invokedSlots[0];
      if (actual && !advancePlan({ type: "invoke", key, spell: actual })) reportWrongStep();
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

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z0-9]$/.test(key)) {
        e.preventDefault();
        handleKeyDownRef.current(key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectCombo = (combo: Combo) => {
    const fresh = createInitialState(config);
    commit(fresh);
    const computedPlan = planCombo(combo.actions, fresh.orbs, plannerOptions(config));
    planRef.current = computedPlan;
    currentStepRef.current = 0;
    setPendingCast(null);
    setPendingItem(null);
    setActiveCombo(combo);
    setPlan(computedPlan);
    setCurrentStep(0);
    setEvent(lang === "zh" ? `开始连招：${combo.nameZh}` : `Combo started: ${combo.nameEn}`);
  };

  const saveCustomCombo = (combo: Combo) => {
    setCombos((prev) => [...prev, combo]);
    selectCombo(combo);
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t("app.title")}</h1>
        <div className="header-actions">
          <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}>{t("app.language")}</button>
          <button onClick={() => setSettingsOpen(true)}>{t("app.settings")}</button>
          <button onClick={resetPractice}>{t("app.reset")}</button>
          <button onClick={() => commit(resetDummy(stateRef.current))}>{t("app.dummyReset")}</button>
        </div>
      </header>

      <main className="main-layout">
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
        />
      </main>

      <HUD
        state={state}
        keybindMode={config.keybindMode}
        itemKeys={config.itemKeys}
        pendingCast={pendingCast}
        pendingItem={pendingItem}
        onCastElement={(element) => {
          performElement(element);
          const key = element === "quas" ? "Q" : element === "wex" ? "W" : "E";
          if (!advancePlan({ type: "orb", element, key })) reportWrongStep();
        }}
        onInvoke={() => {
          const ok = performInvoke();
          if (!ok) return;
          const actual = stateRef.current.invokedSlots[0];
          if (actual && !advancePlan({ type: "invoke", key: "R", spell: actual })) reportWrongStep();
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
