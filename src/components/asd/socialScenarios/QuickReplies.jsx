import { Button } from "@/components/ui/button";

export default function QuickReplies({ replies = [], onSelect, disabled = false, largeText = false }) {
  if (!replies || replies.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {replies.map((reply) => (
        <Button
          key={reply}
          type="button"
          variant="outline"
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className={cnQuick(largeText)}
        >
          {reply}
        </Button>
      ))}
    </div>
  );
}

function cnQuick(largeText) {
  return `rounded-full border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 whitespace-normal h-auto py-2 ${
    largeText ? "text-base" : "text-sm"
  }`;
}
