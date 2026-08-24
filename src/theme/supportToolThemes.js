export const SUPPORT_TOOL_THEMES = {
  adhd_focus: {
    background: "#F8F8F5", surface: "#FFFFFF", surfaceStrong: "#E7EDF4",
    primary: "#406D9F", primaryHover: "#315881", accent: "#A96824",
    text: "#202C36", textMuted: "#62707C", border: "#C6D0DB",
    focusRing: "#235D98", success: "#2F7A55", warning: "#946200", danger: "#B42318",
  },
  depression_gentle: {
    background: "#F4FAF5", surface: "#FFFFFF", surfaceStrong: "#E1F0E4",
    primary: "#3F7654", primaryHover: "#2F6142", accent: "#6B8C70",
    text: "#26372C", textMuted: "#607165", border: "#C9DDCD",
    focusRing: "#3F7654", success: "#2F7A55", warning: "#946200", danger: "#B42318",
  },
  depression_reflection: {
    background: "#F4FAF5", surface: "#FFFFFF", surfaceStrong: "#E1F0E4",
    primary: "#3F7654", primaryHover: "#2F6142", accent: "#6B8C70",
    text: "#26372C", textMuted: "#607165", border: "#C9DDCD",
    focusRing: "#3F7654", success: "#2F7A55", warning: "#946200", danger: "#B42318",
  },
};

export const SUPPORT_TOOL_THEME_BY_MODULE = {
  "support.task_breakdown": "adhd_focus",
  "support.focus_session": "adhd_focus",
  "support.visual_timeline": "adhd_focus",
  "support.mood_checkin": "adhd_focus",
  "support.accountability_session": "adhd_focus",
  "support.gentle_activity": "depression_gentle",
  "support.grounding": "depression_gentle",
  "support.social_connection": "depression_gentle",
  "support.cognitive_reframing": "depression_reflection",
  "support.evidence_journal": "depression_reflection",
};

export function resolveSupportToolTheme(recommendedTheme, override) {
  if (override === "neutral") return null;
  return SUPPORT_TOOL_THEMES[override] ? override : SUPPORT_TOOL_THEMES[recommendedTheme] ? recommendedTheme : null;
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function supportToolThemeContrastChecks() {
  return Object.entries(SUPPORT_TOOL_THEMES).map(([themeId, theme]) => ({
    themeId,
    textOnBackground: contrastRatio(theme.text, theme.background),
    mutedOnBackground: contrastRatio(theme.textMuted, theme.background),
    primaryOnSurface: contrastRatio(theme.primary, theme.surface),
    focusOnSurface: contrastRatio(theme.focusRing, theme.surface),
  }));
}
