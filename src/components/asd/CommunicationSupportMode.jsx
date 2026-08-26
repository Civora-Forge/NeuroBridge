import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Volume2, Plus, Pencil, Trash2 } from "lucide-react";

const speak = (text) => {
  if (!window?.speechSynthesis || !text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

export default function CommunicationSupportMode({
  role,
  phrases,
  onCreatePhrase,
  onUpdatePhrase,
  onDeletePhrase,
}) {
  const canManagePhrases = role === "guardian" || role === "admin";
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [draftPhrase, setDraftPhrase] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [lastSpoken, setLastSpoken] = useState("");

  const activePhrases = useMemo(
    () => phrases.filter((item) => item?.phrase_text?.trim()).map((item) => ({ ...item, phrase_text: item.phrase_text.trim() })),
    [phrases],
  );

  const triggerPhrase = (text) => {
    speak(text);
    setLastSpoken(text);
  };

  return (
    <>
      <Card className="overflow-hidden border-[#B2DFDB] shadow-[4px_4px_0_#D5F5EC]">
        <div className="h-2 bg-gradient-to-r from-[#0D9488] to-[#5EEAD4]" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl text-[#134E4A]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D5F5EC] text-[#0D9488]">
              <MessageSquareText size={18} />
            </div>
            Communication Support
          </CardTitle>
          <CardDescription className="text-[#5F8A87]">
            One-tap phrases, caregiver customization, and text-to-speech support.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activePhrases.length === 0 && (
              <p className="text-sm text-[#5F8A87] col-span-full">No phrases yet. Add one below.</p>
            )}
            {activePhrases.map((phrase) => (
              <Button
                key={phrase.id}
                className="h-auto min-h-14 text-base justify-start whitespace-normal py-3 border-[#B2DFDB] bg-white hover:bg-[#E0F5EE] hover:border-[#0D9488] text-[#134E4A] font-medium shadow-[2px_2px_0_#D5F5EC] transition-all"
                variant="outline"
                onClick={() => triggerPhrase(phrase.phrase_text)}
              >
                {phrase.phrase_text}
              </Button>
            ))}
          </div>

          {lastSpoken && (
            <Badge variant="secondary" className="text-sm gap-1 bg-[#E0F5EE] text-[#0D9488] border-[#B2DFDB]">
              <Volume2 size={14} /> Spoke: {lastSpoken}
            </Badge>
          )}

          {canManagePhrases && (
            <div className="rounded-2xl border border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-3">
              <p className="font-semibold text-[#134E4A]">Manage phrase library</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={draftPhrase}
                  onChange={(event) => setDraftPhrase(event.target.value)}
                  placeholder="Add a phrase"
                  className="max-w-md text-base border-[#B2DFDB] focus:border-[#0D9488] focus:ring-[#D5F5EC]"
                />
                <Button
                  className="bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB]"
                  onClick={() => {
                    const value = draftPhrase.trim();
                    if (!value) return;
                    onCreatePhrase?.({ phrase_text: value, is_default: false });
                    setDraftPhrase("");
                  }}
                >
                  <Plus size={16} className="mr-1" /> Add Phrase
                </Button>
              </div>

              <div className="space-y-2">
                {activePhrases.map((phrase) => (
                  <article key={`manage-${phrase.id}`} className="rounded-xl border border-[#B2DFDB] bg-white p-3 space-y-2">
                    {editingId === phrase.id ? (
                      <>
                        <Input
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          className="text-base border-[#B2DFDB] focus:border-[#0D9488]"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-[#0D9488] text-white hover:bg-[#0F766E]"
                            onClick={() => {
                              const value = editingText.trim();
                              if (!value) return;
                              onUpdatePhrase?.(phrase.id, { phrase_text: value });
                              setEditingId(null);
                              setEditingText("");
                            }}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="outline" className="border-[#B2DFDB]" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-sm text-[#134E4A] font-medium">{phrase.phrase_text}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#B2DFDB] text-[#5F8A87] hover:text-[#0D9488] hover:border-[#0D9488]"
                            onClick={() => {
                              setEditingId(phrase.id);
                              setEditingText(phrase.phrase_text);
                            }}
                          >
                            <Pencil size={14} className="mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="bg-[#EF4444] text-white hover:bg-[#DC2626]"
                            onClick={() => onDeletePhrase?.(phrase.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating SOS Button */}
      <Button
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-[#0D9488] text-white shadow-[3px_3px_0_#B2DFDB] hover:bg-[#0F766E] font-bold text-sm"
        onClick={() => setIsQuickOpen((value) => !value)}
        aria-label="Emergency communication access"
      >
        SOS
      </Button>

      {isQuickOpen && (
        <div className="fixed bottom-24 right-5 z-40 w-[320px] max-w-[90vw] rounded-2xl border border-[#B2DFDB] bg-white p-4 shadow-[6px_6px_0_#D5F5EC] space-y-3">
          <p className="font-bold text-[#134E4A]">Quick Communication</p>
          <div className="grid grid-cols-1 gap-2 max-h-72 overflow-auto">
            {activePhrases.slice(0, 8).map((phrase) => (
              <Button
                key={`quick-${phrase.id}`}
                variant="outline"
                className="justify-start whitespace-normal h-auto py-3 border-[#B2DFDB] bg-[#F0FAF7] hover:bg-[#E0F5EE] hover:border-[#0D9488] text-[#134E4A] font-medium"
                onClick={() => triggerPhrase(phrase.phrase_text)}
              >
                {phrase.phrase_text}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
