import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPinned } from "lucide-react";

const normalizeTips = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => String(item || "").trim()).map((item) => String(item).trim());
  }

  if (typeof value === "string") {
    return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl"><MapPinned size={20} /> Public Environment Preparation</CardTitle>
        <CardDescription className="text-base">
          Prepare with coping strategies, sensory tips, and linked social stories.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">Select environment</p>
          <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
            <SelectTrigger className="max-w-md text-base">
              <SelectValue placeholder="Choose environment" />
            </SelectTrigger>
            <SelectContent>
              {mergedPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.environment_name}>{preset.environment_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activePreset && (
          <div className="rounded-xl border p-4 bg-background/50 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-lg font-semibold capitalize">{activePreset.environment_name} checklist</p>
              <Badge variant="secondary">{activePreset.id.startsWith("builtin-") ? "Built-in" : "Custom"}</Badge>
            </div>

            <div className="space-y-2">
              {activePreset.tips.map((tip, index) => {
                const key = `${activePreset.id}-${index}`;
                const checked = Boolean(checkedTips[key]);
                return (
                  <label key={key} className="flex items-start gap-2 rounded-lg border p-3 bg-background/40 text-base">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => setCheckedTips((prev) => ({ ...prev, [key]: event.target.checked }))}
                    />
                    <span>{tip}</span>
                  </label>
                );
              })}
            </div>

            {linkedStory && (
              <div className="rounded-lg border p-3 bg-background/40 space-y-2">
                <p className="font-medium">Linked social story: {linkedStory.title}</p>
                <Button onClick={() => onLaunchStory?.(linkedStory.id)}>Launch Story</Button>
              </div>
            )}
          </div>
        )}

        {!activePreset && (
          <div className="rounded-xl border p-4 bg-background/50">
            <p className="text-sm text-muted-foreground">No preset available yet. Add one to start preparation checklists.</p>
          </div>
        )}

        {canManagePresets && (
          <div className="rounded-xl border p-4 bg-background/50 space-y-3">
            <p className="font-medium">Manage custom presets</p>
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Environment name"
              className="max-w-md text-base"
            />
            <Textarea
              value={draftTips}
              onChange={(event) => setDraftTips(event.target.value)}
              placeholder="Tips (one per line)"
              className="min-h-24 text-base"
            />

            <Select value={draftStoryId} onValueChange={setDraftStoryId}>
              <SelectTrigger className="max-w-md text-base">
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
              onClick={() => {
                const name = draftName.trim();
                const tips = normalizeTips(draftTips);
                if (!name || tips.length === 0) {
                  return;
                }
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
              Save Preset
            </Button>

            <div className="space-y-2">
              {presets.map((preset) => (
                <article key={`custom-${preset.id}`} className="rounded-lg border p-3 bg-background/40 space-y-2">
                  <p className="font-medium">{preset.environment_name}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onUpdatePreset?.(preset.id, {
                          linked_story_id: preset.linked_story_id ? null : stories[0]?.id || null,
                        })
                      }
                    >
                      Toggle Linked Story
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDeletePreset?.(preset.id)}>Delete</Button>
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
