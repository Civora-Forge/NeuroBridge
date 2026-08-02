import "./supportToolThemes.css";
import { SUPPORT_TOOL_THEMES, resolveSupportToolTheme } from "./supportToolThemes";

export default function SupportToolThemeProvider({ theme, override, children }) {
  const resolvedTheme = resolveSupportToolTheme(theme, override);
  const tokens = resolvedTheme ? SUPPORT_TOOL_THEMES[resolvedTheme] : null;
  const style = tokens ? {
    "--tool-background": tokens.background,
    "--tool-surface": tokens.surface,
    "--tool-surface-strong": tokens.surfaceStrong,
    "--tool-primary": tokens.primary,
    "--tool-primary-hover": tokens.primaryHover,
    "--tool-accent": tokens.accent,
    "--tool-text": tokens.text,
    "--tool-text-muted": tokens.textMuted,
    "--tool-border": tokens.border,
    "--tool-focus-ring": tokens.focusRing,
    "--tool-success": tokens.success,
    "--tool-warning": tokens.warning,
    "--tool-danger": tokens.danger,
  } : undefined;

  return <div data-support-theme={resolvedTheme ?? "neutral"} className="support-tool-theme" style={style}>{children}</div>;
}
