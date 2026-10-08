import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type DiceBox from "@3d-dice/dice-box";
import type { DicePool, Roll, RollKind, DieSides } from "../domain/types";
import { signed } from "../domain/dice";
import { simpleRoll } from "../tilzit/rolls";
import type { CheckMode } from "../domain/types";
export interface RollRequest {
  label: string;
  kind: RollKind;
  pool: DicePool[];
  modifier: number | null;
  disadvantage?: boolean;
  critical?: boolean;
}
type DiceController = {
  roll: (r: RollRequest) => Promise<Roll | null>;
  rolling: boolean;
  error: string;
  clear: () => void;
  mode?: CheckMode;
  setMode?: (mode: CheckMode) => void;
};
const Context = createContext<DiceController | null>(null);
export function SimpleDiceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CheckMode>("normal");
  const [error, setError] = useState("");
  const roll = async (request: RollRequest) => {
    try {
      setError("");
      return simpleRoll(request, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить бросок.");
      return null;
    }
  };
  return (
    <Context.Provider
      value={{
        roll,
        rolling: false,
        error,
        clear: () => setError(""),
        mode,
        setMode,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function physicalResult(
  request: RollRequest,
  dice: { sides: DieSides; value: number }[],
): Roll {
  const values = dice.map((d) => d.value);
  const selectedIndex = request.disadvantage && values[1] < values[0] ? 1 : 0;
  return {
    id: crypto.randomUUID(),
    label: request.label,
    kind: request.kind,
    sides: request.pool.length === 1 ? request.pool[0].sides : null,
    values,
    dice,
    pool: request.pool,
    selectedIndex,
    modifier: request.modifier,
    total:
      request.modifier === null
        ? null
        : (request.disadvantage
            ? values[selectedIndex]
            : values.reduce((a, b) => a + b, 0)) + request.modifier,
    critical: request.critical ?? false,
    disadvantage: request.disadvantage,
    timestamp: Date.now(),
  };
}
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
export function DiceProvider({ children }: { children: ReactNode }) {
  const box = useRef<DiceBox | null>(null);
  const initializing = useRef<Promise<DiceBox> | null>(null);
  const locked = useRef(false);
  const [rolling, setRolling] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Roll | null>(null);
  const init = () => {
    if (!initializing.current)
      initializing.current = (async () => {
        // Preserve Smarchok's physical dice and explicitly reject Dice-Box's RNG fallback.
        const probe = document.createElement("canvas");
        const gl =
          window.WebGLRenderingContext &&
          ((probe.getContext("webgl") ||
            probe.getContext(
              "experimental-webgl",
            )) as WebGLRenderingContext | null);
        if (!gl)
          throw new Error(
            "Браузер не поддерживает WebGL. Включите аппаратное ускорение или откройте лист в браузере с WebGL. 3D-бросок не выполнен.",
          );
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        const { default: DiceBox } = await import("@3d-dice/dice-box");
        const instance = new DiceBox({
          container: "#physical-dice",
          assetPath: `${import.meta.env.BASE_URL}dice-assets/`,
          offscreen: false,
          themeColor: "#62447d",
          scale: 6,
          enableShadows: true,
          delay: 25,
        });
        await instance.init();
        box.current = instance;
        return instance;
      })().catch((e) => {
        initializing.current = null;
        throw e;
      });
    return initializing.current;
  };
  const roll = async (request: RollRequest) => {
    if (locked.current) return null;
    if (
      !request.pool.length ||
      request.pool.some(
        (p) => !Number.isInteger(p.quantity) || p.quantity < 1,
      ) ||
      request.pool.reduce((n, p) => n + p.quantity, 0) > 30
    )
      return null;
    locked.current = true;
    setRolling(true);
    setError("");
    setVisible(true);
    setResult(null);
    try {
      const instance = await withTimeout(
        init(),
        25000,
        "Не удалось загрузить 3D-движок. Проверьте соединение и повторите бросок.",
      );
      const results = await withTimeout(
        instance.roll(request.pool.map((p) => `${p.quantity}d${p.sides}`)),
        30000,
        "Физический бросок не завершился. Результат не записан. Повторите бросок.",
      );
      const dice = results.map((d) => ({
        sides: d.sides as DieSides,
        value: d.value,
      }));
      if (
        dice.length !== request.pool.reduce((n, p) => n + p.quantity, 0) ||
        dice.some(
          (d) => !Number.isInteger(d.value) || d.value < 1 || d.value > d.sides,
        )
      )
        throw new Error(
          "3D-движок вернул неполный бросок. Результат не записан.",
        );
      const r = physicalResult(request, dice);
      setResult(r);
      return r;
    } catch (e) {
      setError(
        e instanceof Error && /[А-Яа-я]/.test(e.message)
          ? e.message
          : "3D-движок не смог завершить бросок. Проверьте соединение и повторите попытку.",
      );
      box.current?.clear();
      return null;
    } finally {
      locked.current = false;
      setRolling(false);
    }
  };
  const clear = () => {
    if (locked.current) return;
    box.current?.clear();
    setVisible(false);
    setResult(null);
    setError("");
  };
  return (
    <Context.Provider value={{ roll, rolling, error, clear }}>
      {children}
      <div
        id="physical-dice"
        className={`physical-dice ${visible ? "visible" : ""}`}
        aria-hidden="true"
      />
      {visible && (
        <div className="physical-result" role="status" aria-live="polite">
          {rolling
            ? "Бросаем 3D-кубики…"
            : error ||
              (result && (
                <>
                  <strong>{result.label}</strong>
                  <span>
                    {result.dice
                      ?.map((d) => `d${d.sides}: ${d.value}`)
                      .join(" · ")}{" "}
                    {result.disadvantage &&
                      `· помеха → ${result.values[result.selectedIndex]} `}
                    {result.modifier !== null &&
                      `${signed(result.modifier)} = ${result.total}`}
                  </span>
                </>
              ))}
          <button disabled={rolling} onClick={clear} aria-label="Убрать кубики">
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useDice = () => {
  const value = useContext(Context);
  if (!value) throw new Error("DiceProvider missing");
  return value;
};
