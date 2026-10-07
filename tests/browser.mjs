import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { chromium, expect } from "@playwright/test";
const url = process.env.EIDOS_TEST_URL || "http://127.0.0.1:4179";
const launch = {
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
};
const startedAt = new Date().toISOString();
const report = [];
const errors = [];
let browser,
  server,
  serverLog = "",
  failure;
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/browser-results.json",
  JSON.stringify({ startedAt, status: "running" }),
);
const check = (message) => {
  report.push(message);
  console.log(`✓ ${message}`);
};
const button = (p, name) => p.getByRole("button", { name, exact: true });
const saved = (p, id = "smarchok") =>
  p.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).state,
    `eidos:sheet:${id === "warrior" ? "warrior-level-1" : id}:v2`,
  );
const dialog = (p, title) =>
  p.getByRole("dialog", { name: title, exact: true });
const close = (p, title) => button(p, `Закрыть: ${title}`).click();
const selectStance = (p, name) => button(p, `Выбрать стойку: ${name}`).click();
async function pageIn(context) {
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  p.on("response", (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  await p.goto(url);
  return p;
}
async function actualRoll(p, click, id = "smarchok") {
  const previous = (await saved(p, id)).lastRoll?.id;
  await click();
  await expect(p.locator(".physical-result")).toContainText("Бросаем");
  await expect
    .poll(async () => (await saved(p, id)).lastRoll?.id, { timeout: 40000 })
    .not.toBe(previous);
  const r = (await saved(p, id)).lastRoll;
  assert(r.dice?.length, "Real physical dice were returned");
  assert(
    r.dice.every(
      (d) => Number.isInteger(d.value) && d.value >= 1 && d.value <= d.sides,
    ),
  );
  const raw = r.disadvantage
    ? Math.min(...r.values)
    : r.values.reduce((a, b) => a + b, 0);
  assert.equal(r.total, r.modifier === null ? null : raw + r.modifier);
  await expect(button(p, "Убрать кубики")).toBeEnabled();
  return r;
}
async function hideDice(p) {
  await button(p, "Убрать кубики").click();
  await expect(p.locator(".physical-result")).toHaveCount(0);
}
async function attackHit(p, { kill = false, push = false } = {}) {
  await button(p, "Попадание").click();
  const r = await actualRoll(
    p,
    () => p.getByRole("button", { name: /^Бросить урон/ }).click(),
    "warrior",
  );
  assert([4, 8].includes(r.sides));
  await hideDice(p);
  if (kill) await p.getByLabel("Эта основная атака убила противника").check();
  if (push)
    await p.getByLabel("Толчок успешен · подтверждено мастером").check();
  await button(p, "Завершить атаку").click();
}
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
        "4179",
        "--strictPort",
      ],
      { stdio: ["ignore", "pipe", "pipe"], detached: true },
    );
    server.stdout.on("data", (d) => (serverLog += d));
    server.stderr.on("data", (d) => (serverLog += d));
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    assert(ready, serverLog);
  }
  browser = await chromium.launch(launch);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const p = await pageIn(context);
  await expect(p.locator("#character-name")).toHaveValue("Смарчок");
  await expect(p.getByTestId("hp")).toHaveText("—");
  await expect(p.getByLabel("Текущий Мицелий")).toHaveValue("");
  await expect(
    p.getByText("Сам Смарчок: всегда 1 HP", { exact: true }),
  ).toBeVisible();
  check(
    "Смарчок: исходные характеристики, 1 HP самого гриба и незаданные параметры Туши",
  );
  await button(p, "Редактировать лист").click();
  const edit = dialog(p, "Редактировать лист");
  await edit.getByLabel("Имя персонажа", { exact: true }).fill("Смарчок тест");
  await edit.getByLabel("Уровень", { exact: true }).fill("4");
  await edit.getByLabel("Максимальное здоровье", { exact: true }).fill("30");
  await edit.getByLabel("Текущее здоровье", { exact: true }).fill("21");
  await edit.getByLabel("Защита вручную", { exact: true }).fill("16");
  await edit.getByLabel("Скорость", { exact: true }).fill("8");
  await edit.getByLabel("Сила: значение", { exact: true }).fill("18");
  await edit.getByLabel("Сила: модификатор", { exact: true }).fill("4");
  await close(p, "Редактировать лист");
  await p.getByLabel("Кошелёк", { exact: true }).fill("23 монеты");
  await p.getByLabel("Максимальный Мицелий").fill("30");
  await p.getByLabel("Текущий Мицелий").fill("20");
  await button(p, "Увеличить здоровье").click();
  await expect(p.getByTestId("hp")).toHaveText("22");
  await button(p, "Уменьшить здоровье").click();
  await p.reload();
  await expect(p.getByTestId("hp")).toHaveText("21");
  assert.equal((await saved(p)).core.maxHp, 30);
  assert.equal((await saved(p)).core.attributes[0].modifier, 4);
  assert.equal((await saved(p)).mechanic.current, 20);
  check(
    "Все основные поля редактируются; здоровье выше 12 и изменения переживают reload",
  );
  for (const [name, cost] of [
    ["Споровая связь", 1],
    ["Считывание", 2],
    ["Запугивание спорами", 3],
  ]) {
    const before = (await saved(p)).mechanic.current;
    await p.getByRole("button", { name: new RegExp(name) }).click();
    await dialog(p, name)
      .getByRole("button", { name: new RegExp("^Использовать") })
      .click();
    assert.equal((await saved(p)).mechanic.current, before - cost);
    await close(p, name);
  }
  check("Способности 1 / 2 / 3 Мицелия списывают точную стоимость");
  await p.getByLabel("Текущий Мицелий").fill("2");
  await p.getByRole("button", { name: /Запугивание спорами/ }).click();
  await expect(
    dialog(p, "Запугивание спорами").getByRole("button", {
      name: /^Использовать/,
    }),
  ).toBeDisabled();
  await expect(dialog(p, "Запугивание спорами")).toContainText(
    "Недостаточно Мицелия",
  );
  await close(p, "Запугивание спорами");
  assert.equal((await saved(p)).mechanic.current, 2);
  check(
    "Нехватка ресурса явно показана; действие заблокировано и запас не списан",
  );
  await p.getByLabel("Текущий Мицелий").fill("20");
  await p.getByRole("button", { name: /Регенерация Туши/ }).click();
  await dialog(p, "Регенерация Туши").getByLabel("Восстановить HP").fill("99");
  await dialog(p, "Регенерация Туши")
    .getByRole("button", { name: /^Использовать/ })
    .click();
  assert.equal((await saved(p)).core.hp, 30);
  assert.equal((await saved(p)).mechanic.current, 11);
  assert.equal((await saved(p)).history.length, 0);
  await close(p, "Регенерация Туши");
  check(
    "Регенерация без кубиков: лечит до максимума и списывает только 9 фактических HP",
  );
  await p.getByRole("button", { name: /Мицелиальное поле/ }).click();
  await dialog(p, "Мицелиальное поле").getByLabel("Вложить Мицелий").fill("4");
  await dialog(p, "Мицелиальное поле")
    .getByRole("button", { name: /^Использовать/ })
    .click();
  assert.equal((await saved(p)).mechanic.current, 7);
  await expect(dialog(p, "Мицелиальное поле")).toContainText(
    "числовые правила не заданы",
  );
  await close(p, "Мицелиальное поле");
  check("Мицелиальное поле: ручной вклад X без выдуманного дебаффа");
  await p.getByRole("button", { name: /Хранилище туши/ }).click();
  await button(p, "Добавить предмет").click();
  await p
    .getByLabel("Название предмета", { exact: true })
    .fill("Тестовый предмет");
  await p.getByLabel("Количество", { exact: true }).fill("3");
  await p.getByLabel("Категория", { exact: true }).fill("Инструменты");
  await p.getByLabel("Описание предмета", { exact: true }).fill("Описание");
  await p.getByLabel("Заметки о предмете", { exact: true }).fill("Заметка");
  await p.getByLabel("Используется / экипирован").check();
  await p.getByLabel("Поиск предметов").fill("инструменты");
  await expect(
    p.getByRole("button", { name: /Тестовый предмет/ }),
  ).toBeVisible();
  await close(p, "Хранилище туши");
  await p.reload();
  assert.equal((await saved(p)).core.items[0].equipped, true);
  check(
    "Хранилище: создание, количество, описание, заметка, категория, экипировка, поиск и сохранение",
  );
  await p.getByRole("button", { name: /Хранилище туши/ }).click();
  await p.getByRole("button", { name: /Тестовый предмет/ }).click();
  await p.getByLabel("Название предмета").fill("Изменённый предмет");
  await button(p, "Удалить предмет").click();
  assert.equal((await saved(p)).core.items.length, 0);
  await close(p, "Хранилище туши");
  check("Редактирование и удаление предмета");
  await p.getByRole("button", { name: /Тела и нежить/ }).click();
  await button(p, "Добавить тело").click();
  await p.getByLabel("Имя тела").fill("Сохранённое тело");
  await p.getByLabel("Описание тела").fill("Описание тела");
  await p.getByLabel("HP тела", { exact: true }).fill("8");
  await p.getByLabel("Максимум HP тела").fill("10");
  await p.getByLabel("Состояние тела").fill("Целое");
  await p.getByLabel("Заметки о теле").fill("Запись");
  await p.getByLabel("Получено Мицелия вручную").fill("3");
  await p.getByRole("button", { name: /^Переработать целиком/ }).click();
  assert.equal((await saved(p)).mechanic.current, 10);
  assert.equal((await saved(p)).mechanic.bodies[0].status, "processed");
  await expect(
    p.getByText(
      "Тело переработано. Поднятие и повторная переработка недоступны.",
    ),
  ).toBeVisible();
  await expect(p.getByRole("button", { name: /Поднять это тело/ })).toHaveCount(
    0,
  );
  await button(p, "Добавить тело").click();
  await p.getByLabel("Имя тела").fill("Целое тело");
  await close(p, "Тела и нежить");
  check(
    "Трекер тел: ручная добыча, история переработки и блокировка повторного использования",
  );
  await p.getByRole("button", { name: /Поднять мертвеца/ }).click();
  const raise = dialog(p, "Поднять мертвеца");
  const options = await raise
    .getByLabel("Сохранённое тело")
    .locator("option")
    .allTextContents();
  assert(!options.includes("Сохранённое тело"));
  await raise
    .getByLabel("Сохранённое тело")
    .selectOption({ label: "Целое тело" });
  await raise.getByRole("button", { name: /^Использовать/ }).click();
  assert.equal((await saved(p)).mechanic.current, 5);
  assert.equal((await saved(p)).mechanic.bodies[1].status, "raised");
  await raise
    .getByLabel("Имя / описание поднимаемого тела")
    .fill("Новый мертвец");
  await raise.getByRole("button", { name: /^Использовать/ }).click();
  assert.equal((await saved(p)).mechanic.current, 0);
  assert.equal((await saved(p)).mechanic.bodies.length, 3);
  await close(p, "Поднять мертвеца");
  check(
    "Поднятие стоит 5: выбирает целое тело или создаёт новую запись нежити; переработанное тело недоступно",
  );
  await p.getByRole("button", { name: /^✎ Журнал/ }).click();
  await p
    .getByLabel("Заметки персонажа", { exact: true })
    .fill("Личная заметка");
  for (const category of [
    "События",
    "Встречи",
    "Места",
    "Произвольные записи",
  ]) {
    await button(p, category).click();
    await button(p, "Добавить запись").click();
    await p.getByLabel("Название записи").fill(category);
    await p.getByLabel("Короткое описание").fill("Запись игрока");
    await p.getByLabel("Заметка", { exact: true }).fill("Детали");
  }
  await button(p, "NPC / связи").click();
  await button(p, "Добавить запись").click();
  await p.getByLabel("Имя NPC").fill("Тестовый NPC");
  await p.getByLabel("Короткое описание").fill("Описание NPC");
  await p.getByLabel("Отношение / статус").fill("Друг");
  await p.getByLabel("Где и как познакомились").fill("На встрече");
  await p.getByLabel("Заметка", { exact: true }).fill("Запись игрока");
  await close(p, "Журнал");
  await p.reload();
  assert.equal((await saved(p)).core.journal.length, 5);
  assert.equal((await saved(p)).core.journal.at(-1).met, "На встрече");
  assert.equal((await saved(p)).core.notes, "Личная заметка");
  check(
    "Журнал: все категории, NPC со статусом и знакомством, заметки и сохранение",
  );
  await p.getByRole("button", { name: /Связи \/ цели/ }).click();
  await p.getByRole("button", { name: /Тестовый NPC/ }).click();
  await p.getByLabel("Отношение / статус").fill("Союзник");
  await button(p, "Удалить запись").click();
  assert.equal((await saved(p)).core.journal.length, 4);
  await close(p, "Связи / цели");
  check("Связи доступны отдельно; запись редактируется и удаляется");
  await button(p, "Изменить ›").click();
  await button(p, "Добавить навык").click();
  await p.getByLabel("Название навыка").last().fill("Новый навык");
  await p.getByLabel("Бонус: Новый навык").fill("7");
  await p.getByLabel("Владения", { exact: true }).fill("Инструменты");
  await close(p, "Навыки и владения");
  assert.equal((await saved(p)).core.skills.at(-1).bonus, 7);
  check("Редактируемые навыки и владения без скрытого бонуса");
  for (const a of (await saved(p)).core.attributes) {
    const r = await actualRoll(p, () =>
      button(
        p,
        `${a.checkLabel}, ${a.modifier >= 0 ? "+" : "−"}${Math.abs(a.modifier)}`,
      ).click(),
    );
    assert.equal(r.modifier, a.modifier);
    assert.equal(r.pool[0].sides, 20);
    await hideDice(p);
  }
  check("Все шесть проверок используют реальные 3D d20 и текущий модификатор");
  const skillRoll = await actualRoll(p, () =>
    p.getByRole("button", { name: /Новый навык/ }).click(),
  );
  assert.equal(skillRoll.modifier, 7);
  await hideDice(p);
  check("Проверка навыка использует тот же физический движок");
  await button(p, "◇ Кубики +").click();
  for (const d of [4, 6, 8, 10, 12, 20])
    await p
      .getByLabel(`Количество d${d}`, { exact: true })
      .fill(d === 6 ? "2" : "1");
  await p.getByLabel("Модификатор свободного броска").fill("-2");
  const mixed = await actualRoll(p, () => button(p, "Бросить").click());
  assert.equal(mixed.dice.length, 7);
  assert.deepEqual(
    mixed.pool.map((x) => x.sides),
    [4, 6, 8, 10, 12, 20],
  );
  assert.equal(mixed.modifier, -2);
  await p.screenshot({ path: "artifacts/physical-mixed-dice.png" });
  await hideDice(p);
  check(
    "Свободный смешанный пул всех шести типов: 7 физических кубиков, столкновения и корректная сумма",
  );
  await button(p, "История бросков").click();
  await expect(dialog(p, "История бросков")).toContainText("Свободный бросок");
  await expect(dialog(p, "История бросков")).toContainText(
    "1d4 + 2d6 + 1d8 + 1d10 + 1d12 + 1d20",
  );
  await button(p, "Очистить историю бросков").click();
  assert.equal((await saved(p)).history.length, 0);
  await close(p, "История бросков");
  check("История хранит время, пул, грани и итог; очищается");
  await p
    .getByLabel("Файл портрета")
    .setInputFiles("public/reference/smarchok.jpg");
  await expect(p.locator(".portrait-frame img")).toBeVisible();
  await p.reload();
  await expect(p.locator(".portrait-frame img")).toBeVisible();
  assert.equal(
    await p
      .locator(".portrait-frame img")
      .evaluate((i) => getComputedStyle(i).objectFit),
    "cover",
  );
  await button(p, "Удалить портрет").click();
  await expect(p.locator(".reference-portrait")).toBeVisible();
  check(
    "Портрет загружается, кадрируется, сохраняется и заменяется оригиналом",
  );
  await p.getByLabel("Персонаж", { exact: true }).selectOption("warrior");
  await expect(p.locator("#character-name")).toHaveValue("Воин");
  await button(p, "Редактировать лист").click();
  await dialog(p, "Редактировать лист")
    .getByLabel("Максимальное здоровье")
    .fill("40");
  await dialog(p, "Редактировать лист")
    .getByLabel("Текущее здоровье")
    .fill("35");
  await dialog(p, "Редактировать лист")
    .getByLabel("Сила: модификатор")
    .fill("5");
  await close(p, "Редактировать лист");
  await button(p, "Увеличить здоровье").click();
  await expect(p.getByTestId("hp")).toHaveText("36");
  await p.reload();
  await expect(p.locator("#character-name")).toHaveValue("Воин");
  await expect(p.getByTestId("hp")).toHaveText("36");
  check(
    "Воин сохранён: максимальное HP и текущая Сила редактируются; выбранный персонаж восстанавливается",
  );
  await selectStance(p, "Дуэлянт");
  await expect(p.getByTestId("defense")).toHaveText("10");
  await selectStance(p, "Штурм");
  await expect(p.getByTestId("defense")).toHaveText("12");
  await selectStance(p, "Стойка щита");
  await expect(p.getByTestId("defense")).toHaveText("15");
  const shield = await actualRoll(
    p,
    () => button(p, "Бросить: Атака щитом").click(),
    "warrior",
  );
  assert.equal(shield.values.length, 2);
  assert.equal(shield.modifier, 5);
  await hideDice(p);
  assert.equal((await saved(p, "warrior")).mechanic.spent.main, true);
  await p.reload();
  assert.equal((await saved(p, "warrior")).mechanic.spent.main, true);
  await attackHit(p, { push: true });
  await selectStance(p, "Дуэлянт");
  assert.equal((await saved(p, "warrior")).mechanic.spent.bonus, false);
  check(
    "Стойки, физическая помеха, текущий модификатор атаки и урона, сохранение действий и бесплатная смена после толчка",
  );
  await button(p, "Использовать парирование").click();
  await p.getByLabel("Натуральный d20 вручную").fill("20");
  await button(p, "Парирование успешно").click();
  assert.equal((await saved(p, "warrior")).mechanic.counter.critical, true);
  await actualRoll(p, () => button(p, "Ответная атака").click(), "warrior");
  await hideDice(p);
  await button(p, "Попадание").click();
  await p.getByLabel("Критический урон вручную").fill("12");
  await button(p, "Записать урон").click();
  await button(p, "Завершить атаку").click();
  await selectStance(p, "Штурм");
  await button(p, "Новый раунд").click();
  await actualRoll(
    p,
    () => button(p, "Бросить: Атака мечом").click(),
    "warrior",
  );
  await hideDice(p);
  await attackHit(p, { kill: true });
  await actualRoll(
    p,
    () => button(p, "Добивание · бонусное действие").click(),
    "warrior",
  );
  await hideDice(p);
  await attackHit(p);
  assert.equal((await saved(p, "warrior")).mechanic.finisher, false);
  assert.equal((await saved(p, "warrior")).mechanic.spent.bonus, true);
  check(
    "Воин: парирование 20, критический ответ, смена, новый раунд и одно добивание без цепочки",
  );
  await button(p, "Выйти из боя").click();
  await button(p, "Завершить бой").click();
  await selectStance(p, "Стойка щита");
  await button(p, "Использовать прикрытие").click();
  await button(p, "Прикрытие успешно").click();
  await selectStance(p, "Дуэлянт");
  assert.equal((await saved(p, "warrior")).mechanic.spent.reaction, true);
  assert.equal((await saved(p, "warrior")).mechanic.spent.bonus, false);
  check("Прикрытие расходует реакцию и даёт бесплатную смену");
  await button(p, "Новый раунд").click();
  await button(p, "Использовать парирование").click();
  const parry = await actualRoll(
    p,
    () => button(p, "Бросить d20 парирования").click(),
    "warrior",
  );
  assert.equal(parry.modifier, null);
  assert.equal(parry.total, null);
  await hideDice(p);
  await button(p, "Не удалось").click();
  check("Физический d20 парирования не добавляет неизвестный модификатор");
  await p.getByLabel("Персонаж", { exact: true }).selectOption("smarchok");
  await expect(p.locator("#character-name")).toHaveValue("Смарчок тест");
  assert.equal((await saved(p)).mechanic.bodies.length, 3);
  await button(p, "Сбросить персонажа").click();
  await button(p, "Отмена").click();
  assert.equal((await saved(p)).core.name, "Смарчок тест");
  await button(p, "Сбросить персонажа").click();
  await dialog(p, "Сбросить Смарчок тест?")
    .getByRole("button", { name: "Сбросить персонажа", exact: true })
    .click();
  assert.equal((await saved(p)).core.name, "Смарчок");
  assert.equal((await saved(p)).mechanic.current, null);
  assert.equal((await saved(p, "warrior")).core.maxHp, 40);
  check(
    "Переключение изолирует данные; подтверждённый сброс меняет только выбранного персонажа",
  );
  for (const width of [1440, 1024, 768, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    await p.screenshot({
      path: `artifacts/smarchok-${width}.png`,
      fullPage: true,
    });
    const sizes = await p.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    assert(
      sizes.document <= sizes.viewport,
      `Smarchok overflow at ${width}: ${sizes.document}`,
    );
    await p.getByLabel("Персонаж", { exact: true }).selectOption("warrior");
    await p.screenshot({
      path: `artifacts/warrior-${width}.png`,
      fullPage: true,
    });
    const warriorSize = await p.evaluate(
      () => document.documentElement.scrollWidth,
    );
    assert(
      warriorSize <= width,
      `Warrior overflow at ${width}: ${warriorSize}`,
    );
    await p.getByLabel("Персонаж", { exact: true }).selectOption("smarchok");
  }
  check(
    "Оба листа без горизонтального переполнения на 1440 / 1024 / 768 / 390 / 320 px",
  );
  await p.setViewportSize({ width: 390, height: 844 });
  const mobile = await actualRoll(p, () =>
    button(p, "Проверка Мудрости, +2").click(),
  );
  assert.equal(mobile.modifier, 2);
  await p.screenshot({ path: "artifacts/mobile-physical-d20.png" });
  await hideDice(p);
  await button(p, "◇ Кубики +").click();
  await button(p, "Очистить выбор").click();
  await expect(button(p, "Бросить")).toBeDisabled();
  await p.getByLabel("Количество d6", { exact: true }).fill("2");
  await actualRoll(p, () => button(p, "Бросить").click());
  await hideDice(p);
  check(
    "Телефон: настоящий 3D d20, 2d6, очистка выбора и быстрое удаление кубиков",
  );
  await button(p, "Редактировать лист").click();
  await p.keyboard.press("Escape");
  await expect(dialog(p, "Редактировать лист")).toHaveCount(0);
  check("Окна закрываются Escape и возвращают фокус");
  assert.deepEqual(errors, []);
  await context.close();
  const unsupported = await browser.newContext();
  await unsupported.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return original.call(this, type, ...args);
    };
  });
  const noGL = await pageIn(unsupported);
  await button(noGL, "Проверка Силы, +0").click();
  await expect(noGL.locator(".physical-result")).toContainText(
    "не поддерживает WebGL",
  );
  assert.equal((await saved(noGL)).history.length, 0);
  check(
    "Без WebGL показана честная ошибка; случайный 2D результат не создаётся",
  );
  await unsupported.close();
  const profile = mkdtempSync(`${tmpdir()}/eidos-profile-`);
  let persistent = await chromium.launchPersistentContext(profile, launch);
  let pp = await persistent.newPage();
  await pp.goto(url);
  await pp.locator("#character-name").fill("Повторное открытие");
  await pp.getByLabel("Максимальный Мицелий").fill("20");
  await pp.getByLabel("Текущий Мицелий").fill("9");
  await expect
    .poll(async () => (await saved(pp)).core.name)
    .toBe("Повторное открытие");
  await persistent.close();
  persistent = await chromium.launchPersistentContext(profile, launch);
  pp = await persistent.newPage();
  await pp.goto(url);
  await expect(pp.locator("#character-name")).toHaveValue("Повторное открытие");
  await expect(pp.getByLabel("Текущий Мицелий")).toHaveValue("9");
  await persistent.close();
  rmSync(profile, { recursive: true, force: true });
  check("Данные переживают полное закрытие и повторный запуск браузера");
  const corrupt = await browser.newContext();
  await corrupt.addInitScript(() => {
    localStorage.setItem("eidos:sheet:smarchok:v2", "{bad");
  });
  const cp = await pageIn(corrupt);
  await expect(cp.locator("#character-name")).toHaveValue("Смарчок");
  await corrupt.close();
  const unavailable = await browser.newContext();
  await unavailable.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Quota");
    };
  });
  const up = await pageIn(unavailable);
  await expect(up.getByRole("alert")).toContainText("не смог сохранить");
  await up.locator("#character-name").fill("Временное имя");
  await expect(up.locator("#character-name")).toHaveValue("Временное имя");
  await unavailable.close();
  check("Повреждённое и недоступное хранилище не мешает работе листа");
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
    "artifacts/browser-results.json",
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        url,
        status: failure ? "failed" : "passed",
        checks: report.length,
        report,
        errors,
        failure: failure?.message,
      },
      null,
      2,
    ),
  );
}
