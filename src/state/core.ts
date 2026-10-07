import { useEffect, useReducer, useState } from "react";
import type {
  CharacterDefinition,
  CharacterSession,
  Roll,
} from "../domain/types";
import { appendHistory } from "../domain/dice";
export interface MechanicPlugin<M> {
  initial: () => M;
  decode: (value: unknown) => M;
}
export interface CharacterState<M> {
  core: CharacterSession;
  mechanic: M;
  history: Roll[];
  lastRoll: Roll | null;
}
export const defaultCore = (
  character: CharacterDefinition,
): CharacterSession => ({
  name: character.name,
  hp: character.maxHp ?? null,
  maxHp: character.maxHp ?? null,
  level: character.level ?? null,
  defense: null,
  speed: character.speed.value ?? null,
  attributes: structuredClone(character.attributes),
  wallet: "",
  notes: "",
  portrait: null,
  items: [],
  journal: [],
  skills: structuredClone(character.skills ?? []),
  proficiencies: "",
});
const nullable = (v: unknown, min = 0) =>
  v === null
    ? null
    : typeof v === "number" && Number.isFinite(v)
      ? Math.max(min, Math.trunc(v))
      : null;
export function normalizeCore(core: CharacterSession): CharacterSession {
  const maxHp = nullable(core.maxHp);
  return {
    ...core,
    maxHp,
    hp:
      core.hp === null
        ? null
        : Math.max(0, Math.min(maxHp ?? Infinity, Math.trunc(core.hp))),
    level: nullable(core.level, 1),
    defense: nullable(core.defense),
    speed: nullable(core.speed),
  };
}
export function decodeCore(
  value: unknown,
  character: CharacterDefinition,
): CharacterSession {
  const core = defaultCore(character);
  if (!value || typeof value !== "object") return core;
  const saved = value as Record<string, unknown>;
  for (const key of ["name", "wallet", "notes", "proficiencies"] as const)
    if (typeof saved[key] === "string")
      core[key] = saved[key].slice(0, key === "name" ? 100 : 20000);
  for (const key of ["hp", "maxHp", "level", "defense", "speed"] as const)
    if (saved[key] === null || typeof saved[key] === "number")
      core[key] = nullable(saved[key], key === "level" ? 1 : 0);
  if (
    typeof saved.portrait === "string" &&
    /^data:image\/(png|jpeg|webp);base64,/.test(saved.portrait) &&
    saved.portrait.length < 1500000
  )
    core.portrait = saved.portrait;
  if (Array.isArray(saved.attributes))
    core.attributes = core.attributes.map((a) => {
      const s = saved.attributes as Record<string, unknown>[];
      const found = s.find((v) => v && v.id === a.id);
      return found
        ? {
            ...a,
            score: nullable(found.score) ?? a.score,
            modifier: nullable(found.modifier, -1000) ?? a.modifier,
          }
        : a;
    });
  if (Array.isArray(saved.skills))
    core.skills = saved.skills.filter(
      (v) =>
        v &&
        typeof v.id === "string" &&
        typeof v.name === "string" &&
        Number.isFinite(v.bonus),
    );
  if (Array.isArray(saved.items))
    core.items = saved.items.filter(
      (v) =>
        v &&
        typeof v.id === "string" &&
        typeof v.name === "string" &&
        Number.isInteger(v.quantity) &&
        v.quantity >= 0 &&
        ["description", "notes", "category"].every(
          (k) => typeof v[k] === "string",
        ) &&
        typeof v.equipped === "boolean",
    );
  if (Array.isArray(saved.journal))
    core.journal = saved.journal.filter(
      (v) =>
        v &&
        [
          "id",
          "category",
          "name",
          "description",
          "notes",
          "status",
          "met",
        ].every((k) => typeof v[k] === "string") &&
        Number.isFinite(v.timestamp),
    );
  return normalizeCore(core);
}
export const validRoll = (v: unknown): v is Roll => {
  if (!v || typeof v !== "object") return false;
  const r = v as Roll;
  const sides = [4, 6, 8, 10, 12, 20];
  const basic =
    typeof r.id === "string" &&
    typeof r.label === "string" &&
    [
      "attribute",
      "attack",
      "damage",
      "parry",
      "manual",
      "free",
      "skill",
    ].includes(r.kind) &&
    (r.sides === null || sides.includes(r.sides)) &&
    Array.isArray(r.values) &&
    r.values.length <= 30 &&
    r.values.every(
      (n) => Number.isInteger(n) && n >= 1 && n <= (r.sides ?? 20),
    ) &&
    Number.isFinite(r.timestamp) &&
    (r.total === null || Number.isFinite(r.total)) &&
    (r.modifier === null || Number.isFinite(r.modifier)) &&
    typeof r.critical === "boolean" &&
    Number.isInteger(r.selectedIndex) &&
    r.selectedIndex >= 0 &&
    r.selectedIndex < Math.max(1, r.values.length);
  if (!basic || (r.kind !== "manual" && !r.values.length)) return false;
  if (r.pool !== undefined) {
    if (
      !Array.isArray(r.pool) ||
      !r.pool.length ||
      !r.pool.every(
        (p) =>
          p &&
          sides.includes(p.sides) &&
          Number.isInteger(p.quantity) &&
          p.quantity > 0,
      ) ||
      r.pool.reduce((n, p) => n + p.quantity, 0) !== r.values.length
    )
      return false;
  }
  if (r.dice !== undefined) {
    if (
      !Array.isArray(r.dice) ||
      r.dice.length !== r.values.length ||
      !r.dice.every(
        (d, i) =>
          d &&
          sides.includes(d.sides) &&
          Number.isInteger(d.value) &&
          d.value >= 1 &&
          d.value <= d.sides &&
          d.value === r.values[i],
      )
    )
      return false;
  }
  return true;
};

