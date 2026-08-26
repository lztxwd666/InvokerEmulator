import { useEffect, useRef } from "react";

function mouseButtonHotkey(button: number): string | null {
  if (button === 1) return "MOUSE3";
  if (button === 3) return "MOUSE4";
  if (button === 4) return "MOUSE5";
  return null;
}

interface UseGlobalInputOptions {
  enabled: boolean;
  onHotkey: (key: string, modifiers: { alt: boolean; ctrl: boolean; shift: boolean }) => boolean;
  onMouseHotkey: (key: string) => boolean;
  onEscape: () => void;
}

/** 全局键盘与鼠标侧键输入。通过 ref 保持回调最新，避免重复绑定事件。 */
export function useGlobalInput({
  enabled,
  onHotkey,
  onMouseHotkey,
  onEscape,
}: UseGlobalInputOptions) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onHotkeyRef = useRef(onHotkey);
  onHotkeyRef.current = onHotkey;
  const onMouseHotkeyRef = useRef(onMouseHotkey);
  onMouseHotkeyRef.current = onMouseHotkey;
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.metaKey) return;
      if (e.key === "Escape") {
        onEscapeRef.current();
        return;
      }
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = e.key.length === 1 ? e.key.toUpperCase() : "";
      if (key) {
        if (onHotkeyRef.current(key, { alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey })) {
          e.preventDefault();
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const hotkey = mouseButtonHotkey(e.button);
      if (!hotkey) return;
      if (!e.defaultPrevented) {
        // 仅在调用方实际处理时阻止默认侧键导航，由调用方决定。
      }
      if (onMouseHotkeyRef.current(hotkey)) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, []);
}
