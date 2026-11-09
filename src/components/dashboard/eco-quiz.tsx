"use client";

import { useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const QUESTIONS = [
  { id: "q1", options: ["a", "b", "c", "d"], correct: "a" },
  { id: "q2", options: ["a", "b", "c", "d"], correct: "c" },
  { id: "q3", options: ["a", "b", "c", "d"], correct: "b" },
] as const;

/**
 * "We wanted to know…" card from the post-login design: one short waste
 * question, rotating daily, with instant feedback. Native radio buttons
 * keep it keyboard and screen-reader friendly.
 */
export function EcoQuiz({ dayIndex }: { dayIndex: number }) {
  const t = useTranslations("dashboard.quiz");
  const q = QUESTIONS[dayIndex % QUESTIONS.length];
  const [answer, setAnswer] = useState<string | null>(null);
  const correct = answer === q.correct;

  return (
    <section aria-labelledby="quiz-title" className="rounded-2xl border border-wl-border bg-wl-surface p-5 md:p-6">
      <p id="quiz-title" className="text-xs tracking-wide text-wl-ink-muted uppercase">
        {t("eyebrow")}
      </p>
      <fieldset className="mt-2 space-y-1">
        <legend className="mb-3 text-lg leading-snug font-medium">{t(`${q.id}.question`)}</legend>
        {q.options.map((o) => {
          const chosen = answer === o;
          return (
            <label
              key={o}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-wl-ink",
                chosen && correct && "bg-wl-success-tint",
                chosen && !correct && "bg-wl-chrome-soft",
                !chosen && "hover:bg-wl-chrome-soft",
              )}
            >
              <input
                type="radio"
                name={`quiz-${q.id}`}
                value={o}
                checked={chosen}
                onChange={() => setAnswer(o)}
                className="size-5 accent-wl-ink"
              />
              <span>{t(`${q.id}.${o}`)}</span>
            </label>
          );
        })}
      </fieldset>
      <div aria-live="polite" className="mt-3 min-h-6 text-sm">
        {answer ? (
          <p className={cn("flex items-start gap-2", correct ? "text-wl-success" : "text-wl-ink-soft")}>
            {correct ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" /> : <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />}
            {correct ? t("correct") : t("tryAgain")} {t(`${q.id}.why`)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
