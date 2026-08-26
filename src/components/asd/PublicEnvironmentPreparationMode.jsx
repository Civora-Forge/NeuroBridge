import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPinned, CheckCircle2, Plus, Trash2, ExternalLink } from "lucide-react";

const normalizeTips = (value) => {
  if (Array.isArray(value)) return value.filter((item) => String(item || "").trim()).map((item) => String(item).trim());
  if (typeof value === "string") return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  return [];
};

const ENV_EMOJIS = { mall: "🛒", school: "🏫", park: "🌳", doctor: "🩺", restaurant: "🍽️", bus: "🚌" };

export default function PublicEnvironmentPreparationMode({
  role,
  presets,
  stories,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onLaunchStory,
}) {
  const canManagePresets = role === "guardian" || role === "admin";

  const mergedPresets = useMemo(() => {
    return (presets || []).map((item) => ({ ...item, tips: normalizeTips(item.tips) }));
  }, [presets]);

  const [selectedEnvironment, setSelectedEnvironment] = useState(mergedPresets[0]?.environment_name || "mall");
  const [checkedTips, setCheckedTips] = useState({});
  const [draftName, setDraftName] = useState("");
  const [draftTips, setDraftTips] = useState("");
  const [draftStoryId, setDraftStoryId] = useState("none");

  useEffect(() => {
    if (!mergedPresets.find((item) => item.environment_name === selectedEnvironment) && mergedPresets.length > 0) {
      setSelectedEnvironment(mergedPresets[0].environment_name);
    }
  }, [mergedPresets, selectedEnvironment]);

  const activePreset = useMemo(
    () => mergedPresets.find((item) => item.environment_name === selectedEnvironment) || null,
    [mergedPresets, selectedEnvironment],
  );

  const linkedStory = useMemo(
    () => stories.find((story) => story.id === activePreset?.linked_story_id) || null,
    [stories, activePreset?.linked_story_id],
  );

  return (
    <Card className="overflow-hidden border-[#B2DFDB] shadow-[4px_4px_0_#D5F5EC]">
      <div className="h-2 bg-gradient-to-r from-[#0D9488] to-[#5EEAD4]" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-[#134E4A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D5F5EC] text-[#0D9488]">
            <MapPinned size={18} />
          </div>
          Public Environment Preparation
        </CardTitle>
        <CardDescription className="text-[#5F8A87]">
          Prepare with coping strategies, sensory tips, and linked social stories.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#134E4A]">Select environment</p>
          <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
            <SelectTrigger className="max-w-md text-base border-[#B2DFDB] focus:border-[#0D9488]">
              <SelectValue placeholder="Choose environment" />
            </SelectTrigger>
            <SelectContent>
              {mergedPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.environment_name}>
                  {ENV_EMOJIS[preset.environment_name] || "📍"} {preset.environment_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activePreset && (
          <div className="rounded-2xl border border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-lg font-bold text-[#134E4A] capitalize">
                {ENV_EMOJIS[activePreset.environment_name] || "📍"} {activePreset.environment_name} checklist
              </p>
              <Badge variant="secondary" className="bg-[#E0F5EE] text-[#0D9488] border-[#B2DFDB]">
                {activePreset.id.startsWith("builtin-") ? "Built-in" : "Custom"}
              </Badge>
            </div>

            <div className="space-y-2">
              {activePreset.tips.map((tip, index) => {
                const key = `${activePreset.id}-${index}`;
                const checked = Boolean(checkedTips[key]);
                return (
                  <motion.label
                    key={key}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3 text-base cursor-pointer transition-all ${
                      checked
                        ? "border-[#0D9488] bg-[#E0F5EE]"
                        : "border-[#B2DFDB] bg-white hover:border-[#0D9488] hover:bg-[#F0FAF7]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => setCheckedTips((prev) => ({ ...prev, [key]: event.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-[#B2DFDB] accent-[#0D9488]"
                    />
                    <span className={checked ? "text-[#0D9488] font-medium" : "text-[#134E4A]"}>{tip}</span>
                    {checked && <CheckCircle2 size={18} className="ml-auto text-[#0D9488] flex-shrink-0" />}
                  </motion.label>
                );
              })}
            </div>

            {linkedStory && (
              <div className="rounded-xl border border-[#B2DFDB] bg-white p-3 space-y-2">
                <p className="font-medium text-[#134E4A]">Linked social story: {linkedStory.title}</p>
                <Button
                  size="sm"
                  className="bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB]"
                  onClick={() => onLaunchStory?.(linkedStory.id)}
                >
                  <ExternalLink size={14} className="mr-1" /> Launch Story
                </Button>
              </div>
            )}
          </div>
        )}

        {!activePreset && (
          <div className="rounded-2xl border border-dashed border-[#B2DFDB] bg-[#F0FAF7] p-6 text-center">
            <p className="text-sm text-[#5F8A87]">No preset available yet. Add one to start preparation checklists.</p>
          </div>
        )}

        {canManagePresets && (
          <div className="rounded-2xl border border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-3">
            <p className="font-semibold text-[#134E4A]">Manage custom presets</p>
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Environment name"
              className="max-w-md text-base border-[#B2DFDB] focus:border-[#0D9488]"
            />
            <Textarea
              value={draftTips}
              onChange={(event) => setDraftTips(event.target.value)}
              placeholder="Tips (one per line)"
              className="min-h-24 text-base border-[#B2DFDB] focus:border-[#0D9488]"
            />

            <Select value={draftStoryId} onValueChange={setDraftStoryId}>
              <SelectTrigger className="max-w-md text-base border-[#B2DFDB] focus:border-[#0D9488]">
                <SelectValue placeholder="Link social story" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked story</SelectItem>
                {stories.map((story) => (
                  <SelectItem key={`story-${story.id}`} value={story.id}>{story.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB]"
              onClick={() => {
                const name = draftName.trim();
                const tips = normalizeTips(draftTips);
                if (!name || tips.length === 0) return;
                onCreatePreset?.({
                  environment_name: name,
                  tips,
                  linked_story_id: draftStoryId === "none" ? null : draftStoryId,
                });
                setDraftName("");
                setDraftTips("");
                setDraftStoryId("none");
              }}
            >
              <Plus size={16} className="mr-1" /> Save Preset
            </Button>

            <div className="space-y-2">
              {presets.map((preset) => (
                <article key={`custom-${preset.id}`} className="rounded-xl border border-[#B2DFDB] bg-white p-3 space-y-2">
                  <p className="font-medium text-[#134E4A]">{ENV_EMOJIS[preset.environment_name] || "📍"} {preset.environment_name}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#B2DFDB] text-[#5F8A87] hover:text-[#0D9488] hover:border-[#0D9488]"
                      onClick={() =>
                        onUpdatePreset?.(preset.id, {
                          linked_story_id: preset.linked_story_id ? null : stories[0]?.id || null,
                        })
                      }
                    >
                      Toggle Linked Story
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="bg-[#EF4444] text-white hover:bg-[#DC2626]"
                      onClick={() => onDeletePreset?.(preset.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
