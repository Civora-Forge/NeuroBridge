import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Volume2 } from "lucide-react";

const speak = (text) => {
  if (!window?.speechSynthesis || !text) {
    return;
  }
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><MessageSquareText size={20} /> Communication Support Mode</CardTitle>
          <CardDescription className="text-base">
            One-tap phrases, caregiver customization, and text-to-speech support.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {activePhrases.length === 0 && <p className="text-sm text-muted-foreground">No phrases yet. Add one below.</p>}
            {activePhrases.map((phrase) => (
              <Button
                key={phrase.id}
                className="h-auto min-h-14 text-base justify-start whitespace-normal py-3"
                variant="outline"
                onClick={() => triggerPhrase(phrase.phrase_text)}
              >
                {phrase.phrase_text}
              </Button>
            ))}
          </div>

          {lastSpoken && (
            <Badge variant="secondary" className="text-sm gap-1"><Volume2 size={14} /> Spoke: {lastSpoken}</Badge>
          )}

          {canManagePhrases && (
            <div className="rounded-xl border p-4 bg-background/50 space-y-3">
              <p className="font-medium">Manage phrase library</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={draftPhrase}
                  onChange={(event) => setDraftPhrase(event.target.value)}
                  placeholder="Add a phrase"
                  className="max-w-md text-base"
                />
                <Button
                  onClick={() => {
                    const value = draftPhrase.trim();
                    if (!value) {
                      return;
                    }
                    onCreatePhrase?.({ phrase_text: value, is_default: false });
                    setDraftPhrase("");
                  }}
                >
                  Add Phrase
                </Button>
              </div>

              <div className="space-y-2">
                {activePhrases.map((phrase) => (
                  <article key={`manage-${phrase.id}`} className="rounded-lg border p-2 bg-background/40 space-y-2">
                    {editingId === phrase.id ? (
                      <>
                        <Input value={editingText} onChange={(event) => setEditingText(event.target.value)} className="text-base" />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const value = editingText.trim();
                              if (!value) {
                                return;
                              }
                              onUpdatePhrase?.(phrase.id, { phrase_text: value });
                              setEditingId(null);
                              setEditingText("");
                            }}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-sm">{phrase.phrase_text}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(phrase.id);
                              setEditingText(phrase.phrase_text);
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => onDeletePhrase?.(phrase.id)}>Delete</Button>
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

      <Button
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg"
        onClick={() => setIsQuickOpen((value) => !value)}
        aria-label="Emergency communication access"
      >
        SOS
      </Button>

      {isQuickOpen && (
        <div className="fixed bottom-24 right-5 z-40 w-[320px] max-w-[90vw] rounded-xl border bg-background p-3 shadow-lg space-y-2">
          <p className="font-medium">Quick Communication</p>
          <div className="grid grid-cols-1 gap-2 max-h-72 overflow-auto">
            {activePhrases.slice(0, 8).map((phrase) => (
              <Button
                key={`quick-${phrase.id}`}
                variant="outline"
                className="justify-start whitespace-normal h-auto py-2"
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
