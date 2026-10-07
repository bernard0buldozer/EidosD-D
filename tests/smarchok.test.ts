import { describe, expect, it } from "vitest";
import {
  defaultCore,
  normalizeCore,
  decodeCore,
  coreReducer,
} from "../src/state/core";
import { smarchok } from "../src/data/smarchok";
import { warrior } from "../src/data/warrior";
import {
  initialSmarchok,
  smarchokAction,
  decodeSmarchok,
  type Body,
} from "../src/mechanics/smarchok/rules";
import { physicalResult } from "../src/dice/DiceProvider";
const body = (status: Body["status"] = "saved"): Body => ({
  id: "corpse",
  name: "Тело",
  description: "",
  notes: "",
  hp: null,
  maxHp: null,
  status,
  condition: "",
  gained: null,
});
const core = () => ({ ...defaultCore(smarchok), hp: 5, maxHp: 12 });
const ready = () => ({
  ...initialSmarchok(),
  current: 20,
  maximum: 30,
  bodies: [body()],
});
describe("Smarchok mechanics", () => {
  it("leaves unspecified numbers unset and never gives the mushroom body HP", () => {
    expect(defaultCore(smarchok).hp).toBeNull();
    expect(initialSmarchok().maximum).toBeNull();
    expect(smarchok.attributes.map((a) => a.modifier)).toEqual([
      0, 2, 1, 1, 2, -1,
    ]);
  });
  it.each([1, 2, 3, 5])("spends exact ability cost %i", (cost) => {
    const s = ready();
    const result = smarchokAction(s, core(), {
      type: "ability",
      label: "Проверка",
      cost,
    });
    expect(result.state.current).toBe(20 - cost);
    expect(s.current).toBe(20);
  });
  it("blocks insufficient resources without changing state or log", () => {
    const s = { ...ready(), current: 2 };
    const result = smarchokAction(s, core(), {
      type: "ability",
      label: "Запугивание",
      cost: 3,
    });
    expect(result.state).toBe(s);
    expect(result.error).toContain("Недостаточно");
  });
  it("requires an explicit resource balance", () => {
    expect(
      smarchokAction(initialSmarchok(), core(), {
        type: "ability",
        label: "Связь",
        cost: 1,
      }).error,
    ).toContain("Сначала");
  });
  it("heals exactly 1 HP per resource without dice", () => {
    const result = smarchokAction(ready(), core(), { type: "heal", amount: 4 });
    expect(result.hp).toBe(9);
    expect(result.state.current).toBe(16);
  });
  it("charges only actual healing and never exceeds maximum", () => {
    const result = smarchokAction(
      { ...ready(), current: 2 },
      { ...core(), hp: 11 },
      { type: "heal", amount: 10 },
    );
    expect(result.hp).toBe(12);
    expect(result.state.current).toBe(1);
  });
  it("rejects healing when actual healing cannot be afforded", () => {
    const s = { ...ready(), current: 2 };
    expect(smarchokAction(s, core(), { type: "heal", amount: 4 }).state).toBe(
      s,
    );
  });
  it("rejects healing when HP is unconfigured or full", () => {
    expect(
      smarchokAction(ready(), defaultCore(smarchok), {
        type: "heal",
        amount: 1,
      }).error,
    ).toBeTruthy();
    expect(
      smarchokAction(
        ready(),
        { ...core(), hp: 12 },
        { type: "heal", amount: 1 },
      ).error,
    ).toContain("здоров");
  });
  it.each([0, -1, 1.5, NaN])(
    "rejects invalid amount %s atomically",
    (amount) => {
      const s = ready();
      expect(
        smarchokAction(s, core(), { type: "process", bodyId: "corpse", amount })
          .state,
      ).toBe(s);
    },
  );
  it("marks a whole corpse processed and prevents raising or processing twice", () => {
    const result = smarchokAction(ready(), core(), {
      type: "process",
      bodyId: "corpse",
      amount: 3,
    });
    expect(result.state.current).toBe(23);
    expect(result.state.bodies[0].status).toBe("processed");
    expect(result.state.bodies[0].gained).toBe(3);
    expect(
      smarchokAction(result.state, core(), { type: "raise", bodyId: "corpse" })
        .state,
    ).toBe(result.state);
    expect(
      smarchokAction(result.state, core(), {
        type: "process",
        bodyId: "corpse",
        amount: 3,
      }).state,
    ).toBe(result.state);
  });
  it("does not consume a corpse if resource gain would overflow", () => {
    const s = { ...ready(), current: 29 };
    const result = smarchokAction(s, core(), {
      type: "process",
      bodyId: "corpse",
      amount: 2,
    });
    expect(result.state).toBe(s);
    expect(result.error).toContain("максимум");
  });
  it("raises a saved body for five and forbids duplicate ownership", () => {
    const result = smarchokAction(ready(), core(), {
      type: "raise",
      bodyId: "corpse",
    });
    expect(result.state.current).toBe(15);
    expect(result.state.bodies[0].status).toBe("raised");
    expect(
      smarchokAction(result.state, core(), { type: "raise", bodyId: "corpse" })
        .state,
    ).toBe(result.state);
  });
  it("supports arbitrary counts of user named undead without a summon limit", () => {
    let s = { ...ready(), current: 500, maximum: 500 };
    for (let i = 0; i < 70; i++)
      s = smarchokAction(s, core(), { type: "raise", name: `Тело ${i}` })
        .state as typeof s;
    expect(s.bodies).toHaveLength(71);
    expect(s.current).toBe(150);
  });
  it("requires a user provided name for new undead", () => {
    expect(
      smarchokAction(ready(), core(), { type: "raise", name: " " }).error,
    ).toBeTruthy();
  });
  it("preserves tracked states and mechanical ledger on reload", () => {
    const s = smarchokAction(ready(), core(), {
      type: "process",
      bodyId: "corpse",
      amount: 3,
    }).state;
    expect(decodeSmarchok(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(decodeSmarchok({ current: "oops", bodies: [{}] })).toEqual(
      initialSmarchok(),
    );
  });
});
describe("editable shared core and physical results", () => {
  it("edits maximum health beyond original twelve and caps only to edited maximum", () => {
    const c = normalizeCore({ ...defaultCore(warrior), maxHp: 50, hp: 45 });
    expect(c.hp).toBe(45);
    expect(normalizeCore({ ...c, maxHp: 20 }).hp).toBe(20);
  });
  it("round-trips all custom fields without an inferred attribute modifier", () => {
    const c = defaultCore(warrior);
    c.maxHp = 50;
    c.hp = 45;
    c.defense = 22;
    c.speed = 9;
    c.level = 8;
    c.attributes[0].score = 19;
    c.attributes[0].modifier = 7;
    c.skills = [{ id: "s", name: "Навык", bonus: 6 }];
    c.proficiencies = "Щиты";
    c.items = [
      {
        id: "i",
        name: "Предмет",
        quantity: 2,
        description: "Описание",
        notes: "Заметка",
        category: "Инструменты",
        equipped: true,
      },
    ];
    c.journal = [
      {
        id: "j",
        category: "NPC / связи",
        name: "Имя",
        description: "Описание",
        notes: "Заметка",
        met: "Место",
        status: "Друг",
        timestamp: 1,
      },
    ];
    expect(decodeCore(JSON.parse(JSON.stringify(c)), warrior)).toEqual(c);
  });
  it("sums mixed physical dice plus an explicit modifier", () => {
    const r = physicalResult(
      {
        label: "Пул",
        kind: "free",
        pool: [
          { sides: 20, quantity: 1 },
          { sides: 6, quantity: 2 },
        ],
        modifier: -1,
      },
      [
        { sides: 20, value: 15 },
        { sides: 6, value: 2 },
        { sides: 6, value: 6 },
      ],
    );
    expect(r.total).toBe(22);
    expect(r.values).toEqual([15, 2, 6]);
  });
  it("uses the smaller physical d20 for shield disadvantage", () => {
    const r = physicalResult(
      {
        label: "Щит",
        kind: "attack",
        pool: [{ sides: 20, quantity: 2 }],
        modifier: 5,
        disadvantage: true,
      },
      [
        { sides: 20, value: 19 },
        { sides: 20, value: 3 },
      ],
    );
    expect(r.total).toBe(8);
    expect(r.selectedIndex).toBe(1);
  });
  it("does not invent an unknown parry formula", () => {
    expect(
      physicalResult(
        {
          label: "Парирование",
          kind: "parry",
          pool: [{ sides: 20, quantity: 1 }],
          modifier: null,
        },
        [{ sides: 20, value: 20 }],
      ).total,
    ).toBeNull();
  });
  it("merges new rolls with updated core without dropping edits", () => {
    let s = { core: core(), mechanic: ready(), lastRoll: null, history: [] };
    s = coreReducer(s, {
      type: "core",
      patch: { name: "Новое имя" },
    }) as typeof s;
    const r = physicalResult(
      {
        label: "Сила",
        kind: "attribute",
        pool: [{ sides: 20, quantity: 1 }],
        modifier: 0,
      },
      [{ sides: 20, value: 12 }],
    );
    const next = coreReducer(s, { type: "roll", roll: r });
    expect(next.core.name).toBe("Новое имя");
    expect(next.history[0]).toBe(r);
  });
});
describe("saved data validation", () => {
  it("keeps a legal mixed physical roll across a reload", async () => {
    const { validRoll } = await import("../src/state/core");
    const r = physicalResult(
      {
        label: "Пул",
        kind: "free",
        pool: [
          { sides: 6, quantity: 2 },
          { sides: 20, quantity: 1 },
        ],
        modifier: 0,
      },
      [
        { sides: 6, value: 2 },
        { sides: 6, value: 4 },
        { sides: 20, value: 20 },
      ],
    );
    expect(validRoll(JSON.parse(JSON.stringify(r)))).toBe(true);
    expect(validRoll({ ...r, dice: [{ sides: 6, value: 20 }] })).toBe(false);
    expect(validRoll({ ...r, values: [] })).toBe(false);
  });
  it("does not accept inherited object names as warrior stances", async () => {
    const { isStanceId } = await import("../src/mechanics/warrior/config");
    expect(isStanceId("constructor")).toBe(false);
    expect(isStanceId("toString")).toBe(false);
  });
});
it("migrates a true v1 warrior session without losing spent actions", async () => {
  const { decodeState } = await import("../src/state/persistence");
  const { initialWarriorState } = await import(
    "../src/mechanics/warrior/rules"
  );
  const mechanic = initialWarriorState();
  mechanic.phase = "combat";
  mechanic.round = 3;
  mechanic.spent.main = true;
  mechanic.spent.reaction = true;
  const migrated = decodeState(
    JSON.stringify({
      version: 1,
      state: {
        core: {
          name: "Старое имя",
          hp: 7,
          wallet: "4",
          notes: "Старые заметки",
          portrait: null,
        },
        mechanic,
        history: [],
        lastRoll: null,
      },
    }),
  );
  expect(migrated.core.hp).toBe(7);
  expect(migrated.core.maxHp).toBe(12);
  expect(migrated.core.notes).toBe("Старые заметки");
  expect(migrated.mechanic.spent.main).toBe(true);
  expect(migrated.mechanic.spent.reaction).toBe(true);
  expect(migrated.mechanic.round).toBe(3);
});
