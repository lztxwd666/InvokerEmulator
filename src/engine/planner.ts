import type { CastableId, ComboAction, ComboMode, ElementKind, ItemId, KeybindMode, PlanStep, SpellId } from "./types";
import { CATACLYSM_ID, CATACLYSM_META, LEGACY_CAST_KEYS, SPELL_BY_ID } from "./spellData";

interface Transition {
  source: ElementKind[];
  presses: ElementKind[];
  target: ElementKind[];
}

interface LayerState {
  orbs: ElementKind[];
  cost: number;
  prevIndex: number;
  transition: Transition | null;
}

export interface PlannerOptions {
  keybindMode: KeybindMode;
  itemKeys: Record<ItemId, string>;
  comboMode: ComboMode;
}

function key(orbs: ElementKind[]): string {
  return orbs.join(",");
}

function press(current: ElementKind[], element: ElementKind): ElementKind[] {
  if (current.length < 3) return [...current, element];
  return [current[1], current[2], element];
}

/** 生成目标三球的所有不重复排列。球序不影响祈唤，但会影响后续替换路径。 */
function arrangements(orbs: ElementKind[]): ElementKind[][] {
  const result: ElementKind[][] = [];
  const used = new Set<number>();

  const walk = (path: ElementKind[]) => {
    if (path.length === orbs.length) {
      if (!result.some((x) => key(x) === key(path))) {
        result.push([...path]);
      }
      return;
    }
    for (let i = 0; i < orbs.length; i += 1) {
      if (used.has(i)) continue;
      used.add(i);
      walk([...path, orbs[i]]);
      used.delete(i);
    }
  };

  walk([]);
  return result;
}

/** BFS 到目标精确球序，路径长度最多 3。 */
function findTransition(source: ElementKind[], target: ElementKind[]): Transition {
  const queue: { orbs: ElementKind[]; presses: ElementKind[] }[] = [
    { orbs: source, presses: [] },
  ];
  const seen = new Set<string>([key(source)]);
  const elements: ElementKind[] = ["quas", "wex", "exort"];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (key(node.orbs) === key(target)) {
      return { source, presses: node.presses, target: node.orbs };
    }
    for (const element of elements) {
      const next = press(node.orbs, element);
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ orbs: next, presses: [...node.presses, element] });
    }
  }

  return { source, presses: [], target: source };
}

function actionUnderlyingSpell(action: ComboAction): SpellId | null {
  if (action.type === "spell") return action.spell;
  if (action.type === "cataclysm") return CATACLYSM_META.underlyingSpell;
  return null;
}

function actionCastId(action: ComboAction): CastableId | null {
  if (action.type === "spell") return action.spell;
  if (action.type === "cataclysm") return CATACLYSM_ID;
  return null;
}

function isSpellLikeAction(action: ComboAction): boolean {
  return action.type === "spell" || action.type === "cataclysm";
}

/**
 * 全局最优规划：DP 遍历每个技能的目标排列，保证整段连招的元素按键总数最少。
 */
