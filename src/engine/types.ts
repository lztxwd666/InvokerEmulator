/** 元素类型 */
export type ElementKind = "quas" | "wex" | "exort";

/** 祈唤技能标识 */
export type SpellId =
  | "invoker_cold_snap"
  | "invoker_ghost_walk"
  | "invoker_ice_wall"
  | "invoker_emp"
  | "invoker_tornado"
  | "invoker_alacrity"
  | "invoker_chaos_meteor"
  | "invoker_sun_strike"
  | "invoker_forge_spirit"
  | "invoker_deafening_blast";

/** 阿哈利姆神杖强化后的天火：毁天灭地 */
export type CataclysmId = "invoker_cataclysm";

/** 可执行的施法目标：普通技能或毁天灭地 */
export type CastableId = SpellId | CataclysmId;

/** 练习用物品标识 */
export type ItemId = "refresher" | "sheepstick" | "meteor_hammer" | "travel_boots";

/** 连招中的一步：施放技能或使用物品 */
export type ComboAction =
  | { type: "spell"; spell: SpellId }
  | { type: "cataclysm" }
  | { type: "item"; item: ItemId };

/** 内置/自定义连招，只保存技能和物品顺序，按键顺序由 planner 计算 */
export interface Combo {
  id: string;
  nameZh: string;
  nameEn: string;
  actions: ComboAction[];
}

/** 键位模式 */
export type KeybindMode = "qwer" | "legacy";

/** 施法模式：instant 按下即放，mouse 需要点击假人确认 */
export type CastMode = "instant" | "mouse";

/** 连招模式：instant 每技能切完即放，preload 预存两个技能后按 F/D 顺序释放 */
export type ComboMode = "instant" | "preload";

/** 训练设置 */
export interface GameConfig {
  configVersion: number;
  heroLevel: number;
  orbLevels: Record<ElementKind, number>;
  initialOrbs: ElementKind[];
  dummyMaxHp: number;
  dummyMaxMana: number;
  keybindMode: KeybindMode;
  itemKeys: Record<ItemId, string>;
  castMode: CastMode;
  comboMode: ComboMode;
  infiniteMana: boolean;
  muted: boolean;
  aghanimsScepter: boolean;
}

/** 规划出的实际按键步骤 */
export type PlanStep =
  | { type: "orb"; element: ElementKind; key: string }
  | { type: "invoke"; key: string; spell: SpellId }
  | { type: "cast"; key: string; spell: CastableId }
  | { type: "item"; key: string; item: ItemId };

/** 假人状态，0 抗性 */
export interface DummyState {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  lastHit?: string;
}

/** 练习器完整状态 */
export interface InvokerState {
  orbs: ElementKind[];
  orbLevels: Record<ElementKind, number>;
  heroLevel: number;
  /** 已祈唤技能槽，0 为 D，1 为 F */
  invokedSlots: (SpellId | null)[];
  spellCooldowns: Record<SpellId, number>;
  itemCooldowns: Record<ItemId, number>;
  invokeCooldown: number;
  mana: number;
  maxMana: number;
  hp: number;
  maxHp: number;
  infiniteMana: boolean;
  aghanimsScepter: boolean;
  cataclysmCooldown: number;
  dummy: DummyState;
  lastEvent?: string;
}
