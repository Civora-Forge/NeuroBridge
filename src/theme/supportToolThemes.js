export const SUPPORT_TOOL_THEMES = {
  adhd_focus: {
    background: "#F8F4EC", surface: "#FFFDF8", surfaceStrong: "#F1ECE4",
    primary: "#3D3A35", primaryHover: "#272521", accent: "#C0C0C0",
    text: "#33302B", textMuted: "#625E57", border: "#DDD5C9",
    focusRing: "#3D3A35", success: "#6D9F46", warning: "#946200", danger: "#B42318",
  },
  depression_gentle: {
    background: "#F2FFF5", surface: "#FFFFFF", surfaceStrong: "#DCFCE7",
    primary: "#15803D", primaryHover: "#166534", accent: "#86D89A",
    text: "#173D26", textMuted: "#466B50", border: "#BDECC8",
    focusRing: "#15803D", success: "#15803D", warning: "#946200", danger: "#B42318",
  },
  depression_reflection: {
    background: "#F2FFF5", surface: "#FFFFFF", surfaceStrong: "#DCFCE7",
    primary: "#15803D", primaryHover: "#166534", accent: "#86D89A",
    text: "#173D26", textMuted: "#466B50", border: "#BDECC8",
    focusRing: "#15803D", success: "#15803D", warning: "#946200", danger: "#B42318",
  },
  asd_social: {
    background: "#F0FAF7", surface: "#FFFFFF", surfaceStrong: "#D5F5EC",
    primary: "#0D9488", primaryHover: "#0F766E", accent: "#5EEAD4",
    text: "#134E4A", textMuted: "#5F8A87", border: "#B2DFDB",
    focusRing: "#0D9488", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
  },
  anxiety_calm: {
    background: "#F0F4FF", surface: "#FFFFFF", surfaceStrong: "#DDE8FC",
    primary: "#4F6BF6", primaryHover: "#3B51D4", accent: "#A5B4FC",
    text: "#1E2A5E", textMuted: "#6B7BA8", border: "#C7D2FE",
    focusRing: "#4F6BF6", success: "#34D399", warning: "#FBBF24", danger: "#F87171",
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
  "asd.social-scenarios": "asd_social",
  "asd.emotion-decoder": "asd_social",
  "asd.social-stories": "asd_social",
  "asd.communication": "asd_social",
  "asd.checkin": "asd_social",
  "asd.vocabulary": "asd_social",
  "asd.environment": "asd_social",
  "asd.schedule-change": "asd_social",
  "asd.safe-space": "asd_social",
  "anxiety.breathing": "anxiety_calm",
  "anxiety.grounding": "anxiety_calm",
  "anxiety.reframe": "anxiety_calm",
  "anxiety.micro-action": "anxiety_calm",
  "anxiety.tracker": "anxiety_calm",
  "anxiety.analyzer": "anxiety_calm",
  "anxiety.panic": "anxiety_calm",
  "anxiety.engine": "anxiety_calm",
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
