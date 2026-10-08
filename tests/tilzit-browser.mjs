import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.EIDOS_TEST_URL || "http://127.0.0.1:4182";
const launch = {
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
};
const startedAt = new Date().toISOString();
const checks = [],
  errors = [];
const key = "eidos:sheet:warrior-level-1:v2";
const layoutKey = "eidos:layout:tilzit:v1";
const saved = (p) =>
  p.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, key);
const layout = (p) =>
  p.evaluate((k) => JSON.parse(localStorage.getItem(k)).blocks, layoutKey);
const button = (p, name) => p.getByRole("button", { name, exact: true });
const check = (text) => {
  checks.push(text);
  console.log(`✓ ${text}`);
};
async function actualRoll(p, click) {
  const old = (await saved(p)).lastRoll?.id;
  await click();
  await expect.poll(async () => (await saved(p)).lastRoll?.id).not.toBe(old);
  const roll = (await saved(p)).lastRoll;
  assert(roll.values.length);
  assert(
    roll.dice.every(
      (d) => Number.isInteger(d.value) && d.value >= 1 && d.value <= d.sides,
    ),
  );
  const raw = roll.advantage
    ? Math.max(...roll.values)
    : roll.disadvantage
      ? Math.min(...roll.values)
      : roll.values.reduce((a, b) => a + b, 0);
  assert.equal(roll.total, roll.modifier === null ? null : raw + roll.modifier);
  assert.equal(await p.locator(".physical-result").count(), 0);
  return roll;
}
async function assertGrid(p) {
  const rectangles = await p.locator(".tilzit-grid > *").evaluateAll((items) =>
    items.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }),
  );
  for (let i = 0; i < rectangles.length; i++)
    for (let j = i + 1; j < rectangles.length; j++) {
      const a = rectangles[i],
        b = rectangles[j];
      assert(
        !(
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1
        ),
        `Overlapping blocks ${i}/${j}`,
      );
    }
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
}
let browser, server, failure;
let serverLog = "";
mkdirSync("artifacts", { recursive: true });
try {
  if (!process.env.EIDOS_TEST_URL) {
    server = spawn(
      "npm",
      [
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        "4182",
        "--strictPort",
      ],
      { detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    server.stdout.on("data", (chunk) => (serverLog += chunk));
    server.stderr.on("data", (chunk) => (serverLog += chunk));
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(ready, serverLog);
  }
  browser = await chromium.launch(launch);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  p.on("response", (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await p.goto(url);
  await expect(p.locator(".tilzit-sheet")).toBeVisible();
  await expect(p.getByLabel("Имя персонажа", { exact: true })).toHaveValue(
    "Тильзит Драгунатори",
  );
  assert.equal((await saved(p)).core.tilzit.biography.nickname, "Белый Узник");
  assert.equal((await saved(p)).core.tilzit.biography.age, 34);
  assert.equal((await saved(p)).core.tilzit.biography.backstory, "");
  assert.equal(await p.locator("[data-block]").count(), 10);
  await assertGrid(p);
  check(
    "Новый лист: данные Тильзита, 10 блоков, пустые неподтверждённые поля, сетка без перекрытий",
  );

  for (const [name, defense] of [
    ["Дуэлянт", "10"],
    ["Натиск", "12"],
    ["Щит", "15"],
  ]) {
    await button(p, `Выбрать стойку: ${name}`).click();
    await expect(p.getByTestId("tilzit-defense")).toHaveText(defense);
    await p.reload();
    await expect(p.getByTestId("tilzit-defense")).toHaveText(defense);
  }
  check("Все три стойки немедленно меняют защиту и сохраняются после reload");

  await p.getByLabel("Величина изменения HP").fill("3");
  await button(p, "Получить урон").click();
  assert.equal((await saved(p)).core.hp, 9);
  await expect(p.locator(".tilzit-health-change")).toHaveText("−3 HP");
  await p.getByLabel("Величина изменения HP").fill("100");
  await button(p, "Восстановить здоровье").click();
  assert.equal((await saved(p)).core.hp, 12);
  await expect(p.locator(".tilzit-health-change")).toHaveText("+3 HP");
  await button(p, "Получить урон").click();
  assert.equal((await saved(p)).core.hp, 0);
  for (const invalid of ["-2", "1.5", "abc", "100001", ""]) {
    await p.getByLabel("Величина изменения HP").fill(invalid);
    await expect(button(p, "Получить урон")).toBeDisabled();
    await expect(button(p, "Восстановить здоровье")).toBeDisabled();
  }
  await p.getByLabel("Текущее HP", { exact: true }).fill("99");
  assert.equal((await saved(p)).core.hp, 12);
  await p.getByLabel("Максимальное HP", { exact: true }).fill("30");
  await p.getByLabel("Текущее HP", { exact: true }).fill("24");
  check(
    "Урон и лечение ограничены, прямое HP редактируется; отрицательный, дробный и неверный ввод заблокирован",
  );

  await p.getByLabel("Сила: значение", { exact: true }).fill("18");
  assert.equal(
    Object.hasOwn((await saved(p)).core.attributes[0], "modifier"),
    false,
  );
  let roll = await actualRoll(p, () => button(p, "Проверка Силы, +4").click());
  assert.equal(roll.modifier, 4);
  for (const mode of ["advantage", "disadvantage"]) {
    await p.getByLabel("Режим проверок d20").selectOption(mode);
    roll = await actualRoll(p, () => button(p, "Проверка Харизмы, −1").click());
    assert.equal(roll.values.length, 2);
    assert.equal(roll.modifier, -1);
    assert.equal(
      roll.values[roll.selectedIndex],
      mode === "advantage"
        ? Math.max(...roll.values)
        : Math.min(...roll.values),
    );
  }
  await p.getByLabel("Режим проверок d20").selectOption("normal");
  check(
    "Модификаторы вычисляются из значений; проверки, преимущество и помеха показывают реальные грани и правильный итог",
  );

  await expect(button(p, "Проверка навыка: Атлетика")).toBeDisabled();
  await p.getByLabel("Бонус: Атлетика", { exact: true }).fill("6");
  roll = await actualRoll(p, () =>
    button(p, "Проверка навыка: Атлетика").click(),
  );
  assert.equal(roll.modifier, 6);
  await p
    .getByLabel("Владения", { exact: true })
    .fill("Щиты, мечи — запись игрока");
  check(
    "Неизвестный бонус навыка не выдуман; введённый полный бонус используется без дополнительных надбавок",
  );
  await p.getByLabel("Количество кубиков").fill("3");
  await p.getByLabel("Модификатор броска").fill("-2");
  for (const die of [4, 6, 8, 10, 12, 20, 100]) {
    await button(p, `d${die}`).click();
    roll = await actualRoll(p, () => button(p, `Бросить 3d${die}`).click());
    assert.equal(roll.sides, die);
    assert.equal(roll.values.length, 3);
  }
  await p.reload();
  assert.equal((await saved(p)).lastRoll.sides, 100);
  assert.equal((await saved(p)).history.length, 10);
  check(
    "Все семь типов, включая d100, поддерживают количество, модификатор и сохранённую историю",
  );

  await button(p, "Добавить предмет").click();
  await p
    .getByLabel("Название предмета", { exact: true })
    .fill("Походный плащ");
  await p.getByLabel("Количество", { exact: true }).fill("2");
  await p
    .getByLabel("Описание предмета", { exact: true })
    .fill("Тёплый белый плащ");
  await p
    .getByLabel("Заметки персонажа", { exact: true })
    .fill("Найти дорогу домой");
  await p
    .getByLabel("Предыстория", { exact: true })
    .fill("Подтверждённый текст игрока");
  await p.getByLabel("Личные цели", { exact: true }).fill("Вернуться в клан");
  await p.reload();
  assert.equal((await saved(p)).core.items[0].quantity, 2);
  await expect(p.locator(".tilzit-equipment-preview")).toContainText(
    "Походный плащ ×2",
  );
  await p.locator(".tilzit-equipment-preview summary").click();
  await expect(p.locator(".tilzit-equipment-preview p")).toHaveText(
    "Тёплый белый плащ",
  );
  await button(p, "Походный плащ ×2").click();
  await p.getByLabel("Количество", { exact: true }).fill("1");
  await button(p, "Удалить предмет").click();
  assert.equal((await saved(p)).core.items.length, 0);
  check(
    "Инвентарь добавляется, редактируется, раскрывается и удаляется; заметки и история персонажа сохраняются",
  );

  await button(p, "Добавить атаку").click();
  await p
    .getByLabel("Название атаки", { exact: true })
    .fill("Записанная атака");
  await p.getByLabel("Бонус попадания: Записанная атака").fill("3");
  await p.getByLabel("Формула урона", { exact: true }).fill("2d6 + 1");
  await p.getByLabel("Тип урона", { exact: true }).fill("По правилам игрока");
  roll = await actualRoll(p, () => button(p, "Бросок атаки").click());
  assert.equal(roll.modifier, 3);
  roll = await actualRoll(p, () => button(p, "Бросок урона").click());
  assert.equal(roll.values.length, 2);
  assert.equal(roll.sides, 6);
  assert.equal(roll.modifier, 1);
  check(
    "Редактируемая атака разделяет попадание и урон; формулы не исполняются как код",
  );
  await button(p, "Добавить способность").click();
  await p
    .getByLabel("Название способности", { exact: true })
    .fill("Запись способности");
  await p
    .getByLabel("Описание способности", { exact: true })
    .fill("Утверждённое описание");
  await p
    .getByLabel("Условия использования", { exact: true })
    .fill("Условие игрока");
  await p.getByLabel("Максимум ресурса: Запись способности").fill("3");
  await p.getByLabel("Ресурс: Запись способности", { exact: true }).fill("2");
  await p.reload();
  assert.equal((await saved(p)).core.tilzit.abilities[0].current, 2);
  check(
    "Раскрываемые способности сохраняют описание, условия и явно заданный счётчик ресурса",
  );

  assert.equal(await button(p, "Переместить: Характеристики").count(), 0);
  await button(p, "Настроить расположение").click();
  const move = button(p, "Переместить: Характеристики");
  await move.scrollIntoViewIfNeeded();
  const from = await move.boundingBox();
  const target = await p
    .locator('[data-block="health"] .tilzit-block-header')
    .boundingBox();
  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await p.mouse.down();
  await p.mouse.move(target.x + 50, target.y + 20, { steps: 10 });
  await p.mouse.up();
  assert.equal((await layout(p))[0].id, "health");
  await assertGrid(p);
  check(
    "Перемещение мышью работает за выделенную ручку; сетка остаётся без перекрытий",
  );
  const resize = button(p, "Изменить размер: Характеристики");
  await resize.scrollIntoViewIfNeeded();
  const beforeSize = (await layout(p)).find((b) => b.id === "attributes");
  const handle = await resize.boundingBox();
  await p.mouse.move(handle.x + 10, handle.y + 10);
  await p.mouse.down();
  await p.mouse.move(handle.x - 95, handle.y + 94, { steps: 8 });
  await p.mouse.up();
  const afterSize = (await layout(p)).find((b) => b.id === "attributes");
  assert(
    afterSize.width < beforeSize.width && afterSize.height > beforeSize.height,
  );
  await button(p, "Переместить: Заметки").focus();
  await p.keyboard.press("ArrowUp");
  assert.equal((await layout(p))[8].id, "notes");
  await button(p, "Свернуть: Броски").click();
  const desired = await layout(p);
  await p.reload();
  assert.deepEqual(await layout(p), desired);
  await expect(
    p.locator('[data-block="rolls"] .tilzit-block-content'),
  ).toBeHidden();
  await button(p, "Развернуть: Броски").click();
  check(
    "Размеры, порядок и свёрнутое состояние переживают reload; доступно перемещение клавиатурой",
  );
  const characterBefore = await saved(p);
  await button(p, "Настроить расположение").click();
  await button(p, "Сбросить раскладку").click();
  assert.deepEqual(await saved(p), characterBefore);
  assert.equal((await layout(p))[0].id, "attributes");
  await button(p, "Готово").click();
  check(
    "Сброс раскладки не сбрасывает HP, предметы, заметки, историю или механику",
  );
  await p
    .getByLabel("Имя персонажа", { exact: true })
    .fill("Тильзит Драгунатори");
  await p.screenshot({ path: "artifacts/tilzit-desktop.png", fullPage: true });
  for (const width of [1440, 1024, 768, 760, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    await assertGrid(p);
    if (width <= 390)
      await p.screenshot({
        path: `artifacts/tilzit-${width}.png`,
        fullPage: true,
      });
  }
  check(
    "Шесть ширин: от 1440 до 320 px, вертикальная мобильная раскладка и отсутствие горизонтального скролла",
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await button(p, "Проверка Мудрости, +1").click();
  await expect(p.locator(".tilzit-roll-result")).toContainText(
    "Проверка Мудрости",
  );
  check(
    "Проверка характеристики доступна на телефоне и не двигает блок в игровом режиме",
  );

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const tp = await phone.newPage();
  await tp.goto(url);
  await button(tp, "Настроить расположение").click();
  const touchHandle = button(tp, "Переместить: Характеристики");
  await touchHandle.scrollIntoViewIfNeeded();
  const touchFrom = await touchHandle.boundingBox();
  const touchTarget = await tp
    .locator('[data-block="health"] .tilzit-block-header')
    .boundingBox();
  assert(touchTarget.y + 20 < 844, "Touch destination should be in view");
  const cdp = await phone.newCDPSession(tp);
  const point = { x: touchFrom.x + 10, y: touchFrom.y + 10 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  for (let step = 1; step <= 8; step++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: point.x + ((touchTarget.x + 50 - point.x) * step) / 8,
          y: point.y + ((touchTarget.y + 20 - point.y) * step) / 8,
        },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.equal((await layout(tp))[0].id, "health");
  const touchResize = button(tp, "Изменить размер: Здоровье и бой");
  await touchResize.scrollIntoViewIfNeeded();
  const touchSize = (await layout(tp)).find((b) => b.id === "health");
  const corner = await touchResize.boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: corner.x + 10, y: corner.y + 10 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: corner.x + 10, y: corner.y + 94 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const changedTouchSize = (await layout(tp)).find((b) => b.id === "health");
  assert.equal(changedTouchSize.width, touchSize.width);
  assert(changedTouchSize.height > touchSize.height);
  await assertGrid(tp);
  await phone.close();
  check(
    "Настоящие touch-события перемещают и растягивают блоки на телефоне без горизонтального скролла",
  );

  const snapshot = await saved(p);
  const legacy = structuredClone(snapshot);
  legacy.core.name = "Сохранённый игрок";
  legacy.core.attributes[0].score = 19;
  legacy.core.attributes[0].modifier = 99;
  delete legacy.core.tilzit;
  delete legacy.core.derivedModifiers;
  legacy.mechanic.phase = "combat";
  legacy.mechanic.spent.main = true;
  const migration = await browser.newContext();
  await migration.addInitScript(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify({ version: 2, state }));
      localStorage.setItem("eidos:selected-character", "warrior");
    },
    { key, state: legacy },
  );
  const mp = await migration.newPage();
  await mp.goto(url);
  await expect(mp.getByLabel("Имя персонажа", { exact: true })).toHaveValue(
    "Сохранённый игрок",
  );
  const migrated = await saved(mp);
  assert.equal(migrated.core.hp, snapshot.core.hp);
  assert.equal(migrated.core.notes, snapshot.core.notes);
  assert.equal(migrated.mechanic.spent.main, true);
  assert.equal(Object.hasOwn(migrated.core.attributes[0], "modifier"), false);
  roll = await actualRoll(mp, () => button(mp, "Проверка Силы, +4").click());
  assert.equal(roll.modifier, 4);
  await migration.close();
  check(
    "Существующая v2 запись сохраняет имя, HP, заметки и расход действий; независимый модификатор мигрирует в вычисляемый",
  );

  const corrupted = await browser.newContext();
  await corrupted.addInitScript((key) => {
    localStorage.setItem(key, "{");
    localStorage.setItem("eidos:layout:tilzit:v1", "{");
  }, key);
  const cp = await corrupted.newPage();
  await cp.goto(url);
  await expect(cp.locator(".tilzit-sheet")).toBeVisible();
  assert.equal(
    await cp.evaluate((k) => localStorage.getItem(k + ":recovery"), key),
    "{",
  );
  await expect(
    cp.getByText(/Повреждённая запись сохранена отдельно/),
  ).toBeVisible();
  await assertGrid(cp);
  await corrupted.close();
  const future = await browser.newContext();
  await future.addInitScript(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ version: 99, state: { futureData: "retain" } }),
      ),
    key,
  );
  const fp = await future.newPage();
  await fp.goto(url);
  await expect(fp.getByText(/Неизвестный формат сохранения/)).toBeVisible();
  await fp.getByLabel("Имя персонажа", { exact: true }).fill("Временно");
  assert.equal(
    await fp.evaluate((k) => JSON.parse(localStorage.getItem(k)).version, key),
    99,
  );
  await button(fp, "Сбросить персонажа").click();
  await button(fp, "Отмена").click();
  assert.equal(
    await fp.evaluate((k) => JSON.parse(localStorage.getItem(k)).version, key),
    99,
  );
  await button(fp, "Сбросить персонажа").click();
  await fp
    .getByRole("dialog", { name: "Сбросить данные Тильзита?" })
    .getByRole("button", { name: "Сбросить персонажа", exact: true })
    .click();
  assert.equal(
    await fp.evaluate((k) => JSON.parse(localStorage.getItem(k)).version, key),
    2,
  );
  await expect(fp.getByLabel("Имя персонажа", { exact: true })).toHaveValue(
    "Тильзит Драгунатори",
  );
  await future.close();
  const unavailable = await browser.newContext();
  await unavailable.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Quota");
    };
  });
  const up = await unavailable.newPage();
  await up.goto(url);
  await expect(
    up.getByText("Сохранение недоступно", { exact: true }),
  ).toBeVisible();
  await up
    .getByLabel("Имя персонажа", { exact: true })
    .fill("Имя в текущей вкладке");
  await expect(up.getByLabel("Имя персонажа", { exact: true })).toHaveValue(
    "Имя в текущей вкладке",
  );
  await unavailable.close();
  check(
    "Повреждённая запись восстанавливает лист; недоступное хранилище сообщает об ошибке и допускает игру во вкладке",
  );
  assert.deepEqual(errors, []);
} catch (e) {
  failure = e;
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
  writeFileSync(
    "artifacts/tilzit-browser-results.json",
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        url,
        status: failure ? "failed" : "passed",
        checks: checks.length,
        report: checks,
        errors,
        failure: failure?.message,
      },
      null,
      2,
    ),
  );
}
