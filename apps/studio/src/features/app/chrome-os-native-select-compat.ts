import { useEffect, useState } from "react";

export function isChromeOsNativeSelectCompatUserAgent(userAgent: string): boolean {
  const isChrome = /Chrome\//.test(userAgent) && !/(Edg|OPR|Opera|Firefox)\//.test(userAgent);
  const isChromeOs = /CrOS/.test(userAgent);

  return isChrome && isChromeOs;
}

export function useChromeOsNativeSelectCompat(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isChromeOsNativeSelectCompatUserAgent(navigator.userAgent));
  }, []);

  return enabled;
}
