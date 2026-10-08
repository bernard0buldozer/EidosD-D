import { describe, expect, it } from "vitest";
import { simpleRoll, parseDamage, dieTypes } from "../src/tilzit/rolls";
import {
  attributeModifier,
  changeHealth,
  decodeTilzitDetails,
} from "../src/tilzit/model";
import {
  decodeLayout,
  defaultLayout,
  moveBlock,
  packLayout,
} from "../src/tilzit/layout";
import { decodeCore, validRoll } from "../src/state/core";
import { warrior } from "../src/data/warrior";
import type { CheckMode } from "../src/domain/types";

describe("Tilzit checks and damage", () => {
  it.each(["advantage", "disadvantage"] as CheckMode[])(
    "%s preserves both natural dice and selects the correct face",
    (mode) => {
      const faces = [4, 18];
      const roll = simpleRoll(
        {
          label: "Сила",
          kind: "attribute",
          pool: [{ sides: 20, quantity: 1 }],
          modifier: 2,
        },
        mode,
        () => faces.shift()!,
      );
      expect(roll.values).toEqual([4, 18]);
      expect(roll.selectedIndex).toBe(mode === "advantage" ? 1 : 0);
      expect(roll.total).toBe(mode === "advantage" ? 20 : 6);
      expect(validRoll(JSON.parse(JSON.stringify(roll)))).toBe(true);
    },
  );
  it("retains the confirmed shield penalty when advantage mode is selected", () => {
    const roll = simpleRoll(
      {
        label: "Щит",
        kind: "attack",
        pool: [{ sides: 20, quantity: 2 }],
        modifier: -1,
        disadvantage: true,
      },
      "advantage",
      () => 13,
    );
    expect(roll.disadvantage).toBe(true);
    expect(roll.advantage).toBe(false);
    expect(roll.total).toBe(12);
  });
  it.each(dieTypes)("rolls and restores a pool of d%i", (sides) => {
    const roll = simpleRoll(
      {
        label: "Свободный",
        kind: "free",
        pool: [{ sides, quantity: 3 }],
        modifier: -2,
      },
      "advantage",
      () => sides,
    );
    expect(roll.values).toEqual([sides, sides, sides]);
    expect(roll.total).toBe(3 * sides - 2);
    expect(validRoll(roll)).toBe(true);
  });
  it("does not invent a total for a raw parry", () => {
    expect(
      simpleRoll(
        {
          label: "Парирование",
          kind: "parry",
          pool: [{ sides: 20, quantity: 1 }],
          modifier: null,
        },
        "normal",
        () => 20,
      ).total,
    ).toBeNull();
  });
  it("does not apply advantage to d20 damage or change a raw parry pool", () => {
    for (const kind of ["damage", "parry"] as const) {
      const roll = simpleRoll(
        { label: "", kind, pool: [{ sides: 20, quantity: 1 }], modifier: 0 },
        "advantage",
        () => 12,
      );
      expect(roll.values).toEqual([12]);
      expect(roll.advantage).toBe(false);
      expect(roll.total).toBe(12);
    }
  });
  it("rejects excessive pools and invalid RNG output", () => {
    const base = {
      label: "",
      kind: "free" as const,
      pool: [{ sides: 6 as const, quantity: 31 }],
      modifier: 0,
    };
    expect(() => simpleRoll(base)).toThrow();
    expect(() =>
      simpleRoll(
        { ...base, pool: [{ sides: 6, quantity: 1 }] },
        "normal",
        () => 7,
      ),
    ).toThrow();
  });
  it.each(["0d6", "31d6", "1d7", "1d6 + NaN", "1d6 * 2", "alert(1)"])(
    "rejects unsupported damage %s without executing text",
    (formula) => expect(parseDamage(formula)).toBeNull(),
  );
  it("parses signed modifiers and d100", () => {
    expect(parseDamage("2d100 − 3")).toEqual({
      pool: [{ sides: 100, quantity: 2 }],
      modifier: -3,
    });
    expect(parseDamage("1d8 + 2")?.modifier).toBe(2);
  });
});
describe("character data preservation", () => {
  it("derives modifiers from saved scores while retaining existing name, inventory, HP and notes", () => {
    const core = decodeCore(
      {
        name: "Игрок",
        hp: 22,
        maxHp: 30,
        notes: "Запись",
        attributes: [{ id: "strength", score: 18, modifier: 999 }],
      },
      warrior,
    );
    expect(core.name).toBe("Игрок");
    expect(core.hp).toBe(22);
    expect(core.notes).toBe("Запись");
    expect(core.attributes[0].modifier).toBe(4);
    expect(attributeModifier(8)).toBe(-1);
    expect(attributeModifier(9)).toBe(-1);
  });
  it("does not invent backstory, ability resources or damage types", () => {
    const d = decodeTilzitDetails({
      biography: { backstory: "Запись игрока", age: 39 },
      weapons: { shield: { damageType: "Дробящий" } },
    });
    expect(d.biography.backstory).toBe("Запись игрока");
    expect(d.biography.age).toBe(39);
    expect(d.weapons.shield.damageType).toBe("Дробящий");
    expect(d.weapons.sword.damageType).toBe("");
    expect(d.abilities).toEqual([]);
    expect(decodeTilzitDetails(null).biography.backstory).toBe("");
  });
  it("clamps damage and healing using actual change rather than requested amount", () => {
    expect(changeHealth(2, 12, 30, "damage")).toEqual({ hp: 0, delta: -2 });
    expect(changeHealth(9, 12, 30, "heal")).toEqual({ hp: 12, delta: 3 });
    expect(changeHealth(12, 12, 1, "heal")).toEqual({ hp: 12, delta: 0 });
    for (const amount of [-1, 1.5, NaN, Infinity])
      expect(changeHealth(9, 12, amount, "damage")).toBeNull();
    expect(changeHealth(9, null, 2, "heal")).toBeNull();
  });
});
describe("saved grid layouts", () => {
  it("keeps resized, reordered and collapsed blocks without touching character data", () => {
    const blocks = moveBlock(defaultLayout(), "notes", "attributes");
    blocks[0] = { ...blocks[0], width: 12, height: 9, collapsed: true };
    expect(decodeLayout(JSON.stringify({ version: 1, blocks }))).toEqual(
      blocks,
    );
    expect(blocks[0].id).toBe("notes");
  });
  it("recovers malformed and partial layouts with bounded sizes and no duplicate blocks", () => {
    expect(decodeLayout("{")).toEqual(defaultLayout());
    const blocks = decodeLayout(
      JSON.stringify({
        version: 1,
        blocks: [
          { id: "notes", width: 99, height: -1 },
          { id: "notes", width: 7 },
          { id: "bad" },
        ],
      }),
    );
    expect(blocks).toHaveLength(10);
    expect(blocks[0].width).toBe(12);
    expect(blocks[0].height).toBe(7);
  });
  it("packs extreme sizes around the portrait without overlapping or escaping the grid", () => {
    for (let turn = 0; turn < 50; turn++) {
      const blocks = defaultLayout().map((b, index) => ({
        ...b,
        width: 4 + ((index + turn) % 9),
        height: 7 + ((index * turn) % 30),
        collapsed: (index + turn) % 3 === 0,
      }));
      const placed = packLayout(blocks).map((b) => ({
        ...b,
        height: b.collapsed ? 2 : b.height,
      }));
      const all = [...placed, { x: 0, y: 0, width: 4, height: 36 }];
      for (let i = 0; i < all.length; i++) {
        const a = all[i];
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(12);
        for (let j = i + 1; j < all.length; j++) {
          const b = all[j];
          expect(
            a.x < b.x + b.width &&
              a.x + a.width > b.x &&
              a.y < b.y + b.height &&
              a.y + a.height > b.y,
          ).toBe(false);
        }
      }
    }
  });
});
