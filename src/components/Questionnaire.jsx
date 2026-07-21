export default function Questionnaire({ questions = [], answers = {}, onAnswer }) {
  const total = questions.length;
  const answered = questions.filter((q) => answers[q.id]).length;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-green-400 to-teal-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{answered}/{total}</span>
      </div>

      {questions.map((question, idx) => (
        <div key={question.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-600">
              {idx + 1}
            </span>
            <p className="text-sm font-semibold text-slate-800 leading-snug">{question.question}</p>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {question.options.map((option) => {
              const active = answers[question.id] === option.text;
              return (
                <button
                  key={`${question.id}-${option.text}`}
                  type="button"
                  onClick={() => onAnswer(question.id, option.text)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "border-green-400 bg-gradient-to-br from-green-50 to-teal-50 text-green-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-green-200 hover:bg-green-50/40"
                  }`}
                >
                  {option.text}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

