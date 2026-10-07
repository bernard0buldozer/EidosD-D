import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
const url = process.env.EIDOS_TEST_URL || "http://127.0.0.1:4179";
const key = "eidos:sheet:warrior-level-1:v1";
let server;
let serverLog = "";
let browser;
let checks = 0;
const report = [];
const check = (message) => {
  checks++;
  report.push(message);
  console.log(`✓ ${message}`);
};
mkdirSync("artifacts", { recursive: true });
async function newSheet(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    globalThis.__diceQueue = [];
    crypto.getRandomValues = (buffer) => {
      if (globalThis.__diceQueue.length) {
        buffer[0] = globalThis.__diceQueue.shift();
        return buffer;
      }
      return original(buffer);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url);
  await expect(page.locator("#character-name")).toHaveValue("Воин");
  return { page, context, errors };
}
const state = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)).state, key);
const queue = (page, values) =>
  page.evaluate((v) => {
    globalThis.__diceQueue = v;
  }, values);
const select = (page, name) =>
  page.getByRole("button", { name: `Выбрать стойку: ${name}`, exact: true });
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function finishedRoll(page, total) {
  await expect(page.getByTestId("roll-total")).toHaveText(String(total));
}
async function normalHit(page, damageRaw = 2, kill = false, push = false) {
  await button(page, "Попадание").click();
  await queue(page, [damageRaw]);
  await page.getByRole("button", { name: /^Бросить урон/ }).click();
  await finishedRoll(
    page,
    (damageRaw % (await state(page)).lastRoll.sides) + 3,
  );
  if (kill)
    await page.getByLabel("Эта основная атака убила противника").check();
  if (push)
    await page.getByLabel("Толчок успешен · подтверждено мастером").check();
  await button(page, "Завершить атаку").click();
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
    server.stdout.on("data", (d) => {
      serverLog += d;
    });
    server.stderr.on("data", (d) => {
      serverLog += d;
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(url);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(ready, `Dev server failed to start: ${serverLog}`);
  }
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  {
    const { page, context, errors } = await newSheet();
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.getByRole("button", { name: "О листе", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    check(
      "Страница открывается; клавиатура, фокус и закрытие диалога работают",
    );
    const attributes = [
      ["Силы", 2],
      ["Ловкости", 1],
      ["Телосложения", 2],
      ["Интеллекта", 0],
      ["Мудрости", 1],
      ["Харизмы", -1],
    ];
    for (const [name, modifier] of attributes) {
      await queue(page, [13]);
      await page
        .getByRole("button", { name: new RegExp(`^Проверка ${name},`) })
        .click();
      await finishedRoll(page, 14 + modifier);
      const r = (await state(page)).lastRoll;
      assert.deepEqual(r.values, [14]);
      assert.equal(r.modifier, modifier);
      assert.equal(r.total, 14 + modifier);
    }
    assert.equal((await state(page)).history.length, 6);
    check(
      "Все шесть характеристик бросаются; натуральный d20, модификатор и итог разделены",
    );
    const minus = button(page, "Уменьшить здоровье"),
      plus = button(page, "Увеличить здоровье");
    await minus.click();
    await expect(page.getByTestId("hp")).toHaveText("11");
    await plus.click();
    await expect(page.getByTestId("hp")).toHaveText("12");
    await expect(plus).toBeDisabled();
    for (let n = 0; n < 12; n++) await minus.click();
    await expect(page.getByTestId("hp")).toHaveText("0");
    await expect(minus).toBeDisabled();
    await plus.click();
    await page.reload();
    await expect(page.getByTestId("hp")).toHaveText("1");
    check(
      "HP уменьшается, увеличивается, ограничен 0–12 и сохраняется после reload",
    );
    for (const [name, defense] of [
      ["Дуэлянт", 10],
      ["Штурм", 12],
      ["Стойка щита", 15],
    ]) {
      await select(page, name).click();
      await expect(page.getByTestId("defense")).toHaveText(String(defense));
      assert.equal((await state(page)).mechanic.spent.bonus, false);
    }
    check("Ручной выбор до боя изменяет Защиту и оружие без расхода действий");
    await button(page, "Начать бой").click();
    await expect(select(page, "Дуэлянт")).toBeDisabled();
    await expect(button(page, "Меч недоступен в стойке щита")).toBeDisabled();
    await queue(page, [17, 4]);
    await button(page, "Бросить: Атака щитом").click();
    await finishedRoll(page, 7);
    let s = await state(page);
    assert.deepEqual(s.lastRoll.values, [18, 5]);
    assert.equal(s.lastRoll.selectedIndex, 1);
    await expect(page.locator(".disadvantage-note")).toContainText("меньшее");
    assert.equal(await page.locator(".die-and-caption").count(), 2);
    await expect(page.getByTestId("action-main")).toContainText("Потрачено");
    await page.reload();
    assert.ok((await state(page)).mechanic.attack);
    await expect(button(page, "Попадание")).toBeEnabled();
    check(
      "Щит бросает два d20 с помехой; видны оба, выбран минимум; расход и незавершённая атака переживают reload",
    );
    await normalHit(page, 3, false, true);
    await expect(page.locator(".stance-permission")).toContainText(
      "Бесплатная смена",
    );
    await select(page, "Дуэлянт").click();
    assert.equal((await state(page)).mechanic.spent.bonus, false);
    await select(page, "Штурм").click();
    await expect(page.getByTestId("action-bonus")).toContainText("Потрачено");
    await expect(select(page, "Стойка щита")).toBeDisabled();
    await button(page, "Новый раунд").click();
    s = await state(page);
    assert.equal(s.mechanic.round, 2);
    assert.deepEqual(s.mechanic.spent, {
      main: false,
      bonus: false,
      reaction: false,
    });
    await page.reload();
    await expect(page.getByTestId("defense")).toHaveText("12");
    assert.equal((await state(page)).mechanic.stance, "assault");
    check(
      "Урон d4, толчок, единичная бесплатная смена, бонусная смена, новый раунд и сохранение стойки работают",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { page, context, errors } = await newSheet();
    await button(page, "Использовать прикрытие").click();
    await expect(page.getByTestId("action-reaction")).toContainText(
      "Потрачено",
    );
    await button(page, "Прикрытие успешно").click();
    await select(page, "Дуэлянт").click();
    await expect(button(page, "Использовать парирование")).toBeDisabled();
    assert.equal((await state(page)).mechanic.spent.bonus, false);
    await button(page, "Новый раунд").click();
    await expect(button(page, "Использовать парирование")).toBeEnabled();
    check(
      "Прикрытие даёт бесплатную смену, но не восстанавливает уже потраченную реакцию",
    );
    await button(page, "Использовать парирование").click();
    await expect(button(page, "Парирование успешно")).toBeDisabled();
    await queue(page, [19]);
    await button(page, "Бросить d20 парирования").click();
    await expect(page.getByTestId("roll-total")).toHaveText("—");
    await expect(button(page, "Парирование успешно")).toBeEnabled();
    await button(page, "Парирование успешно").click();
    await expect(select(page, "Стойка щита")).toBeDisabled();
    await queue(page, [11]);
    await button(page, "Ответная атака").click();
    await finishedRoll(page, 14);
    let s = await state(page);
    assert.equal(s.mechanic.spent.main, false);
    assert.equal(s.mechanic.spent.bonus, false);
    assert.equal(s.mechanic.attack.critical, true);
    await button(page, "Попадание").click();
    await expect(page.getByLabel("Критический урон вручную")).toBeVisible();
    await page.getByLabel("Критический урон вручную").fill("9");
    await button(page, "Записать урон").click();
    await finishedRoll(page, 9);
    await button(page, "Завершить атаку").click();
    await select(page, "Стойка щита").click();
    await expect(button(page, "Использовать прикрытие")).toBeDisabled();
    check(
      "Натуральная 20 парирования даёт критический ответ; критический урон вводится вручную; бесплатная смена разрешена после ответа",
    );
    await button(page, "Новый раунд").click();
    await expect(button(page, "Использовать прикрытие")).toBeEnabled();
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: "artifacts/shield-after-parry.png",
      fullPage: true,
    });
    await context.close();
  }
  {
    const { page, context, errors } = await newSheet();
    await select(page, "Штурм").click();
    await expect(page.locator(".ability-title h3")).toHaveText("Добивание");
    await expect(button(page, "Использовать парирование")).toHaveCount(0);
    await expect(button(page, "Использовать прикрытие")).toHaveCount(0);
    await queue(page, [10]);
    await button(page, "Бросить: Атака мечом").click();
    await finishedRoll(page, 13);
    await normalHit(page, 7, true);
    await expect(
      page.getByRole("button", { name: /^Добивание · бонусное действие/ }),
    ).toBeEnabled();
    await queue(page, [12]);
    await page
      .getByRole("button", { name: /^Добивание · бонусное действие/ })
      .click();
    await finishedRoll(page, 15);
    await expect(page.getByTestId("action-bonus")).toContainText("Потрачено");
    await normalHit(page, 4);
    assert.equal((await state(page)).mechanic.finisher, false);
    await expect(
      page.getByRole("button", { name: /^Добивание · бонусное действие/ }),
    ).toHaveCount(0);
    await expect(select(page, "Дуэлянт")).toBeDisabled();
    check(
      "Штурм: только после убийства основной атакой; добивание тратит бонусное действие и не запускает цепочку",
    );
    await page.screenshot({
      path: "artifacts/assault-combat.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { page, context, errors } = await newSheet();
    await select(page, "Дуэлянт").click();
    await button(page, "Использовать парирование").click();
    await page.getByLabel("Натуральный d20 вручную").fill("20");
    await button(page, "Парирование успешно").click();
    assert.equal((await state(page)).mechanic.counter.critical, true);
    await button(page, "Новый раунд").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Новый раунд", exact: true })
      .click();
    await button(page, "Использовать парирование").click();
    await page.getByLabel("Натуральный d20 вручную").fill("20");
    await button(page, "Новый раунд").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Новый раунд", exact: true })
      .click();
    await button(page, "Использовать парирование").click();
    await expect(page.getByLabel("Натуральный d20 вручную")).toHaveValue("");
    await expect(button(page, "Парирование успешно")).toBeDisabled();
    await button(page, "Не удалось").click();
    await expect(button(page, "Использовать парирование")).toBeDisabled();
    assert.equal((await state(page)).mechanic.freeShift, null);
    check(
      "Физический d20, отмена незавершённого ответа и неудачная реакция учитываются корректно",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  for (const width of [1440, 1024, 768, 390]) {
    const { page, context, errors } = await newSheet({
      width,
      height: width === 390 ? 844 : 1000,
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
      `Horizontal overflow at ${width}`,
    );
    const hpTarget = await button(page, "Уменьшить здоровье").boundingBox();
    assert.ok(hpTarget.width >= 44 && hpTarget.height >= 44);
    await page.screenshot({
      path: `artifacts/sheet-${width}.png`,
      fullPage: true,
    });
    await queue(page, [17]);
    await page.getByRole("button", { name: /^Проверка Силы,/ }).click();
    await finishedRoll(page, 20);
    if (width === 390) {
      await expect(page.locator(".mobile-roll-result")).toBeVisible();
      await button(page, "Скрыть быстрый результат").click();
      await page
        .locator(".mobile-nav")
        .getByRole("link", { name: "Бой", exact: true })
        .click();
      await expect(select(page, "Стойка щита")).toBeInViewport();
    }
    await page.screenshot({
      path: `artifacts/roll-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
    check(
      `Экран ${width}px: без горизонтального скролла; броски, размеры HP-кнопок и адаптация проверены`,
    );
  }
  {
    const { page, context, errors } = await newSheet();
    const upload = page.locator("input[type=file]");
    await upload.setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.locator(".portrait-frame img")).toBeVisible();
    await page.getByLabel("Кошелёк", { exact: true }).fill("18 серебряных");
    await page.getByLabel("Имя персонажа").fill("Воин");
    await page.locator(".notes summary").click();
    await page
      .getByLabel("Заметки персонажа", { exact: true })
      .fill("Найти мастера меча");
    await page.reload();
    await expect(page.locator(".portrait-frame img")).toBeVisible();
    await expect(page.getByLabel("Кошелёк", { exact: true })).toHaveValue(
      "18 серебряных",
    );
    await page.locator(".notes summary").click();
    await expect(
      page.getByLabel("Заметки персонажа", { exact: true }),
    ).toHaveValue("Найти мастера меча");
    await button(page, "Удалить портрет").click();
    await expect(page.locator(".portrait-frame img")).toHaveCount(0);
    await queue(page, [5]);
    await page.getByRole("button", { name: /^Проверка Силы,/ }).click();
    await finishedRoll(page, 8);
    await button(page, "Очистить историю бросков").click();
    assert.equal((await state(page)).history.length, 0);
    check(
      "Портрет, кошелёк и заметки сохраняются; удаление портрета и очистка истории работают",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Quota", "QuotaExceededError");
      };
    });
    const page = await context.newPage();
    await page.goto(url);
    await expect(page.getByRole("alert")).toContainText(
      "Браузер не смог сохранить лист",
    );
    await button(page, "Уменьшить здоровье").click();
    await expect(page.getByTestId("hp")).toHaveText("11");
    check(
      "При недоступном localStorage лист остаётся рабочим и честно сообщает об отсутствии сохранения",
    );
    await context.close();
  }
  writeFileSync(
    "artifacts/browser-results.json",
    JSON.stringify({ passed: checks, checks: report }, null, 2),
  );
  console.log(
    `\n${checks} browser scenario groups passed. Screenshots: artifacts/`,
  );
} finally {
  await browser?.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}
