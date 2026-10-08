import type { TilzitDetails } from "../domain/types";

export const attributeModifier = (score: number) =>
  Math.floor((score - 10) / 2);
export function initialTilzitDetails(): TilzitDetails {
  return {
    biography: {
      nickname: "Белый Узник",
      race: "Голиаф",
      className: "Воин, Мастер стоек",
      age: 34,
      height: 248,
      weight: 215,
      clan: "Драгунатори",
      backstory: "",
      goals: "",
    },
    weapons: {
      shield: { bonus: null, damage: "", damageType: "" },
      sword: { bonus: null, damage: "", damageType: "" },
    },
    attacks: [],
    abilities: [],
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min = 0): number | null =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= 100000
    ? v
    : null;
const text = (v: unknown, fallback = "") =>
  typeof v === "string" ? v.slice(0, 20000) : fallback;
export function decodeTilzitDetails(value: unknown): TilzitDetails {
  const details = initialTilzitDetails();
  if (!object(value)) return details;
  if (object(value.biography)) {
    const bio = value.biography;
    for (const key of [
      "nickname",
      "race",
      "className",
      "clan",
      "backstory",
      "goals",
    ] as const)
      details.biography[key] = text(bio[key], details.biography[key]);
    for (const key of ["age", "height", "weight"] as const)
      if (key in bio) details.biography[key] = integer(bio[key]);
  }
  if (object(value.weapons))
    for (const key of ["shield", "sword"] as const) {
      const weapon = value.weapons[key];
      if (object(weapon))
        details.weapons[key] = {
          bonus: integer(weapon.bonus, -1000),
          damage: text(weapon.damage),
          damageType: text(weapon.damageType),
        };
    }
  if (Array.isArray(value.attacks))
    details.attacks = value.attacks
      .filter(object)
      .filter((a) => typeof a.id === "string")
      .map((a) => ({
        id: String(a.id),
        name: text(a.name),
        bonus: integer(a.bonus, -1000),
        damage: text(a.damage),
        damageType: text(a.damageType),
      }));
  if (Array.isArray(value.abilities))
    details.abilities = value.abilities
      .filter(object)
      .filter((a) => typeof a.id === "string")
      .map((a) => {
        const maximum = integer(a.maximum);
        const current = integer(a.current);
        return {
          id: String(a.id),
          name: text(a.name),
          description: text(a.description),
          conditions: text(a.conditions),
          maximum,
          current:
            current === null ? null : Math.min(maximum ?? Infinity, current),
        };
      });
  return details;
}

export function changeHealth(
  hp: number | null,
  maximum: number | null,
  amount: number,
  action: "damage" | "heal",
) {
  if (
    hp === null ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > 100000 ||
    (action === "heal" && maximum === null)
  )
    return null;
  const next = Math.max(
    0,
    Math.min(maximum ?? Infinity, hp + (action === "heal" ? amount : -amount)),
  );
  return { hp: next, delta: next - hp };
}
