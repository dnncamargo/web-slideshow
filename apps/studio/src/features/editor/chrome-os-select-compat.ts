import { useEffect, useState } from "react";

export function isChromeOsSelectEdgeSpacingUserAgent(userAgent: string): boolean {
  const isChrome = /Chrome\//.test(userAgent) && !/(Edg|OPR|Opera|Firefox)\//.test(userAgent);
  const isChromeOs = /CrOS/.test(userAgent);

  return isChrome && isChromeOs;
}

export function useChromeOsSelectEdgeSpacing(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isChromeOsSelectEdgeSpacingUserAgent(navigator.userAgent));
  }, []);

  return enabled;
}
