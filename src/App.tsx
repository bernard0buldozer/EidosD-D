import { useState } from "react";
import { warrior } from "./data/warrior";
import { useSheet } from "./state/useSheet";
import { stances } from "./mechanics/warrior/config";
import { ActionEconomy } from "./mechanics/warrior/ActionEconomy";
import { Stances } from "./mechanics/warrior/Stances";
import { AttackPanel } from "./mechanics/warrior/AttackPanel";
import { Abilities } from "./mechanics/warrior/Abilities";
import { Attributes } from "./components/Attributes";
import { Vitals } from "./components/Vitals";
import { Portrait } from "./components/Portrait";
import { RollPanel } from "./components/RollPanel";
import { MobileRollResult } from "./components/MobileRollResult";
import {
  BookOpen,
  CheckCheck,
  CircleHelp,
  Dices,
  Sigil,
  Swords,
  X,
} from "./components/Icons";
import { ConfirmDialog } from "./components/ConfirmDialog";
export default function App() {
  const game = useSheet();
  const [help, setHelp] = useState(false);
  const { core, mechanic } = game.state;
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
        <div className="header-path">
          <span>Лист персонажа</span>
          <span>/</span>
          <strong>Воин</strong>
        </div>
        <button
          className="help-button"
          aria-label="О листе"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={17} />
          <span>О листе</span>
        </button>
      </header>
      <main
        id="character-sheet"
        tabIndex={-1}
        className={`sheet theme-${mechanic.stance}`}
      >
        <div className="sheet-title">
          <div className="title-identity">
            <h1 className="visually-hidden">
              {core.name || warrior.className} · Лист персонажа
            </h1>
            <span className="eyebrow">Лист персонажа</span>
            <label className="visually-hidden" htmlFor="character-name">
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
              <span>{warrior.className}</span>
              <i>◆</i>
              <span>{warrior.archetype}</span>
            </div>
          </div>
          <div className="title-right">
            <span className="level-seal">
              <strong>{warrior.level}</strong>
              <span>уровень</span>
            </span>
            <span
              className={`save-status ${!game.storageOk ? "save-error" : ""}`}
              role="status"
            >
              {game.storageOk ? (
                <>
                  <CheckCheck size={14} />
                  На устройстве
                </>
              ) : (
                <>
                  <X size={14} />
                  Сохранение недоступно
                </>
              )}
            </span>
          </div>
        </div>
        {!game.storageOk && (
          <p className="storage-warning" role="alert">
            Браузер не смог сохранить лист. Проверьте доступ к localStorage или
            уменьшите размер портрета. Изменения сейчас доступны только до
            закрытия страницы.
          </p>
        )}
        <Vitals
          character={warrior}
          core={core}
          defense={stances[mechanic.stance].defense}
          update={game.updateCore}
        />
        <div className="sheet-body">
          <Portrait core={core} update={game.updateCore} />
          <div className="main-column">
            <Attributes
              character={warrior}
              onRoll={game.rollAttribute}
              rolling={game.rolling}
            />
            <Stances state={mechanic} send={game.send} />
            <ActionEconomy state={mechanic} send={game.send} />
            <AttackPanel game={game} />
            <Abilities
              key={`${mechanic.phase}-${mechanic.round}-${mechanic.stance}`}
              game={game}
            />
          </div>
          <RollPanel
            roll={game.state.lastRoll}
            history={game.state.history}
            rolling={game.rolling}
            clearHistory={game.clearHistory}
          />
        </div>
        <footer className="sheet-footer">
          <Sigil />
          <span>Эйдос</span>
          <span>Воин · Мастер стоек · Уровень 1</span>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Быстрый доступ">
        <a href="#attributes">
          <BookOpen size={19} />
          Лист
        </a>
        <a href="#stances">
          <Swords size={19} />
          Бой
        </a>
        <a href="#dice">
          <Dices size={19} />
          Броски{game.state.lastRoll && <span className="nav-roll-dot" />}
        </a>
      </nav>
      <MobileRollResult roll={game.state.lastRoll} rolling={game.rolling} />
      {help && (
        <ConfirmDialog
          title="Лист Воина · Эйдос"
          confirmLabel="Понятно"
          onClose={() => setHelp(false)}
          onConfirm={() => {}}
        >
          <p>
            В подготовке можно свободно выбрать стойку. Атака или реакция
            автоматически начинает бой. В бою смена стоек учитывает бонусное
            действие и бесплатные триггеры.
          </p>
          <p>
            Попадание, толчок и успех реакции подтверждаются по решению мастера.
            Здоровье, стойка, расход действий и броски сохраняются в этом
            браузере. «Новый раунд» восстанавливает действия.
          </p>
          <p>
            Бонус владения, формулы парирования и критического урона не заданы.
            Лист не добавляет правила других систем.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
