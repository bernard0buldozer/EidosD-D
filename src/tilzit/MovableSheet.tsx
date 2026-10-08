import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent,
} from "react";
import { ChevronDown, RotateCcw } from "../components/Icons";
import {
  blockIds,
  decodeLayout,
  defaultLayout,
  layoutKey,
  moveBlock,
  packLayout,
  type BlockId,
  type BlockLayout,
} from "./layout";

export const blockTitles: Record<BlockId, string> = {
  attributes: "Характеристики",
  health: "Здоровье и бой",
  stances: "Стойки",
  skills: "Навыки",
  attacks: "Атаки",
  abilities: "Способности",
  equipment: "Снаряжение",
  rolls: "Броски",
  history: "История",
  notes: "Заметки",
};
export function MovableSheet({
  portrait,
  blocks,
}: {
  portrait: ReactNode;
  blocks: Record<BlockId, ReactNode>;
}) {
  const [layout, setLayout] = useState<BlockLayout[]>(() => {
    try {
      return decodeLayout(localStorage.getItem(layoutKey));
    } catch {
      return defaultLayout();
    }
  });
  const [editing, setEditing] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [target, setTarget] = useState<BlockId | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const gesture = useRef<{
    id: BlockId;
    kind: "move" | "resize";
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    width: number;
    height: number;
    moved: boolean;
    target: BlockId | null;
  } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(
        layoutKey,
        JSON.stringify({ version: 1, blocks: layout }),
      );
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }, [layout]);
  useEffect(() => {
    if (!editing) return;
    let frame: number;
    const tick = () => {
      const g = gesture.current;
      if (g?.kind === "move" && g.moved) {
        const speed =
          g.clientY < 65 ? -16 : g.clientY > window.innerHeight - 65 ? 16 : 0;
        if (speed) {
          window.scrollBy({ top: speed, behavior: "instant" });
          const id = document
            .elementFromPoint(g.clientX, g.clientY)
            ?.closest<HTMLElement>("[data-block]")?.dataset.block as
            | BlockId
            | undefined;
          g.target = id && id !== g.id && blockIds.includes(id) ? id : null;
          setTarget(g.target);
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [editing]);
  const patch = (id: BlockId, p: Partial<BlockLayout>) =>
    setLayout((current) =>
      current.map((b) => (b.id === id ? { ...b, ...p } : b)),
    );
  const begin = (
    event: PointerEvent<HTMLButtonElement>,
    block: BlockLayout,
    kind: "move" | "resize",
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      id: block.id,
      kind,
      x: event.clientX,
      y: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      width: block.width,
      height: block.height,
      moved: false,
      target: null,
    };
  };
  const change = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    g.clientX = event.clientX;
    g.clientY = event.clientY;
    const dx = event.clientX - g.x,
      dy = event.clientY - g.y;
    if (Math.hypot(dx, dy) < 5 && !g.moved) return;
    g.moved = true;
    if (g.kind === "resize") {
      const gridWidth = grid.current?.getBoundingClientRect().width ?? 1000;
      const narrow = window.matchMedia("(max-width: 760px)").matches;
      patch(g.id, {
        width: narrow
          ? g.width
          : Math.max(
              4,
              Math.min(12, g.width + Math.round(dx / ((gridWidth + 12) / 12))),
            ),
        height: Math.max(7, Math.min(36, g.height + Math.round(dy / 28))),
      });
    } else {
      const element = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-block]");
      const id = element?.dataset.block as BlockId | undefined;
      g.target = id && id !== g.id && blockIds.includes(id) ? id : null;
      setTarget(g.target);
    }
  };
  const end = () => {
    const g = gesture.current;
    if (g?.kind === "move" && g.moved && g.target) {
      setLayout((current) => moveBlock(current, g.id, g.target!));
      setAnnouncement(
        `Блок «${blockTitles[g.id]}» перемещён к «${blockTitles[g.target]}».`,
      );
    } else if (g?.kind === "resize" && g.moved)
      setAnnouncement(`Размер блока «${blockTitles[g.id]}» изменён.`);
    gesture.current = null;
    setTarget(null);
  };
  const keyboardMove = (id: BlockId, direction: number) => {
    setLayout((current) => {
      const index = current.findIndex((b) => b.id === id);
      const next = [...current];
      const destination = Math.max(
        0,
        Math.min(next.length - 1, index + direction),
      );
      if (index !== destination)
        [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
    setAnnouncement(`Расположение блока «${blockTitles[id]}» изменено.`);
  };
  return (
    <>
      <div className="tilzit-layout-toolbar">
        <div>
          <span className="eyebrow">Игровой стол</span>
          <p>
            {editing
              ? "Тяните блок за ручку. Угол меняет размер; стрелки работают с клавиатуры."
              : "Нажмите на характеристику для проверки. Все изменения сохраняются на устройстве."}
          </p>
        </div>
        <div className="button-row">
          <button
            className={`button ${editing ? "primary" : "secondary"}`}
            aria-pressed={editing}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Готово" : "Настроить расположение"}
          </button>
          {editing && (
            <button
              className="button secondary"
              onClick={() => {
                setLayout(defaultLayout());
                setAnnouncement(
                  "Исходная раскладка восстановлена. Данные персонажа сохранены.",
                );
              }}
            >
              <RotateCcw size={16} />
              Сбросить раскладку
            </button>
          )}
        </div>
      </div>
      {!storageOk && (
        <p role="alert" className="error-text">
          Не удалось сохранить расположение блоков на устройстве.
        </p>
      )}
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
      <div className={`tilzit-grid ${editing ? "configuring" : ""}`} ref={grid}>
        <aside className="tilzit-portrait-tile">{portrait}</aside>
        {packLayout(layout).map((block) => (
          <section
            key={block.id}
            data-block={block.id}
            className={`tilzit-tile ${block.collapsed ? "collapsed" : ""} ${target === block.id ? "drop-target" : ""}`}
            aria-labelledby={`tilzit-title-${block.id}`}
            style={
              {
                gridColumn: `${block.x + 1} / span ${block.width}`,
                gridRow: `${block.y + 1} / span ${block.collapsed ? 2 : block.height}`,
                "--tile-height": `${block.height * 28 - 12}px`,
              } as CSSProperties
            }
          >
            <header className="tilzit-block-header">
              {editing && (
                <button
                  className="tile-move-handle"
                  aria-label={`Переместить: ${blockTitles[block.id]}`}
                  title="Тяните за ручку или используйте стрелки"
                  onPointerDown={(e) => begin(e, block, "move")}
                  onPointerMove={change}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onKeyDown={(e) => {
                    if (
                      [
                        "ArrowUp",
                        "ArrowLeft",
                        "ArrowDown",
                        "ArrowRight",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      keyboardMove(
                        block.id,
                        ["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 1,
                      );
                    }
                  }}
                >
                  <span aria-hidden="true">⠿</span>
                </button>
              )}
              <span className="tile-ornament" aria-hidden="true">
                ✥
              </span>
              <h2 id={`tilzit-title-${block.id}`}>{blockTitles[block.id]}</h2>
              <button
                className="tile-collapse"
                aria-label={`${block.collapsed ? "Развернуть" : "Свернуть"}: ${blockTitles[block.id]}`}
                aria-expanded={!block.collapsed}
                aria-controls={`tilzit-content-${block.id}`}
                onClick={() => patch(block.id, { collapsed: !block.collapsed })}
              >
                <ChevronDown size={18} />
              </button>
            </header>
            <div
              id={`tilzit-content-${block.id}`}
              className="tilzit-block-content"
              hidden={block.collapsed}
            >
              {blocks[block.id]}
            </div>
            {editing && !block.collapsed && (
              <button
                className="tile-resize-handle"
                aria-label={`Изменить размер: ${blockTitles[block.id]}`}
                title="Тяните за угол или используйте стрелки"
                onPointerDown={(e) => begin(e, block, "resize")}
                onPointerMove={change}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={(e) => {
                  if (
                    [
                      "ArrowUp",
                      "ArrowLeft",
                      "ArrowDown",
                      "ArrowRight",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    patch(block.id, {
                      width: Math.max(
                        4,
                        Math.min(
                          12,
                          block.width +
                            (e.key === "ArrowLeft"
                              ? -1
                              : e.key === "ArrowRight"
                                ? 1
                                : 0),
                        ),
                      ),
                      height: Math.max(
                        7,
                        Math.min(
                          36,
                          block.height +
                            (e.key === "ArrowUp"
                              ? -1
                              : e.key === "ArrowDown"
                                ? 1
                                : 0),
                        ),
                      ),
                    });
                  }
                }}
              >
                <span aria-hidden="true">◢</span>
              </button>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
