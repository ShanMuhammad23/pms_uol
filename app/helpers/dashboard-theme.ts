import { useSyncExternalStore } from "react";

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getIsDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function getServerDarkMode() {
  return false;
}

export function useIsDarkMode() {
  return useSyncExternalStore(subscribeToTheme, getIsDarkMode, getServerDarkMode);
}
