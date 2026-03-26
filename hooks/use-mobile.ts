import { useState, useEffect } from "react";

const DEFAULT_MOBILE_BREAKPOINT = 1280;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Dynamically read the threshold from globals.css at runtime
    const getBreakpoint = () => {
      const val = getComputedStyle(document.documentElement).getPropertyValue("--mobile-breakpoint");
      return parseInt(val) || DEFAULT_MOBILE_BREAKPOINT;
    };

    const threshold = getBreakpoint();
    const mql = window.matchMedia(`(max-width: ${threshold - 1}px)`);

    const onChange = () => {
      setIsMobile(window.innerWidth < threshold);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < threshold);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
