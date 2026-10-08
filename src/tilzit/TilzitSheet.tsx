import { useEffect, useRef, useState } from "react";
import type {
  CharacterSession,
  DieSides,
  EditableAttack,
  EditableAbility,
  Roll,
  TilzitDetails,
} from "../domain/types";
import { useSheet, type SheetController } from "../state/useSheet";
import { signed, rollSummary } from "../domain/dice";
import { useDice } from "../dice/DiceProvider";
import { stances } from "../mechanics/warrior/config";
import { Stances } from "../mechanics/warrior/Stances";
import { ActionEconomy } from "../mechanics/warrior/ActionEconomy";
import { AttackPanel } from "../mechanics/warrior/AttackPanel";
import { Abilities } from "../mechanics/warrior/Abilities";
import { Inventory, Journal } from "../components/Collections";
import { RollHistory } from "../components/DiceTray";
import { NumberField, Overlay } from "../components/Overlay";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  Shield,
  Heart,
  Footprints,
  Coins,
  BookOpen,
  Dices,
} from "../components/Icons";
import { MovableSheet } from "./MovableSheet";
import {
  CharacterPresentation,
  type CharacterPresentationEvent,
} from "./CharacterPresentation";
import { changeHealth, initialTilzitDetails } from "./model";
import { dieTypes, parseDamage } from "./rolls";

