import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function AccessibilityControls({ settings, onToggleLargeText, onToggleReduceMotion, onToggleFocusIndicators }) {
  const controls = [
    {
      key: "largeText",
      label: "Larger text",
      description: "Increase reading size throughout the simulator.",
      checked: settings.largeText,
      onToggle: onToggleLargeText,
    },
    {
      key: "reduceMotion",
      label: "Reduce motion",
      description: "Slow down animations and transitions.",
      checked: settings.reduceMotion,
      onToggle: onToggleReduceMotion,
    },
    {
      key: "focusIndicators",
      label: "Strong focus indicators",
      description: "Keep clear outlines on focused buttons and links.",
      checked: settings.focusIndicators,
      onToggle: onToggleFocusIndicators,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-green-100 bg-white px-4 py-3 shadow-sm">
      {controls.map(({ key, label, description, checked, onToggle }) => (
        <div key={key} className="flex items-center gap-2.5">
          <Switch id={`a11y-${key}`} checked={checked} onCheckedChange={onToggle} aria-label={label} />
          <div className="leading-tight">
            <Label htmlFor={`a11y-${key}`} className="text-sm font-medium text-slate-700">
              {label}
            </Label>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