export function planCombo(
  actions: ComboAction[],
  initialOrbs: ElementKind[],
  options: PlannerOptions,
): PlanStep[] {
  let layers: LayerState[][] = [
    [{ orbs: [...initialOrbs], cost: 0, prevIndex: -1, transition: null }],
  ];

  for (const action of actions) {
    if (action.type === "item") {
      const current = layers[layers.length - 1];
      layers.push(
        current.map((state, index) => ({
          orbs: [...state.orbs],
          cost: state.cost,
          prevIndex: index,
          transition: null,
        })),
      );
      continue;
    }

    const underlying = actionUnderlyingSpell(action);
    if (!underlying) continue;
    const meta = SPELL_BY_ID[underlying];
    const targets = arrangements(meta.combination);
    const current = layers[layers.length - 1];
    const nextLayer: LayerState[] = [];

    for (const target of targets) {
      let best: LayerState | null = null;
      for (let i = 0; i < current.length; i += 1) {
        const state = current[i];
        const transition = findTransition(state.orbs, target);
        const cost = state.cost + transition.presses.length;
        if (!best || cost < best.cost) {
          best = { orbs: target, cost, prevIndex: i, transition };
        }
      }
      nextLayer.push(best!);
    }

    layers.push(nextLayer);
  }

  const last = layers[layers.length - 1];
  let bestIndex = 0;
  for (let i = 1; i < last.length; i += 1) {
    if (last[i].cost < last[bestIndex].cost) bestIndex = i;
  }

  const transitions: (Transition | null)[] = [];
  let layerIndex = layers.length - 1;
  let stateIndex = bestIndex;
  while (layerIndex > 0) {
    const state = layers[layerIndex][stateIndex];
    transitions.unshift(state.transition);
    stateIndex = state.prevIndex;
    layerIndex -= 1;
  }

  const steps: PlanStep[] = [];
  const preloaded: CastableId[] = [];
  const simulatedSlots: (SpellId | null)[] = [null, null];
  let initialPreloadDone = false;
  let refreshActive = false;
  let refreshedSlots = new Set<number>();
  let refreshedSlotCount = 0;
  let preparedSpellIndex = -1;

  const pushOrbSteps = (index: number) => {
    const transition = transitions[index];
    if (!transition) return;
    for (const element of transition.presses) {
      const k = element === "quas" ? "Q" : element === "wex" ? "W" : "E";
      steps.push({ type: "orb", element, key: k });
    }
  };

  const pushInvoke = (spell: SpellId) => {
    steps.push({ type: "invoke", key: "R", spell });
    simulatedSlots[1] = simulatedSlots[0];
    simulatedSlots[0] = spell;
  };

  const pushCast = (spell: CastableId, standardKey: "D" | "F" = "D") => {
    const k = options.keybindMode === "legacy"
      ? spell === CATACLYSM_ID ? CATACLYSM_META.legacyKey : LEGACY_CAST_KEYS[spell as SpellId]
      : standardKey;
    steps.push({ type: "cast", key: k, spell });
  };

  const findNextSpellIndex = (from: number): number => {
    for (let i = from + 1; i < actions.length; i += 1) {
      if (isSpellLikeAction(actions[i])) return i;
    }
    return -1;
  };

  const nextSpellNeedsOrbs = (from: number, targetIndex: number): boolean => {
    if (targetIndex < 0) return false;
    let hasRefresher = false;
    for (let k = from + 1; k < targetIndex; k += 1) {
      const actionBetween = actions[k];
      if (actionBetween.type === "item" && actionBetween.item === "refresher") {
        hasRefresher = true;
        break;
      }
    }
    if (!hasRefresher) return true;
    const target = actions[targetIndex];
    if (!isSpellLikeAction(target)) return true;
    const underlying = actionUnderlyingSpell(target);
    // 刷新球后的目标若还在 D/F 槽中，会直接释放，不需要预切
    return !underlying || simulatedSlots.indexOf(underlying) < 0;
  };

  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    if (action.type === "item") {
      steps.push({ type: "item", key: options.itemKeys[action.item], item: action.item });
      if (action.item === "refresher") {
        refreshActive = true;
        refreshedSlots = new Set<number>();
        refreshedSlotCount = simulatedSlots.filter((slot) => slot !== null).length;
      }
      continue;
    }

    const castId = actionCastId(action);
    const underlying = actionUnderlyingSpell(action);
    if (!castId || !underlying) continue;

    // 刷新球后，已祈唤技能仍在 D/F 槽中，直接释放，不重新切球和祈唤
    if (refreshActive) {
      const slotIndex = simulatedSlots.indexOf(underlying);
      if (slotIndex >= 0 && !refreshedSlots.has(slotIndex)) {
        pushCast(castId, slotIndex === 0 ? "D" : "F");
        refreshedSlots.add(slotIndex);
        if (refreshedSlots.size >= refreshedSlotCount) refreshActive = false;
        continue;
      }
    }

    if (preparedSpellIndex !== i) {
      pushOrbSteps(i);
    }
    pushInvoke(underlying);
    if (refreshActive) refreshActive = false;

    if (options.comboMode === "instant") {
      pushCast(castId);
      continue;
    }

    const nextSpellIndex = findNextSpellIndex(i);
    if (!initialPreloadDone && preloaded.length < 2) {
      preloaded.push(castId);
      if (preloaded.length === 1) continue;

      // 预存两个技能后，若下一个技能需要新祈唤，则预切它的球
      if (nextSpellNeedsOrbs(i, nextSpellIndex)) {
        pushOrbSteps(nextSpellIndex);
        preparedSpellIndex = nextSpellIndex;
      }
      pushCast(preloaded[0], "F");
      pushCast(preloaded[1], "D");
      preloaded.length = 0;
      initialPreloadDone = true;
      continue;
    }

    // 后续技能：先立即释放当前技能，再预切下一个需要新祈唤的技能
    pushCast(castId);
    if (
      nextSpellIndex >= 0 &&
      preparedSpellIndex !== nextSpellIndex &&
      nextSpellNeedsOrbs(i, nextSpellIndex)
    ) {
      pushOrbSteps(nextSpellIndex);
      preparedSpellIndex = nextSpellIndex;
    }
  }

  if (preloaded.length === 1) {
    pushCast(preloaded[0]);
    preloaded.length = 0;
  }

  return steps;
}
