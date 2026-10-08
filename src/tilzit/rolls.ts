import type { CheckMode, DicePool, DieSides, Roll } from "../domain/types";
import type { RollRequest } from "../dice/DiceProvider";
import { randomDie, type RandomDie } from "../domain/dice";

export const dieTypes: DieSides[] = [4, 6, 8, 10, 12, 20, 100];
export function simpleRoll(
  request: RollRequest,
  mode: CheckMode = "normal",
  rng: RandomDie = randomDie,
): Roll {
  if (
    !request.pool.length ||
    request.pool.some(
      (p) =>
        !dieTypes.includes(p.sides) ||
        !Number.isInteger(p.quantity) ||
        p.quantity < 1,
    ) ||
    request.pool.reduce((n, p) => n + p.quantity, 0) > 30 ||
    (request.modifier !== null &&
      (!Number.isSafeInteger(request.modifier) ||
        Math.abs(request.modifier) > 100000))
  )
    throw new Error("Проверьте количество кубиков и модификатор.");
  // A confirmed shield penalty takes precedence. No stacking rule is inferred.
  const check =
    ["attribute", "skill", "attack", "free"].includes(request.kind) &&
    request.pool.length === 1 &&
    request.pool[0].sides === 20 &&
    (request.pool[0].quantity === 1 || request.disadvantage);
  const selectedMode = check
    ? request.disadvantage
      ? "disadvantage"
      : mode
    : "normal";
  const pool =
    selectedMode === "normal"
      ? request.pool
      : [{ sides: 20 as const, quantity: 2 }];
  const dice = pool.flatMap((p) =>
    Array.from({ length: p.quantity }, () => ({
      sides: p.sides,
      value: rng(p.sides),
    })),
  );
  if (
    dice.some(
      (d) => !Number.isInteger(d.value) || d.value < 1 || d.value > d.sides,
    )
  )
    throw new Error("Некорректный результат кубика.");
  const values = dice.map((d) => d.value);
  const selectedIndex =
    selectedMode === "advantage"
      ? values[1] > values[0]
        ? 1
        : 0
      : selectedMode === "disadvantage" && values[1] < values[0]
        ? 1
        : 0;
  const raw =
    selectedMode === "normal"
      ? values.reduce((n, v) => n + v, 0)
      : values[selectedIndex];
  return {
    id: crypto.randomUUID(),
    label: request.label,
    kind: request.kind,
    sides: pool.length === 1 ? pool[0].sides : null,
    values,
    dice,
    pool,
    selectedIndex,
    modifier: request.modifier,
    total: request.modifier === null ? null : raw + request.modifier,
    critical: request.critical ?? false,
    timestamp: Date.now(),
    advantage: selectedMode === "advantage",
    disadvantage: selectedMode === "disadvantage",
  };
}

export function parseDamage(
  formula: string,
): { pool: DicePool[]; modifier: number } | null {
  const match =
    /^\s*(\d{1,2})[dд](4|6|8|10|12|20|100)\s*(?:([+−-])\s*(\d{1,5}))?\s*$/i.exec(
      formula,
    );
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 30) return null;
  return {
    pool: [{ sides: Number(match[2]) as DieSides, quantity: Number(match[1]) }],
    modifier: Number(match[4] ?? 0) * (match[3] && match[3] !== "+" ? -1 : 1),
  };
}
