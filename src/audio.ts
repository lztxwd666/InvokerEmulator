import type { ElementKind } from "./engine/types";

/** 音频缓存，避免多次创建 Audio 对象 */
const cache = new Map<string, HTMLAudioElement>();
let muted = false;

export function setMuted(next: boolean): void {
  muted = next;
}

/** 播放 assets/audio/invoker 下的音频文件。rate 可用于轻微区分同类音效。 */
export function playSound(file: string, volume = 0.9, rate = 1): void {
  if (muted) return;
  const path = `audio/invoker/${file}`;
  let audio = cache.get(path);
  if (!audio) {
    audio = new Audio(path);
    cache.set(path, audio);
  }
  audio.volume = volume;
  audio.playbackRate = rate;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // 未允许自动播放时静默忽略
  });
}

/** 切球使用 Dota 2 官方 UI 技能点击音，并通过轻微变速区分冰雷火。 */
export function playOrbSwitch(element: ElementKind): void {
  const rate = element === "quas" ? 0.94 : element === "wex" ? 1.06 : 1.18;
  playSound("ui_ability_click.mp3", 0.55, rate);
}