type CoreEvent<M> =
  | { type: "core"; patch: Partial<CharacterSession> }
  | { type: "roll"; roll: Roll }
  | { type: "mechanic-state"; value: M; core?: Partial<CharacterSession> }
  | { type: "clear-history" }
  | { type: "reset"; value: CharacterState<M> };
export function coreReducer<M>(
  s: CharacterState<M>,
  e: CoreEvent<M>,
): CharacterState<M> {
  if (e.type === "core")
    return { ...s, core: normalizeCore({ ...s.core, ...e.patch }) };
  if (e.type === "roll")
    return {
      ...s,
      lastRoll: e.roll,
      history: appendHistory(s.history, e.roll),
    };
  if (e.type === "clear-history") return { ...s, history: [], lastRoll: null };
  if (e.type === "reset") return e.value;
  return {
    ...s,
    mechanic: e.value,
    core: normalizeCore({ ...s.core, ...e.core }),
  };
}
export function useCharacter<M>(
  character: CharacterDefinition,
  plugin: MechanicPlugin<M>,
  migrate?: () => CharacterState<M>,
) {
  const key = `eidos:sheet:${character.id}:v2`;
  const initial = (): CharacterState<M> => ({
    core: defaultCore(character),
    mechanic: plugin.initial(),
    history: [],
    lastRoll: null,
  });
  const load = () => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return migrate?.() ?? initial();
      const parsed = JSON.parse(raw);
      if (parsed.version !== 2 || !parsed.state) return initial();
      const s = parsed.state;
      return {
        core: decodeCore(s.core, character),
        mechanic: plugin.decode(s.mechanic),
        history: Array.isArray(s.history)
          ? s.history.filter(validRoll).slice(0, 10)
          : [],
        lastRoll: validRoll(s.lastRoll) ? s.lastRoll : null,
      };
    } catch {
      return initial();
    }
  };
  const [state, dispatch] = useReducer(coreReducer<M>, undefined, load);
  const [storageOk, setStorageOk] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ version: 2, state }));
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }, [key, state]);
  return {
    state,
    storageOk,
    updateCore: (patch: Partial<CharacterSession>) =>
      dispatch({ type: "core", patch }),
    recordRoll: (roll: Roll) => dispatch({ type: "roll", roll }),
    setMechanic: (value: M, core?: Partial<CharacterSession>) =>
      dispatch({ type: "mechanic-state", value, core }),
    clearHistory: () => dispatch({ type: "clear-history" }),
    reset: () => dispatch({ type: "reset", value: initial() }),
  };
}
export type CoreController<M = unknown> = ReturnType<typeof useCharacter<M>>;
