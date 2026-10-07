import type { DieSides, Roll, RollKind } from "./types";
export type RandomDie = (sides: DieSides) => number;
/** Rejection sampling avoids modulo bias. The visualizer never generates results. */
export const randomDie: RandomDie = (sides) => {
  const buffer = new Uint32Array(1);
  const ceiling = Math.floor(0x100000000 / sides) * sides;
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= ceiling);
  return (buffer[0] % sides) + 1;
};
export function rollDice(
  options: {
    label: string;
    kind: RollKind;
    sides: DieSides;
    modifier: number | null;
    disadvantage?: boolean;
    critical?: boolean;
  },
  rng: RandomDie = randomDie,
): Roll {
  const values = Array.from({ length: options.disadvantage ? 2 : 1 }, () =>
    rng(options.sides),
  );
  const selectedIndex = values.length === 2 && values[1] < values[0] ? 1 : 0;
  return {
    id: crypto.randomUUID(),
    label: options.label,
    kind: options.kind,
    sides: options.sides,
    values,
    selectedIndex,
    modifier: options.modifier,
    total:
      options.modifier === null
        ? null
        : values[selectedIndex] + options.modifier,
    critical: options.critical ?? false,
    timestamp: Date.now(),
  };
}
export function manualDamage(total: number): Roll {
  return {
    id: crypto.randomUUID(),
    label: "Критический урон · вручную",
    kind: "manual",
    sides: null,
    values: [],
    selectedIndex: 0,
    modifier: null,
    total,
    critical: true,
    timestamp: Date.now(),
  };
}
export const signed = (value: number) =>
  value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
export function rollSummary(roll: Roll): string {
  if (roll.kind === "manual") return `${roll.total} · по решению мастера`;
  const dice =
    roll.values.length === 2
      ? `[${roll.values.join(", ")}] → ${roll.values[roll.selectedIndex]}`
      : `${roll.values[0]}`;
  return roll.modifier === null
    ? `${dice} · без заданной формулы`
    : `${dice} ${signed(roll.modifier)} = ${roll.total}`;
}
export function appendHistory(history: Roll[], roll: Roll): Roll[] {
  return [roll, ...history].slice(0, 10);
}
