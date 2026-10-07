import { useState, type ReactNode } from "react";
import { warrior } from "./data/warrior";
import { smarchok } from "./data/smarchok";
import type {
  Attribute,
  CharacterDefinition,
  CharacterSession,
  DicePool,
  Roll,
} from "./domain/types";
import { useSheet } from "./state/useSheet";
import { stances } from "./mechanics/warrior/config";
import { ActionEconomy } from "./mechanics/warrior/ActionEconomy";
import { Stances } from "./mechanics/warrior/Stances";
import { AttackPanel } from "./mechanics/warrior/AttackPanel";
import { Abilities } from "./mechanics/warrior/Abilities";
import {
  Bodies,
  Mycelium,
  SmarchokAbilities,
  useSmarchok,
} from "./mechanics/smarchok/Smarchok";
import { Attributes } from "./components/Attributes";
import { Vitals } from "./components/Vitals";
import { Portrait } from "./components/Portrait";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Overlay, NumberField } from "./components/Overlay";
import {
  EditSheet,
  Inventory,
  Journal,
  Skills,
} from "./components/Collections";
import { DiceTray, RollHistory } from "./components/DiceTray";
import { DiceProvider, useDice } from "./dice/DiceProvider";
import { Sigil, Swords } from "./components/Icons";
import { signed } from "./domain/dice";
type CommonGame = {
  state: { core: CharacterSession; history: Roll[]; lastRoll: Roll | null };
  storageOk: boolean;
  rolling: boolean;
  updateCore: (p: Partial<CharacterSession>) => void;
  reset: () => void;
  clearHistory: () => void;
  recordRoll: (r: Roll) => void;
  rollAttribute: (a: Attribute) => void;
  freeRoll: (p: DicePool[], m: number) => void;
};
function AppContent() {
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem("eidos:selected-character") === "warrior"
        ? "warrior"
        : "smarchok";
    } catch {
      return "smarchok";
    }
  });
  const dice = useDice();
  const switchCharacter = (id: string) => {
    setSelected(id);
    dice.clear();
    try {
      localStorage.setItem("eidos:selected-character", id);
    } catch {
      /* Sheet reports storage failures. */
    }
  };
  const selector = (
    <label className="character-selector">
      Персонаж
      <select
        aria-label="Персонаж"
        value={selected}
        disabled={dice.rolling}
        onChange={(e) => switchCharacter(e.target.value)}
      >
        <option value="warrior">Воин</option>
        <option value="smarchok">Смарчок</option>
      </select>
    </label>
  );
  return (
    <>
      <a className="skip-link" href="#character-sheet">
        К листу персонажа
      </a>
      <header className="site-header">
        <a
          className="brand"
          href="#character-sheet"
          aria-label="Эйдос, лист персонажа"
        >
          <Sigil />
          <span>ЭЙДОС</span>
        </a>
        {selector}
        <span className="header-path">Лист персонажа</span>
      </header>
      {selected === "warrior" ? (
        <WarriorScreen key="warrior" />
      ) : (
        <SmarchokScreen key="smarchok" />
      )}
    </>
  );
}
function WarriorScreen() {
  const game = useSheet();
  const m = game.state.mechanic;
  return (
    <SheetFrame
      game={game}
      character={warrior}
      defense={game.state.core.defense ?? stances[m.stance].defense}
      theme={`theme-${m.stance}`}
    >
      <fieldset className="mechanics-lock" disabled={game.rolling}>
        <Stances state={m} send={game.send} />
        <ActionEconomy state={m} send={game.send} />
        <AttackPanel game={game} />
        <Abilities key={`${m.phase}-${m.round}-${m.stance}`} game={game} />
      </fieldset>
    </SheetFrame>
  );
}
function SmarchokScreen() {
  const game = useSmarchok();
  return (
    <SheetFrame
      game={game}
      character={smarchok}
      defense={game.state.core.defense}
      theme="theme-smarchok"
      resource={<Mycelium game={game} />}
      lower={<SmarchokAbilities game={game} />}
      bodies={<Bodies game={game} />}
    >
      <section className="body-attacks panel">
        <h2 className="folio-heading">
          <Swords size={22} /> Атаки · Туша
        </h2>
        <div className="body-attack-table">
          <span>Название</span>
          <span>Бонус</span>
          <span>Урон</span>
          <span>Тип</span>
          <strong>Удар туши · ближняя</strong>
          <span>—</span>
          <span>—</span>
          <span>—</span>
        </div>
        <p className="inline-note">
          Бонус, урон и тип не заданы. Свободные броски доступны в лотке
          кубиков.
        </p>
      </section>
    </SheetFrame>
  );
}
function SheetFrame({
  game,
  character,
  defense,
  theme,
  children,
  resource,
  lower,
  bodies,
}: {
  game: CommonGame;
  character: CharacterDefinition;
  defense: number | null;
  theme: string;
  children: ReactNode;
  resource?: ReactNode;
  lower?: ReactNode;
  bodies?: ReactNode;
}) {
  const { core } = game.state;
  const mushroom = character.id === "smarchok";
  const midpoint = Math.ceil(core.skills.length / 2);
  const displayedSkills = mushroom
    ? core.skills
        .slice(0, midpoint)
        .flatMap((skill, i) =>
          core.skills[midpoint + i]
            ? [skill, core.skills[midpoint + i]]
            : [skill],
        )
    : core.skills;
  const [panel, setPanel] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const dice = useDice();
  const headings: Record<string, string> = {
    edit: "Редактировать лист",
    inventory: mushroom ? "Хранилище туши" : "Рюкзак",
    journal: "Журнал",
    relations: "Связи / цели",
    history: "История бросков",
    skills: "Навыки и владения",
    bodies: "Тела и нежить",
    help: "О листе",
  };
  const rollSkill = async (name: string, bonus: number) => {
    const r = await dice.roll({
      label: name,
      kind: "skill",
      pool: [{ sides: 20, quantity: 1 }],
      modifier: bonus,
    });
    if (r) game.recordRoll(r);
  };
  const folio = (id: string, title: string, detail: string) => (
    <button className="folio-link" onClick={() => setPanel(id)}>
      <span className="folio-link-mark">
        {id === "inventory" ? "♜" : id === "bodies" ? "♧" : "✎"}
      </span>
      <strong>{title}</strong>
      <small>{detail}</small>
      <b>Открыть ›</b>
    </button>
  );
  return (
    <>
      <main id="character-sheet" tabIndex={-1} className={`sheet ${theme}`}>
        <div className="sheet-title">
          <div className="title-identity">
            <h1 className="visually-hidden">{core.name} · Лист персонажа</h1>
            <label className="eyebrow" htmlFor="character-name">
              Имя персонажа
            </label>
            <input
              id="character-name"
              className="character-name"
              value={core.name}
              maxLength={100}
              onChange={(e) => game.updateCore({ name: e.target.value })}
            />
            <div className="character-subtitle">
              <span>{character.className}</span>
              <i>◆</i>
              <span>{character.archetype}</span>
            </div>
            {mushroom && (
              <span className="identity-age">Возраст: более 500 лет</span>
            )}
          </div>
          <div className="title-right">
            <NumberField
              label="Уровень"
              value={core.level}
              min={1}
              onChange={(level) => game.updateCore({ level })}
            />
            <span
              className={`save-status ${!game.storageOk ? "save-error" : ""}`}
              role="status"
            >
              {game.storageOk ? "✓ На устройстве" : "Сохранение недоступно"}
            </span>
            <button
              className="button secondary edit-sheet-button"
              onClick={() => setPanel("edit")}
            >
              Редактировать лист
            </button>
          </div>
        </div>
        {!game.storageOk && (
          <p className="storage-warning" role="alert">
            Браузер не смог сохранить лист. Изменения доступны только до
            закрытия страницы. Проверьте доступ к localStorage или уменьшите
            размер портрета.
          </p>
        )}
        <Vitals
          core={core}
          defense={defense}
          update={game.updateCore}
          smarchok={mushroom}
          resource={resource}
        />
        <div className="sheet-body">
          <Portrait core={core} update={game.updateCore} smarchok={mushroom} />
          <div className="main-column">
            <Attributes
              character={{ ...character, attributes: core.attributes }}
              onRoll={game.rollAttribute}
              rolling={game.rolling}
            />
            <section className="skills-sheet panel">
              <h2 className="folio-heading">
                ✧ Навыки{" "}
                <button
                  className="text-button"
                  onClick={() => setPanel("skills")}
                >
                  Изменить ›
                </button>
              </h2>
              {core.skills.length ? (
                <div className="skills-list">
                  {displayedSkills.map((s) => (
                    <button
                      key={s.id}
                      disabled={game.rolling || !s.name.trim()}
                      onClick={() => rollSkill(s.name, s.bonus)}
                    >
                      <span>{s.name || "Без названия"}</span>
                      <b>{signed(s.bonus)}</b>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  className="blank-lines"
                  onClick={() => setPanel("skills")}
                >
                  Добавить навыки и владения
                </button>
              )}
            </section>
            {children}
          </div>
        </div>
        <div className="sheet-lower">
          {lower || (
            <section className="panel journal-preview">
              <h2 className="folio-heading">Заметки персонажа</h2>
              <p>
                {core.notes
                  ? core.notes.slice(0, 180)
                  : "Записи, события и встречи хранятся в журнале."}
              </p>
              {folio("journal", "Журнал", `${core.journal.length} записей`)}
            </section>
          )}
          <div className="folio-links">
            {folio(
              "inventory",
              mushroom ? "Хранилище туши" : "Рюкзак",
              `${core.items.length} предметов · ${core.items.filter((i) => i.equipped).length} используется`,
            )}
            {mushroom &&
              folio(
                "bodies",
                "Тела и нежить",
                "Сохранённые тела · поднятые · переработанные",
              )}
            {folio(
              "relations",
              "Связи / цели",
              `${core.journal.filter((j) => j.category === "NPC / связи").length} связей`,
            )}
            {mushroom &&
              folio("journal", "Журнал", `${core.journal.length} записей`)}
          </div>
        </div>
        <footer className="sheet-footer">
          <Sigil />
          <span>Эйдос</span>
          <button onClick={() => setPanel("help")}>О листе</button>
          <button disabled={game.rolling} onClick={() => setReset(true)}>
            Сбросить персонажа
          </button>
        </footer>
      </main>
      <DiceTray
        rolling={game.rolling}
        onRoll={game.freeRoll}
        onHistory={() => setPanel("history")}
        lastRoll={game.state.lastRoll}
      />
      <nav className="mobile-nav" aria-label="Быстрый доступ">
        <a href="#attributes">Лист</a>
        <button onClick={() => setPanel("inventory")}>Инвентарь</button>
        <button onClick={() => setPanel("journal")}>Журнал</button>
      </nav>
      {panel && (
        <Overlay title={headings[panel]} onClose={() => setPanel(null)}>
          {panel === "edit" && (
            <EditSheet
              core={core}
              update={game.updateCore}
              smarchok={mushroom}
            />
          )}{" "}
          {panel === "inventory" && (
            <Inventory core={core} update={game.updateCore} />
          )}{" "}
          {(panel === "journal" || panel === "relations") && (
            <Journal
              key={panel}
              core={core}
              update={game.updateCore}
              initialCategory={
                panel === "relations" ? "NPC / связи" : undefined
              }
            />
          )}{" "}
          {panel === "skills" && (
            <Skills core={core} update={game.updateCore} />
          )}{" "}
          {panel === "history" && (
            <RollHistory
              history={game.state.history}
              onClear={game.clearHistory}
            />
          )}{" "}
          {panel === "bodies" && bodies}{" "}
          {panel === "help" && (
            <>
              <p>
                Все данные хранятся в этом браузере отдельно для каждого
                персонажа. Характеристики, здоровье, защита, скорость и уровень
                меняются в «Редактировать лист».
              </p>
              <p>
                Броски выполняет физический 3D-движок Babylon.js / Ammo.
                Результаты считываются после остановки кубиков. WebGL
                обязателен; случайные числа вместо 3D не подставляются.
              </p>
              <p>
                {mushroom
                  ? "Сам Смарчок всегда имеет 1 HP. Здоровье, защита и скорость сверху относятся к Туше. Неуказанные параметры задайте вручную. Точные дебаффы и таблица добычи Мицелия не закреплены."
                  : "В подготовке стойки выбираются свободно. В бою сохраняются расход действий и незавершённые атаки. Попадание и успех реакций подтверждает мастер. Неуказанные бонусы владения и формула критического урона не добавляются."}
              </p>
            </>
          )}
        </Overlay>
      )}
      {reset && (
        <ConfirmDialog
          title={`Сбросить ${core.name || "персонажа"}?`}
          confirmLabel="Сбросить персонажа"
          onClose={() => setReset(false)}
          onConfirm={() => {
            game.reset();
            dice.clear();
            setReset(false);
          }}
        >
          <p>
            Все изменения этого персонажа, портрет, предметы, журнал, механики и
            история бросков будут удалены с этого устройства. Другой персонаж
            сохранится.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
export default function App() {
  return (
    <DiceProvider>
      <AppContent />
    </DiceProvider>
  );
}