export function TilzitSheet() {
  const game = useSheet();
  const { core, mechanic, lastRoll } = game.state;
  const details = core.tilzit ?? initialTilzitDetails();
  const [journalOpen, setJournalOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [event, setEvent] = useState<CharacterPresentationEvent | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const previous = useRef({
    hp: core.hp,
    stance: mechanic.stance,
    roll: lastRoll?.id,
    reaction: mechanic.spent.reaction,
  });
  useEffect(() => {
    const old = previous.current;
    if (old.hp !== core.hp && old.hp !== null && core.hp !== null) {
      const amount = core.hp - old.hp;
      setDelta(amount);
      setEvent({
        type: amount >= 0 ? "heal" : "damage",
        amount: Math.abs(amount),
      });
    }
    if (old.stance !== mechanic.stance)
      setEvent({ type: "stance", stance: mechanic.stance });
    if (old.roll !== lastRoll?.id && lastRoll?.kind === "attack")
      setEvent({ type: "attack", rollId: lastRoll.id });
    if (
      (!old.reaction && mechanic.spent.reaction) ||
      (old.roll !== lastRoll?.id && lastRoll?.kind === "parry")
    )
      setEvent({ type: "defense", rollId: lastRoll?.id });
    previous.current = {
      hp: core.hp,
      stance: mechanic.stance,
      roll: lastRoll?.id,
      reaction: mechanic.spent.reaction,
    };
  }, [core.hp, mechanic.stance, mechanic.spent.reaction, lastRoll]);
  const patchDetails = (patch: Partial<TilzitDetails>) =>
    game.updateCore({ tilzit: { ...details, ...patch } });
  const bio = details.biography;
  const patchBio = (patch: Partial<typeof bio>) =>
    patchDetails({ biography: { ...bio, ...patch } });
  return (
    <main
      id="character-sheet"
      tabIndex={-1}
      className="tilzit-sheet"
      data-version="tilzit-1"
    >
      <h1 className="visually-hidden">{core.name} · Игровой лист</h1>
      <div className="tilzit-sheet-topline">
        <span>ЭЙДОС · ЛИСТ ПЕРСОНАЖА</span>
        <span
          className={`save-status ${!game.storageOk ? "save-error" : ""}`}
          role="status"
        >
          {game.storageOk
            ? "✓ Сохранено на устройстве"
            : "Сохранение недоступно"}
        </span>
      </div>
      <header className="tilzit-identity">
        <div className="tilzit-name-area">
          <label>
            Имя персонажа
            <input
              id="character-name"
              aria-label="Имя персонажа"
              className="tilzit-name"
              value={core.name}
              maxLength={100}
              onChange={(e) => game.updateCore({ name: e.target.value })}
            />
          </label>
          <label>
            Прозвище
            <input
              aria-label="Прозвище"
              className="tilzit-nickname"
              value={bio.nickname}
              onChange={(e) => patchBio({ nickname: e.target.value })}
            />
          </label>
        </div>
        <div className="tilzit-identity-fields">
          <label>
            Раса
            <input
              value={bio.race}
              onChange={(e) => patchBio({ race: e.target.value })}
            />
          </label>
          <label>
            Класс
            <input
              value={bio.className}
              onChange={(e) => patchBio({ className: e.target.value })}
            />
          </label>
          <NumberField
            label="Уровень"
            value={core.level}
            min={1}
            onChange={(level) => game.updateCore({ level })}
          />
        </div>
        <div className="tilzit-seal" aria-hidden="true">
          <Shield size={44} strokeWidth={1} />
          <span>ДРАГУНАТОРИ</span>
        </div>
      </header>
      <div className="tilzit-summary">
        <div>
          <Shield />
          <span>Защита</span>
          <strong data-testid="tilzit-defense">
            {stances[mechanic.stance].defense}
          </strong>
          <small>{stances[mechanic.stance].name}</small>
        </div>
        <div>
          <Heart />
          <span>Здоровье</span>
          <strong data-testid="tilzit-hp">
            {core.hp ?? "—"}
            <i> / {core.maxHp ?? "—"}</i>
          </strong>
          <small>HP · текущее / максимум</small>
        </div>
        <div>
          <BookOpen />
          <span>Действия</span>
          <strong>
            {3 - Object.values(mechanic.spent).filter(Boolean).length}
            <i> / 3</i>
          </strong>
          <small>Основное · бонус · реакция</small>
        </div>
        <div>
          <Footprints />
          <span>Скорость</span>
          <strong>{core.speed ?? "—"}</strong>
          <small>клеток</small>
        </div>
        <label className="tilzit-wallet">
          <Coins />
          <span>Кошелёк</span>
          <input
            aria-label="Кошелёк"
            placeholder="Не заполнен"
            value={core.wallet}
            onChange={(e) => game.updateCore({ wallet: e.target.value })}
          />
          <small>Монеты и ценности</small>
        </label>
      </div>
      {!game.storageOk && (
        <p role="alert" className="error-text">
          Сохранение недоступно. Изменения работают в этой вкладке, но могут
          потеряться после её закрытия.
        </p>
      )}
      {game.recoveryWarning && (
        <p role="alert" className="error-text">
          {game.recoveryWarning}
        </p>
      )}
      <MovableSheet
        portrait={
          <CharacterPresentation
            name={core.name}
            portrait={core.portrait}
            stance={mechanic.stance}
            event={event}
            onPortraitChange={(portrait) => game.updateCore({ portrait })}
            nickname={bio.nickname}
            race={bio.race}
            clan={bio.clan}
          />
        }
        blocks={{
          attributes: <AttributeBlock game={game} />,
          health: <HealthBlock game={game} delta={delta} />,
          stances: (
            <>
              <Stances state={mechanic} send={game.send} />
              <ActionEconomy state={mechanic} send={game.send} />
            </>
          ),
          skills: <SkillBlock game={game} />,
          attacks: (
            <>
              <AttackPanel game={game} />
              <AttackEditor
                game={game}
                details={details}
                update={patchDetails}
              />
            </>
          ),
          abilities: (
            <>
              <details className="tilzit-confirmed-abilities" open>
                <summary>Мастер стоек · подтверждённые правила</summary>
                <Abilities
                  key={`${mechanic.phase}-${mechanic.round}-${mechanic.stance}`}
                  game={game}
                />
              </details>
              <AbilityEditor details={details} update={patchDetails} />
            </>
          ),
          equipment: (
            <>
              <div className="tilzit-equipment-preview">
                {core.items.map((item) => (
                  <details key={item.id}>
                    <summary>
                      {item.name || "Без названия"} ×{item.quantity}
                      {item.equipped ? " · экипирован" : ""}
                    </summary>
                    <p>{item.description || "Описание не заполнено"}</p>
                    {item.notes && <p>{item.notes}</p>}
                  </details>
                ))}
              </div>
              <Inventory core={core} update={game.updateCore} />
            </>
          ),
          rolls: <RollBlock game={game} />,
          history: (
            <details className="tilzit-biography" open>
              <summary>
                {core.name || "Персонаж"} · {bio.nickname || "Без прозвища"}
              </summary>
              <div className="tilzit-biography-facts">
                <NumberField
                  label="Возраст, лет"
                  value={bio.age}
                  onChange={(age) => patchBio({ age })}
                />
                <NumberField
                  label="Рост, см"
                  value={bio.height}
                  onChange={(height) => patchBio({ height })}
                />
                <NumberField
                  label="Вес, кг"
                  value={bio.weight}
                  onChange={(weight) => patchBio({ weight })}
                />
                <label>
                  Клан
                  <input
                    value={bio.clan}
                    onChange={(e) => patchBio({ clan: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Предыстория
                <textarea
                  placeholder="Подтверждённая предыстория пока отсутствует"
                  value={bio.backstory}
                  onChange={(e) => patchBio({ backstory: e.target.value })}
                />
              </label>
              <label>
                Личные цели
                <textarea
                  placeholder="Запишите цели персонажа"
                  value={bio.goals}
                  onChange={(e) => patchBio({ goals: e.target.value })}
                />
              </label>
            </details>
          ),
          notes: (
            <>
              <label>
                Заметки персонажа
                <textarea
                  className="tilzit-notes"
                  placeholder="Заметки о путешествии, важные имена, планы…"
                  value={core.notes}
                  onChange={(e) => game.updateCore({ notes: e.target.value })}
                />
              </label>
              <button
                className="button secondary"
                onClick={() => setJournalOpen(true)}
              >
                Открыть журнал и связи
              </button>
            </>
          ),
        }}
      />
      <footer className="tilzit-sheet-footer">
        <Shield size={16} />
        <span>
          {bio.nickname} · Дом {bio.clan}
        </span>
        <button className="text-button" onClick={() => setConfirmReset(true)}>
          Сбросить персонажа
        </button>
        <span>Лист Тильзита · версия 1</span>
      </footer>
      {journalOpen && (
        <Overlay
          title="Журнал и связи Тильзита"
          onClose={() => setJournalOpen(false)}
        >
          <Journal core={core} update={game.updateCore} />
        </Overlay>
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Сбросить данные Тильзита?"
          confirmLabel="Сбросить персонажа"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            game.reset();
            setDelta(null);
            setEvent(null);
            setConfirmReset(false);
          }}
        >
          <p>
            Игровые данные, портрет, предметы, журнал и история бросков этого
            персонажа будут удалены. Смарчок и раскладка блоков сохранятся. Для
            изменения только расположения используйте «Сбросить раскладку».
          </p>
        </ConfirmDialog>
      )}
    </main>
  );
}

function AttributeBlock({ game }: { game: SheetController }) {
  const attributes = game.state.core.attributes;
  return (
    <>
      <div className="tilzit-attributes">
        {attributes.map((a) => (
          <div className="tilzit-attribute" key={a.id}>
            <button
              aria-label={`${a.checkLabel}, ${signed(a.modifier)}`}
              onClick={() => game.rollAttribute(a)}
            >
              <span>{a.name}</span>
              <strong>{signed(a.modifier)}</strong>
              <small>
                d20 <Dices size={12} />
              </small>
            </button>
            <NumberField
              label={`${a.name}: значение`}
              value={a.score}
              onChange={(score) =>
                game.updateCore({
                  attributes: attributes.map((b) =>
                    b.id === a.id
                      ? { ...b, score: Math.min(100000, score ?? 0) }
                      : b,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
      <p className="tilzit-hint">
        Модификатор = floor((значение − 10) / 2). Нажмите на название для
        проверки.
      </p>
    </>
  );
}
function HealthBlock({
  game,
  delta,
}: {
  game: SheetController;
  delta: number | null;
}) {
  const { hp, maxHp, speed } = game.state.core;
  const [amount, setAmount] = useState("");
  const valid =
    /^\d+$/.test(amount) && Number(amount) > 0 && Number(amount) <= 100000;
  const change = (action: "damage" | "heal") => {
    const next = changeHealth(hp, maxHp, Number(amount), action);
    if (valid && next) game.updateCore({ hp: next.hp });
  };
  return (
    <>
      <div className="tilzit-health-fields">
        <NumberField
          label="Текущее HP"
          value={hp}
          onChange={(value) => game.updateCore({ hp: value })}
        />
        <NumberField
          label="Максимальное HP"
          value={maxHp}
          onChange={(value) => game.updateCore({ maxHp: value })}
        />
        <NumberField
          label="Скорость, клеток"
          value={speed}
          onChange={(value) => game.updateCore({ speed: value })}
        />
      </div>
      <div
        className="tilzit-hp-meter"
        role="progressbar"
        aria-label="Запас здоровья"
        aria-valuemin={0}
        aria-valuemax={maxHp ?? undefined}
        aria-valuenow={maxHp === null ? undefined : (hp ?? 0)}
      >
        <span
          style={{
            width: `${maxHp && hp !== null ? Math.min(100, (hp / maxHp) * 100) : 0}%`,
          }}
        />
      </div>
      <div className="tilzit-health-action">
        <label>
          Величина изменения HP
          <input
            aria-label="Величина изменения HP"
            inputMode="numeric"
            value={amount}
            placeholder="Например, 3"
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button
            className="button secondary"
            disabled={!valid || hp === null}
            onClick={() => change("damage")}
          >
            Получить урон
          </button>
          <button
            className="button primary"
            disabled={!valid || hp === null || maxHp === null}
            onClick={() => change("heal")}
          >
            Восстановить здоровье
          </button>
        </div>
      </div>
      {amount && !valid && (
        <p className="error-text" role="alert">
          Введите целое положительное число от 1 до 100000.
        </p>
      )}
      <p className="tilzit-health-change" role="status">
        {delta === null
          ? "Последнее изменение HP появится здесь"
          : delta === 0
            ? "HP без изменения"
            : `${signed(delta)} HP`}
      </p>
      <p className="tilzit-hint">
        Защита определяется стойкой. Лечение ограничено максимумом; урон —
        нулём. Временные HP правилами проекта не заданы.
      </p>
    </>
  );
}
function SkillBlock({ game }: { game: SheetController }) {
  const { core } = game.state;
  const dice = useDice();
  const update = (
    id: string,
    patch: Partial<CharacterSession["skills"][number]>,
  ) =>
    game.updateCore({
      skills: core.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  const roll = async (name: string, bonus: number | null) => {
    if (bonus === null) return;
    const result = await dice.roll({
      label: name,
      kind: "skill",
      pool: [{ sides: 20, quantity: 1 }],
      modifier: bonus,
    });
    if (result) game.recordRoll(result);
  };
  return (
    <>
      <p className="tilzit-hint">
        Полные бонусы вводятся по подтверждённым правилам. Пустое поле означает
        «не задан».
      </p>
      <div className="tilzit-skills">
        {core.skills.map((s) => (
          <div className="tilzit-skill" key={s.id}>
            <input
              aria-label={`Название навыка: ${s.id}`}
              value={s.name}
              onChange={(e) => update(s.id, { name: e.target.value })}
            />
            <NumberField
              label={`Бонус: ${s.name || "навык"}`}
              value={s.bonus}
              min={-1000}
              onChange={(bonus) => update(s.id, { bonus })}
            />
            <button
              className="tile-roll-button"
              aria-label={`Проверка навыка: ${s.name || "без названия"}`}
              disabled={s.bonus === null || !s.name.trim()}
              onClick={() => roll(s.name, s.bonus)}
            >
              <Dices size={17} />
            </button>
            <button
              className="text-button"
              aria-label={`Удалить навык: ${s.name || "без названия"}`}
              onClick={() =>
                game.updateCore({
                  skills: core.skills.filter((b) => b.id !== s.id),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="button secondary"
        onClick={() =>
          game.updateCore({
            skills: [
              ...core.skills,
              { id: crypto.randomUUID(), name: "", bonus: null },
            ],
          })
        }
      >
        Добавить навык
      </button>
      <label>
        Владения
        <textarea
          placeholder="Укажите подтверждённые владения"
          value={core.proficiencies}
          onChange={(e) => game.updateCore({ proficiencies: e.target.value })}
        />
      </label>
    </>
  );
}
function Result({ roll }: { roll: Roll | null }) {
  if (!roll)
    return (
      <p className="tilzit-hint">
        Нажмите на характеристику, навык или выполните свободный бросок.
      </p>
    );
  return (
    <div className="tilzit-roll-result" role="status">
      <span className="eyebrow">{roll.label}</span>
      <strong>{roll.total ?? roll.values[roll.selectedIndex]}</strong>
      <p>{rollSummary(roll)}</p>
      <small>
        {roll.advantage
          ? "Преимущество · выбрано большее"
          : roll.disadvantage
            ? "Помеха · выбрано меньшее"
            : "Обычный бросок"}
        . Сложность и результат проверки определяет мастер.
      </small>
    </div>
  );
}
function RollBlock({ game }: { game: SheetController }) {
  const dice = useDice();
  const [sides, setSides] = useState<DieSides>(20);
  const [quantity, setQuantity] = useState<number | null>(1);
  const [modifier, setModifier] = useState<number | null>(0);
  const valid =
    quantity !== null &&
    quantity >= 1 &&
    quantity <= 30 &&
    modifier !== null &&
    Math.abs(modifier) <= 100000;
  return (
    <>
      <label className="tilzit-roll-mode">
        Режим проверок d20
        <select
          aria-label="Режим проверок d20"
          value={dice.mode}
          onChange={(e) =>
            dice.setMode?.(
              e.target.value as "normal" | "advantage" | "disadvantage",
            )
          }
        >
          <option value="normal">Обычный</option>
          <option value="advantage">Преимущество</option>
          <option value="disadvantage">Помеха</option>
        </select>
      </label>
      <p className="tilzit-hint">
        Применяется к проверкам и одному d20. У атаки щитом всегда
        подтверждённая помеха.
      </p>
      <div className="tilzit-die-picker">
        {dieTypes.map((d) => (
          <button
            key={d}
            className={sides === d ? "selected" : ""}
            aria-pressed={sides === d}
            onClick={() => setSides(d)}
          >
            d{d}
          </button>
        ))}
      </div>
      <div className="tilzit-dice-fields">
        <NumberField
          label="Количество кубиков"
          value={quantity}
          min={1}
          onChange={setQuantity}
        />
        <NumberField
          label="Модификатор броска"
          value={modifier}
          min={-100000}
          onChange={setModifier}
        />
      </div>
      {!valid && (
        <p role="alert" className="error-text">
          Укажите 1–30 кубиков и целый модификатор от −100000 до 100000.
        </p>
      )}
      <button
        className="button primary"
        disabled={!valid}
        onClick={() =>
          game.freeRoll([{ sides, quantity: quantity! }], modifier!)
        }
      >
        Бросить {quantity ?? "—"}d{sides}
      </button>
      {dice.error && (
        <p className="error-text" role="alert">
          {dice.error}
        </p>
      )}
      <Result roll={game.state.lastRoll} />
      <details className="tilzit-roll-history" open>
        <summary>Последние броски · {game.state.history.length}</summary>
        <RollHistory history={game.state.history} onClear={game.clearHistory} />
      </details>
    </>
  );
}
type DetailsEditorProps = {
  details: TilzitDetails;
  update: (patch: Partial<TilzitDetails>) => void;
};
function AttackEditor({
  game,
  details,
  update,
}: DetailsEditorProps & { game: SheetController }) {
  const dice = useDice();
  const patchAttack = (id: string, patch: Partial<EditableAttack>) =>
    update({
      attacks: details.attacks.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    });
  const roll = async (attack: EditableAttack, kind: "attack" | "damage") => {
    const damage = parseDamage(attack.damage);
    if (
      (kind === "attack" && attack.bonus === null) ||
      (kind === "damage" && !damage)
    )
      return;
    const result = await dice.roll({
      label: `${attack.name || "Атака"} · ${kind === "attack" ? "попадание" : "урон"}`,
      kind,
      pool: kind === "attack" ? [{ sides: 20, quantity: 1 }] : damage!.pool,
      modifier: kind === "attack" ? attack.bonus : damage!.modifier,
    });
    if (result) game.recordRoll(result);
  };
  return (
    <>
      <details className="tilzit-weapon-settings">
        <summary>Изменить оружие и типы урона</summary>
        <p className="tilzit-hint">
          Щит: 1d4 + СИЛ; меч: 1d8 + СИЛ — правила проекта. Пустой бонус или
          формула сохраняют эти значения. Типы урона не заданы.
        </p>
        {(["shield", "sword"] as const).map((key) => {
          const weapon = details.weapons[key];
          const patch = (p: Partial<typeof weapon>) =>
            update({
              weapons: { ...details.weapons, [key]: { ...weapon, ...p } },
            });
          const name = key === "shield" ? "Щит" : "Меч";
          return (
            <fieldset key={key} className="tilzit-editor-fields">
              <legend>{name}</legend>
              <NumberField
                label={`${name}: полный бонус вручную`}
                value={weapon.bonus}
                min={-1000}
                onChange={(bonus) => patch({ bonus })}
              />
              <label>
                {name}: формула урона
                <input
                  placeholder={`1d${key === "shield" ? 4 : 8} ${signed(game.strength)}`}
                  value={weapon.damage}
                  onChange={(e) => patch({ damage: e.target.value })}
                />
              </label>
              {weapon.damage && !parseDamage(weapon.damage) && (
                <p role="alert" className="error-text">
                  Формат: 1d8 + 2. Доступны d4–d100, до 30 кубиков.
                </p>
              )}
              <label>
                {name}: тип урона
                <input
                  placeholder="Не задан"
                  value={weapon.damageType}
                  onChange={(e) => patch({ damageType: e.target.value })}
                />
              </label>
            </fieldset>
          );
        })}
      </details>
      <details className="tilzit-custom-attacks" open>
        <summary>Дополнительные атаки · вручную</summary>
        <p className="tilzit-hint">
          Свободные броски для записанного оружия. Расход действий учитывайте с
          мастером; правила класса к ним автоматически не применяются.
        </p>
        {details.attacks.map((a) => (
          <fieldset className="tilzit-editor-fields" key={a.id}>
            <legend>{a.name || "Новая атака"}</legend>
            <label>
              Название атаки
              <input
                value={a.name}
                onChange={(e) => patchAttack(a.id, { name: e.target.value })}
              />
            </label>
            <NumberField
              label={`Бонус попадания: ${a.name || "новая атака"}`}
              value={a.bonus}
              min={-1000}
              onChange={(bonus) => patchAttack(a.id, { bonus })}
            />
            <label>
              Формула урона
              <input
                placeholder="Например, 1d6 + 2"
                value={a.damage}
                onChange={(e) => patchAttack(a.id, { damage: e.target.value })}
              />
            </label>
            <label>
              Тип урона
              <input
                placeholder="Не задан"
                value={a.damageType}
                onChange={(e) =>
                  patchAttack(a.id, { damageType: e.target.value })
                }
              />
            </label>
            {a.damage && !parseDamage(a.damage) && (
              <p role="alert" className="error-text">
                Укажите формулу вида 1d6 + 2.
              </p>
            )}
            <div className="button-row">
              <button
                className="button secondary"
                disabled={a.bonus === null || !a.name.trim()}
                onClick={() => roll(a, "attack")}
              >
                Бросок атаки
              </button>
              <button
                className="button secondary"
                disabled={!parseDamage(a.damage) || !a.name.trim()}
                onClick={() => roll(a, "damage")}
              >
                Бросок урона
              </button>
              <button
                className="text-button"
                onClick={() =>
                  update({
                    attacks: details.attacks.filter((b) => b.id !== a.id),
                  })
                }
              >
                Удалить атаку
              </button>
            </div>
          </fieldset>
        ))}
        <button
          className="button secondary"
          onClick={() =>
            update({
              attacks: [
                ...details.attacks,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  bonus: null,
                  damage: "",
                  damageType: "",
                },
              ],
            })
          }
        >
          Добавить атаку
        </button>
      </details>
    </>
  );
}
function AbilityEditor({ details, update }: DetailsEditorProps) {
  const patch = (id: string, p: Partial<EditableAbility>) =>
    update({
      abilities: details.abilities.map((a) => {
        if (a.id !== id) return a;
        const next = { ...a, ...p };
        return {
          ...next,
          current:
            next.current === null
              ? null
              : Math.min(next.maximum ?? Infinity, next.current),
        };
      }),
    });
  return (
    <div className="tilzit-custom-abilities">
      {details.abilities.map((a) => (
        <details key={a.id} open>
          <summary>{a.name || "Новая способность"}</summary>
          <label>
            Название способности
            <input
              value={a.name}
              onChange={(e) => patch(a.id, { name: e.target.value })}
            />
          </label>
          <label>
            Описание способности
            <textarea
              value={a.description}
              onChange={(e) => patch(a.id, { description: e.target.value })}
            />
          </label>
          <label>
            Условия использования
            <textarea
              value={a.conditions}
              onChange={(e) => patch(a.id, { conditions: e.target.value })}
            />
          </label>
          <p className="tilzit-hint">
            Счётчик заполните только при наличии правил ресурса. Использование
            способности не списывает ресурс автоматически.
          </p>
          <div className="tilzit-dice-fields">
            <NumberField
              label={`Ресурс: ${a.name || "способность"}`}
              value={a.current}
              onChange={(current) => patch(a.id, { current })}
            />
            <NumberField
              label={`Максимум ресурса: ${a.name || "способность"}`}
              value={a.maximum}
              onChange={(maximum) => patch(a.id, { maximum })}
            />
          </div>
          <button
            className="text-button"
            onClick={() =>
              update({
                abilities: details.abilities.filter((b) => b.id !== a.id),
              })
            }
          >
            Удалить способность
          </button>
        </details>
      ))}
      <button
        className="button secondary"
        onClick={() =>
          update({
            abilities: [
              ...details.abilities,
              {
                id: crypto.randomUUID(),
                name: "",
                description: "",
                conditions: "",
                current: null,
                maximum: null,
              },
            ],
          })
        }
      >
        Добавить способность
      </button>
    </div>
  );
}
