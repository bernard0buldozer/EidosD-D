import { useState } from "react";
import type {
  CharacterSession,
  InventoryItem,
  JournalEntry,
  Skill,
} from "../domain/types";
import { NumberField } from "./Overlay";
type Props = {
  core: CharacterSession;
  update: (p: Partial<CharacterSession>) => void;
};
export function Inventory({ core, update }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const item = core.items.find((i) => i.id === selected);
  const patch = (p: Partial<InventoryItem>) =>
    update({
      items: core.items.map((i) => (i.id === selected ? { ...i, ...p } : i)),
    });
  return (
    <>
      <div className="collection-toolbar">
        <input
          aria-label="Поиск предметов"
          placeholder="Пошарить в хранилище…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="button primary"
          onClick={() => {
            const id = crypto.randomUUID();
            update({
              items: [
                ...core.items,
                {
                  id,
                  name: "",
                  quantity: 1,
                  description: "",
                  notes: "",
                  category: "",
                  equipped: false,
                },
              ],
            });
            setSelected(id);
          }}
        >
          Добавить предмет
        </button>
      </div>
      <div className="collection-layout">
        <div className="collection-list">
          {core.items
            .filter((i) =>
              `${i.name} ${i.category} ${i.description}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((i) => (
              <button
                key={i.id}
                className={selected === i.id ? "selected" : ""}
                onClick={() => setSelected(i.id)}
              >
                <strong>{i.name || "Без названия"}</strong>
                <span>
                  ×{i.quantity} {i.equipped ? "· используется" : ""}
                </span>
                <small>{i.category}</small>
              </button>
            ))}
          {!core.items.length && (
            <p>Хранилище пусто. Добавьте свои предметы.</p>
          )}
        </div>
        {item ? (
          <div className="entry-editor">
            <label>
              Название предмета
              <input
                aria-label="Название предмета"
                value={item.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <NumberField
              label="Количество"
              value={item.quantity}
              onChange={(v) => patch({ quantity: v ?? 0 })}
            />
            <label>
              Категория
              <input
                value={item.category}
                onChange={(e) => patch({ category: e.target.value })}
              />
            </label>
            <label>
              Описание предмета
              <textarea
                value={item.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <label>
              Заметки о предмете
              <textarea
                value={item.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={item.equipped}
                onChange={(e) => patch({ equipped: e.target.checked })}
              />
              Используется / экипирован
            </label>
            <button
              className="button secondary"
              onClick={() => {
                update({ items: core.items.filter((i) => i.id !== selected) });
                setSelected(null);
              }}
            >
              Удалить предмет
            </button>
          </div>
        ) : (
          <p className="empty-instruction">
            Выберите предмет, чтобы осмотреть или изменить его.
          </p>
        )}
      </div>
    </>
  );
}
const categories = [
  "Заметки",
  "События",
  "Встречи",
  "NPC / связи",
  "Места",
  "Произвольные записи",
];
export function Journal({
  core,
  update,
  initialCategory = "Заметки",
}: Props & { initialCategory?: string }) {
  const [category, setCategory] = useState(initialCategory);
  const [selected, setSelected] = useState<string | null>(null);
  const entry = core.journal.find((j) => j.id === selected);
  const patch = (p: Partial<JournalEntry>) =>
    update({
      journal: core.journal.map((j) =>
        j.id === selected ? { ...j, ...p } : j,
      ),
    });
  return (
    <>
      <div className="folio-tabs" role="group" aria-label="Разделы журнала">
        {categories.map((c) => (
          <button
            key={c}
            aria-pressed={c === category}
            onClick={() => {
              setCategory(c);
              setSelected(null);
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {category === "Заметки" && (
        <label className="entry-editor">
          Заметки персонажа
          <textarea
            aria-label="Заметки персонажа"
            value={core.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Ваши записи…"
          />
        </label>
      )}
      <button
        className="button primary"
        onClick={() => {
          const id = crypto.randomUUID();
          update({
            journal: [
              ...core.journal,
              {
                id,
                category,
                name: "",
                description: "",
                notes: "",
                status: "",
                met: "",
                timestamp: Date.now(),
              },
            ],
          });
          setSelected(id);
        }}
      >
        Добавить запись
      </button>
      <div className="collection-layout">
        <div className="collection-list">
          {core.journal
            .filter((j) => j.category === category)
            .map((j) => (
              <button
                key={j.id}
                className={selected === j.id ? "selected" : ""}
                onClick={() => setSelected(j.id)}
              >
                <strong>{j.name || "Без названия"}</strong>
                <small>{j.description}</small>
                <span>{j.status}</span>
              </button>
            ))}
          {!core.journal.some((j) => j.category === category) && (
            <p>Записей пока нет.</p>
          )}
        </div>
        {entry && (
          <div className="entry-editor">
            <label>
              {category === "NPC / связи" ? "Имя NPC" : "Название записи"}
              <input
                value={entry.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <label>
              Короткое описание
              <textarea
                value={entry.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            {category === "NPC / связи" && (
              <>
                <label>
                  Отношение / статус
                  <input
                    value={entry.status}
                    onChange={(e) => patch({ status: e.target.value })}
                  />
                </label>
                <label>
                  Где и как познакомились
                  <textarea
                    value={entry.met}
                    onChange={(e) => patch({ met: e.target.value })}
                  />
                </label>
              </>
            )}
            <label>
              Заметка
              <textarea
                value={entry.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </label>
            <button
              className="button secondary"
              onClick={() => {
                update({
                  journal: core.journal.filter((j) => j.id !== selected),
                });
                setSelected(null);
              }}
            >
              Удалить запись
            </button>
          </div>
        )}
      </div>
    </>
  );
}
export function Skills({ core, update }: Props) {
  const patch = (id: string, p: Partial<Skill>) =>
    update({
      skills: core.skills.map((s) => (s.id === id ? { ...s, ...p } : s)),
    });
  return (
    <>
      <p>
        Укажите полный бонус проверки вручную. Владение и модификатор не
        добавляются автоматически.
      </p>
      <div className="skill-editor">
        {core.skills.map((s) => (
          <div key={s.id}>
            <label>
              Навык
              <input
                aria-label="Название навыка"
                value={s.name}
                onChange={(e) => patch(s.id, { name: e.target.value })}
              />
            </label>
            <NumberField
              label={`Бонус: ${s.name || "новый навык"}`}
              value={s.bonus}
              min={-1000}
              onChange={(v) => patch(s.id, { bonus: v })}
            />
            <button
              className="icon-button"
              aria-label={`Удалить навык: ${s.name}`}
              onClick={() =>
                update({ skills: core.skills.filter((a) => a.id !== s.id) })
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
          update({
            skills: [
              ...core.skills,
              { id: crypto.randomUUID(), name: "", bonus: null },
            ],
          })
        }
      >
        Добавить навык
      </button>
      <label className="entry-editor">
        Владения
        <textarea
          value={core.proficiencies}
          onChange={(e) => update({ proficiencies: e.target.value })}
          placeholder="Оружие, инструменты и другие владения…"
        />
      </label>
    </>
  );
}
export function EditSheet({
  core,
  update,
  smarchok = false,
}: Props & { smarchok?: boolean }) {
  return (
    <div className="entry-editor">
      <label>
        Имя персонажа
        <input
          value={core.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>
      <div className="edit-vitals">
        <NumberField
          label="Уровень"
          value={core.level}
          min={1}
          onChange={(level) => update({ level })}
        />
        <NumberField
          label="Текущее здоровье"
          value={core.hp}
          onChange={(hp) => update({ hp })}
        />
        <NumberField
          label="Максимальное здоровье"
          value={core.maxHp}
          onChange={(maxHp) => update({ maxHp })}
        />
        <NumberField
          label="Защита вручную"
          value={core.defense}
          onChange={(defense) => update({ defense })}
        />
        <NumberField
          label="Скорость"
          value={core.speed}
          onChange={(speed) => update({ speed })}
        />
      </div>
      <p className="inline-note">
        {smarchok
          ? "Здоровье, Защита и Скорость относятся к Туше. Сам гриб всегда имеет 1 HP."
          : "Пустая Защита означает значение активной стойки."}{" "}
        Характеристики и модификаторы редактируются отдельно; формула другой
        системы не применяется.
      </p>
      <div className="edit-attributes">
        {core.attributes.map((a) => (
          <div key={a.id}>
            <strong>{a.name}</strong>
            <NumberField
              label={`${a.name}: значение`}
              value={a.score}
              onChange={(v) =>
                update({
                  attributes: core.attributes.map((b) =>
                    b.id === a.id ? { ...b, score: v ?? 0 } : b,
                  ),
                })
              }
            />
            <NumberField
              label={`${a.name}: модификатор`}
              min={-1000}
              value={a.modifier}
              onChange={(v) =>
                update({
                  attributes: core.attributes.map((b) =>
                    b.id === a.id ? { ...b, modifier: v ?? 0 } : b,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
