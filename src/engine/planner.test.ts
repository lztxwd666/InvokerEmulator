import { describe, expect, it } from "vitest";
import { planCombo } from "./planner";
import type { ComboAction } from "./types";
import { spellFromOrbs, SPELLS } from "./spellData";
import { createInitialState, castElement, invoke, DEFAULT_CONFIG } from "./invoker";
import type { ElementKind } from "./types";

describe("spellFromOrbs", () => {
  it("识别全部十个祈唤技能", () => {
    for (const meta of SPELLS) {
      expect(spellFromOrbs(meta.combination)).toBe(meta.id);
    }
  });
});

describe("planCombo 球序继承", () => {
  it("初始 eee 时只补必要元素", () => {
    const plan = planCombo(
      [
        { type: "spell", spell: "invoker_sun_strike" },
        { type: "spell", spell: "invoker_chaos_meteor" },
        { type: "spell", spell: "invoker_ghost_walk" },
      ],
      ["exort", "exort", "exort"],
      { keybindMode: "qwer", itemKeys: { refresher: "5", sheepstick: "Z", meteor_hammer: "X", travel_boots: "C" }, comboMode: "instant" },
    );
    const orbKeys = plan.filter((s) => s.type === "orb").map((s) => s.key);
    expect(orbKeys).toEqual(["W", "Q", "Q"]);
  });
});

describe("快速输入", () => {
  it("连续切换后能立即祈唤 QWE", () => {
    let state = createInitialState({ ...DEFAULT_CONFIG, initialOrbs: [] });
    for (const element of ["quas", "wex", "exort"] as ElementKind[]) {
      state = castElement(state, element).state;
    }
    const result = invoke(state);
    expect(result.state.invokedSlots[0]).toBe("invoker_deafening_blast");
  });
});

describe("planCombo 连招模式", () => {
  const actions: ComboAction[] = [
    { type: "spell", spell: "invoker_tornado" },
    { type: "spell", spell: "invoker_emp" },
    { type: "spell", spell: "invoker_chaos_meteor" },
  ];

  it("preload 模式先预存两个技能，再 F/D 释放", () => {
    const plan = planCombo(actions, ["exort", "exort", "exort"], {
      keybindMode: "qwer",
      itemKeys: { refresher: "5", sheepstick: "Z", meteor_hammer: "X", travel_boots: "C" },
      comboMode: "preload",
    });
    const castKeys = plan.filter((s) => s.type === "cast").map((s) => s.key);
    expect(castKeys).toEqual(["F", "D", "D"]);
  });

  it("preload 模式会在释放前预切下一个技能的球", () => {
    const plan = planCombo(actions, ["exort", "exort", "exort"], {
      keybindMode: "qwer",
      itemKeys: { refresher: "5", sheepstick: "Z", meteor_hammer: "X", travel_boots: "C" },
      comboMode: "preload",
    });
    const firstCast = plan.findIndex((s) => s.type === "cast");
    const orbStepsBeforeFirstCast = plan
      .slice(0, firstCast)
      .filter((s) => s.type === "orb");
    expect(orbStepsBeforeFirstCast.some((s) => s.type === "orb" && s.element === "exort")).toBe(true);
  });

  it("legacy 模式使用每个技能的传统施法键", () => {
    const plan = planCombo(actions, ["exort", "exort", "exort"], {
      keybindMode: "legacy",
      itemKeys: { refresher: "5", sheepstick: "Z", meteor_hammer: "X", travel_boots: "C" },
      comboMode: "instant",
    });
    const castKeys = plan.filter((s) => s.type === "cast").map((s) => s.key);
    expect(castKeys).toEqual(["X", "C", "D"]);
  });
});
