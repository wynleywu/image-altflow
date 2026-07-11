"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  readStoredTheme,
  THEME_CYCLE,
  type ThemePreference,
  writeStoredTheme,
} from "@/lib/theme";

const LABELS: Record<ThemePreference, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
};

function ThemeIcon({ pref }: { pref: ThemePreference }) {
  if (pref === "dark") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (pref === "system") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 20h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 17v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.05 5.05l1.55 1.55M17.4 17.4l1.55 1.55M5.05 18.95l1.55-1.55M17.4 6.6l1.55-1.55"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = readStoredTheme();
    setPref(initial);
    applyTheme(initial);
    setReady(true);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = readStoredTheme();
      if (current === "system") applyTheme("system");
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  function select(next: ThemePreference) {
    setPref(next);
    writeStoredTheme(next);
    applyTheme(next);
  }

  const activeIndex = THEME_CYCLE.indexOf(pref);

  return (
    <div className="theme-toggle" data-ready={ready ? "true" : "false"}>
      <span
        className="theme-toggle-thumb"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden="true"
      />
      {THEME_CYCLE.map((t) => (
        <button
          key={t}
          type="button"
          className={`theme-toggle-btn${t === pref ? " is-active" : ""}`}
          onClick={() => select(t)}
          aria-label={`主题：${LABELS[t]}`}
          aria-pressed={t === pref}
          title={LABELS[t]}
        >
          <ThemeIcon pref={t} />
        </button>
      ))}
    </div>
  );
}
