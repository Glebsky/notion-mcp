import { useEffect, useState } from "react";
const interfaceKey = "mcp-terminal-animation";
const backgroundKey = "mcp-terminal-background-animation";
function stored(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function persist(key: string, enabled: boolean) { try { localStorage.setItem(key, String(enabled)); } catch { /* Storage may be disabled by the OS. */ } }
export function useMotionPreferences() {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [animation, setAnimation] = useState(() => { const value = stored(interfaceKey); return value === null ? !window.matchMedia("(prefers-reduced-motion: reduce)").matches : value === "true"; });
  const [backgroundAnimation, setBackgroundAnimation] = useState(() => {
    // Existing users who disabled all motion keep both preferences disabled.
    const value = stored(backgroundKey) ?? stored(interfaceKey);
    return value === null ? !window.matchMedia("(prefers-reduced-motion: reduce)").matches : value === "true";
  });
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  useEffect(() => { persist(interfaceKey, animation); document.documentElement.dataset["interfaceMotion"] = animation && !reducedMotion ? "on" : "off"; }, [animation, reducedMotion]);
  useEffect(() => { persist(backgroundKey, backgroundAnimation); }, [backgroundAnimation]);
  return { animation, setAnimation, backgroundAnimation, setBackgroundAnimation, reducedMotion, interfaceMotion: animation && !reducedMotion, backgroundMotion: backgroundAnimation && !reducedMotion };
}
