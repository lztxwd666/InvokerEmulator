import { describe, expect, it } from "vitest";
import { normalizeConfig, sanitizeItemKeys } from "./config";
import { DEFAULT_CONFIG } from "./invoker";
import { ITEMS } from "./spellData";

describe("sanitizeItemKeys", () => {
  it("保证物品快捷键不重复且避开技能键", () => {
    const keys = sanitizeItemKeys(
      { refresher: "5", sheepstick: "5", meteor_hammer: "D", travel_boots: "D" },
      "qwer",
    );
    const values = ITEMS.map((item) => keys[item.id]);
    expect(new Set(values).size).toBe(ITEMS.length);
    for (const value of values) {
      expect(["Q", "W", "E", "R", "D", "F"]).not.toContain(value);
    }
  });

  it("legacy 模式下把传统技能键作为保留键处理", () => {
    const keys = sanitizeItemKeys(
      { refresher: "5", sheepstick: "C", meteor_hammer: "X", travel_boots: "B" },
      "legacy",
    );
    const legacyReserved = ["Q", "W", "E", "R", "Y", "V", "G", "C", "X", "Z", "T", "F", "D", "B"];
    for (const item of ITEMS) {
      expect(legacyReserved).not.toContain(keys[item.id]);
    }
  });

  it("支持符号键和鼠标侧键快捷键", () => {
    const keys = sanitizeItemKeys(
      { refresher: "[", sheepstick: "Mouse4", meteor_hammer: "MB5", travel_boots: "M3" },
      "qwer",
    );
    expect(keys.refresher).toBe("[");
    expect(keys.sheepstick).toBe("MOUSE4");
    expect(keys.meteor_hammer).toBe("MOUSE5");
    expect(keys.travel_boots).toBe("MOUSE3");
    const xKeys = sanitizeItemKeys(
      { refresher: "XButton1", sheepstick: "XB2", meteor_hammer: "Back", travel_boots: "Forward" },
      "qwer",
    );
    expect(xKeys.refresher).toBe("MOUSE4");
    expect(xKeys.sheepstick).toBe("MOUSE5");
  });

  it("无效或重复的组合会自动回退为可用键", () => {
    const keys = sanitizeItemKeys(
      { refresher: "[", sheepstick: "[", meteor_hammer: "invalid", travel_boots: "M4" },
      "qwer",
    );
    const values = ITEMS.map((item) => keys[item.id]);
    expect(new Set(values).size).toBe(ITEMS.length);
    expect(values.every((value) => value !== "")).toBe(true);
  });
});

describe("normalizeConfig", () => {
  it("损坏或缺失字段时回退到默认配置", () => {
    const config = normalizeConfig({ heroLevel: 99, orbLevels: { quas: 3 } });
    expect(config.heroLevel).toBe(30);
    expect(config.orbLevels.wex).toBe(DEFAULT_CONFIG.orbLevels.wex);
    expect(config.orbLevels.exort).toBe(DEFAULT_CONFIG.orbLevels.exort);
    expect(config.castMode).toBe(DEFAULT_CONFIG.castMode);
    expect(config.comboMode).toBe(DEFAULT_CONFIG.comboMode);
  });

  it("非对象输入返回默认配置", () => {
    const config = normalizeConfig(null);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("空值数字字段回退到默认值", () => {
    const config = normalizeConfig({ dummyMaxMana: null, dummyMaxHp: "" });
    expect(config.dummyMaxMana).toBe(DEFAULT_CONFIG.dummyMaxMana);
    expect(config.dummyMaxHp).toBe(DEFAULT_CONFIG.dummyMaxHp);
  });

  it("过滤非法初始元素球", () => {
    const config = normalizeConfig({ initialOrbs: ["quas", "invalid", "wex", "exort", "wex", "quas"] });
    expect(config.initialOrbs).toEqual(["quas", "wex", "exort"]);
  });

  it("保留阿哈利姆神杖开关状态", () => {
    const config = normalizeConfig({ aghanimsScepter: true });
    expect(config.aghanimsScepter).toBe(true);
  });

  it("未开启神杖时元素等级上限为7，开启后允许8", () => {
    const without = normalizeConfig({ aghanimsScepter: false, orbLevels: { quas: 8, wex: 8, exort: 8 } });
    expect(without.orbLevels.quas).toBe(7);
    expect(without.orbLevels.wex).toBe(7);
    const withAghs = normalizeConfig({ aghanimsScepter: true, orbLevels: { quas: 8, wex: 8, exort: 8 } });
    expect(withAghs.orbLevels.quas).toBe(8);
  });
});
