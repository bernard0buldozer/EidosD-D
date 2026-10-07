import { useState } from "react";
import type { Roll } from "../domain/types";
import { rollSummary } from "../domain/dice";
import { Dices, X } from "./Icons";
/** Immediate feedback on narrow screens; the full dice panel remains in the document. */
export function MobileRollResult({
  roll,
  rolling,
}: {
  roll: Roll | null;
  rolling: boolean;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!roll || dismissed === roll.id) return null;
  return (
    <div className="mobile-roll-result" aria-label="Быстрый результат броска">
      <Dices size={21} />
      <div>
        <strong>{roll.label}</strong>
        <span>{rolling ? "Кубики бросаются…" : rollSummary(roll)}</span>
        {!rolling && roll.values.length === 2 && (
          <small>Выбрано меньшее: {roll.values[roll.selectedIndex]}</small>
        )}
        <a href="#dice" onClick={() => setDismissed(roll.id)}>
          Подробнее о броске
        </a>
      </div>
      <button
        className="icon-button"
        onClick={() => setDismissed(roll.id)}
        aria-label="Скрыть быстрый результат"
      >
        <X size={18} />
      </button>
    </div>
  );
}
