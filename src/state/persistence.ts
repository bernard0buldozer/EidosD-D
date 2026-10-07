import type { CharacterSession, Roll } from "../domain/types";
import { warrior } from "../data/warrior";
import { defaultCore, decodeCore, validRoll } from "./core";
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
    core: defaultCore(warrior),
    mechanic: initialWarriorState(),
    history: [],
    lastRoll: null,
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function validMechanic(v: unknown): v is WarriorState {
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
    defaults.core = decodeCore(s.core, warrior);
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
