import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { Combo, ComboAction, GameConfig } from "./types";
import { DEFAULT_COMBOS, ITEM_BY_ID, SPELL_BY_ID } from "./spellData";
import { normalizeConfig } from "./config";

export const STORAGE_KEY = "invoker_custom_combos";
export const CONFIG_KEY = "invoker_config";

export async function loadPersistedConfig(): Promise<GameConfig> {
  try {
    if ("__TAURI_INTERNALS__" in window) {
      const raw = await tauriInvoke<string | null>("load_config");
      if (raw) return normalizeConfig(JSON.parse(raw));
    }
  } catch {
    // 文件读取失败时回退到 localStorage
  }
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return normalizeConfig(JSON.parse(raw));
  } catch {
    // localStorage 不可用时使用默认配置
  }
  return normalizeConfig(null);
}

function isComboAction(value: unknown): value is ComboAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<ComboAction>;
  if (action.type === "spell") {
    return typeof action.spell === "string" && Object.prototype.hasOwnProperty.call(SPELL_BY_ID, action.spell);
  }
  if (action.type === "item") {
    return typeof action.item === "string" && Object.prototype.hasOwnProperty.call(ITEM_BY_ID, action.item);
  }
  if (action.type === "cataclysm") return true;
  return false;
}

function isCombo(value: unknown): value is Combo {
  if (!value || typeof value !== "object") return false;
  const combo = value as Partial<Combo>;
  return (
    typeof combo.id === "string" &&
    typeof combo.nameZh === "string" &&
    typeof combo.nameEn === "string" &&
    Array.isArray(combo.actions) &&
    combo.actions.every(isComboAction)
  );
}

export function loadCombos(): Combo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(isCombo);
        if (valid.length > 0) return valid;
      }
    }
  } catch {
    // 旧版本或存储不可用时回退到内置连招
  }
  return DEFAULT_COMBOS;
}
