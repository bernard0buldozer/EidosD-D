import type { CharacterSession, Roll } from "../domain/types";
import { warrior } from "../data/warrior";
import {
  initialWarriorState,
  type WarriorState,
} from "../mechanics/warrior/rules";
import { isStanceId } from "../mechanics/warrior/config";
export interface SheetState {
  core: CharacterSession;
  mechanic: WarriorState;
  history: Roll[];
  lastRoll: Roll | null;
}
export const STORAGE_KEY = `eidos:sheet:${warrior.id}:v1`;
export function initialSheetState(): SheetState {
  return {
    core: {
      hp: warrior.maxHp,
      name: "Воин",
      wallet: "",
      notes: "",
      portrait: null,
    },
    mechanic: initialWarriorState(),
    history: [],
    lastRoll: null,
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function validRoll(v: unknown): v is Roll {
  if (!object(v)) return false;
  return (
    typeof v.id === "string" &&
    typeof v.label === "string" &&
    ["attribute", "attack", "damage", "parry", "manual"].includes(
      String(v.kind),
    ) &&
    (v.sides === null || [4, 8, 20].includes(v.sides as number)) &&
    Array.isArray(v.values) &&
    v.values.length <= 2 &&
    v.values.every(
      (n) =>
        Number.isInteger(n) && Number(n) >= 1 && Number(n) <= Number(v.sides),
    ) &&
    Number.isInteger(v.selectedIndex) &&
    Number(v.selectedIndex) >= 0 &&
    Number(v.selectedIndex) < Math.max(v.values.length, 1) &&
    (v.modifier === null || Number.isFinite(v.modifier)) &&
    (v.total === null || Number.isFinite(v.total)) &&
    typeof v.critical === "boolean" &&
    Number.isFinite(v.timestamp)
  );
}
function validMechanic(v: unknown): v is WarriorState {
  if (!object(v) || !object(v.spent)) return false;
  const basic =
    ["combat", "preparation"].includes(String(v.phase)) &&
    Number.isInteger(v.round) &&
    Number(v.round) >= 1 &&
    isStanceId(v.stance) &&
    ["main", "bonus", "reaction"].every(
      (k) => typeof (v.spent as Record<string, unknown>)[k] === "boolean",
    ) &&
    typeof v.bonusShift === "boolean" &&
    typeof v.finisher === "boolean" &&
    (v.freeShift === null || typeof v.freeShift === "string");
  const counter =
    v.counter === null ||
    (object(v.counter) && typeof v.counter.critical === "boolean");
  const reaction =
    v.reaction === null ||
    (object(v.reaction) &&
      ["cover", "parry"].includes(String(v.reaction.kind)) &&
      (v.reaction.roll === null || validRoll(v.reaction.roll)));
  const attack =
    v.attack === null ||
    (object(v.attack) &&
      ["main", "counter", "finisher"].includes(String(v.attack.origin)) &&
      isStanceId(v.attack.stance) &&
      validRoll(v.attack.roll) &&
      typeof v.attack.hit === "boolean" &&
      typeof v.attack.critical === "boolean" &&
      (v.attack.damage === null || validRoll(v.attack.damage)));
  return basic && counter && reaction && attack;
}
export function decodeState(raw: string | null): SheetState {
  const defaults = initialSheetState();
  if (!raw) return defaults;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!object(saved) || saved.version !== 1 || !object(saved.state))
      return defaults;
    const s = saved.state;
    if (object(s.core)) {
      if (typeof s.core.hp === "number" && Number.isFinite(s.core.hp))
        defaults.core.hp = Math.max(
          0,
          Math.min(warrior.maxHp, Math.trunc(s.core.hp)),
        );
      for (const key of ["name", "wallet", "notes"] as const)
        if (typeof s.core[key] === "string")
          defaults.core[key] = s.core[key].slice(
            0,
            key === "notes" ? 4000 : 100,
          );
      if (
        typeof s.core.portrait === "string" &&
        /^data:image\/(png|jpeg|webp);base64,/.test(s.core.portrait) &&
        s.core.portrait.length < 1500000
      )
        defaults.core.portrait = s.core.portrait;
    }
    if (validMechanic(s.mechanic)) defaults.mechanic = s.mechanic;
    if (Array.isArray(s.history))
      defaults.history = s.history.filter(validRoll).slice(0, 10);
    if (s.lastRoll && validRoll(s.lastRoll)) defaults.lastRoll = s.lastRoll;
  } catch {
    /* Invalid or old storage must never prevent opening a sheet. */
  }
  return defaults;
}
export const encodeState = (state: SheetState) =>
  JSON.stringify({ version: 1, state });
export function loadState(): SheetState {
  try {
    return decodeState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return initialSheetState();
  }
}
