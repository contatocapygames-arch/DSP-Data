import { createContext, useCallback, useContext, useState, type MouseEvent, type ReactNode } from "react";

interface TooltipApi {
  show: (e: MouseEvent, content: ReactNode) => void;
  hide: () => void;
}

const TooltipContext = createContext<TooltipApi>({ show: () => {}, hide: () => {} });

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const show = useCallback((e: MouseEvent, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content }), []);
  const hide = useCallback(() => setTip(null), []);

  // Vira para a esquerda/cima quando o cursor está perto da borda da tela.
  const flipX = tip && tip.x > window.innerWidth - 280;
  const flipY = tip && tip.y > window.innerHeight - 160;

  return (
    <TooltipContext.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div
          className="tooltip"
          role="tooltip"
          style={{
            left: tip.x + (flipX ? -12 : 12),
            top: tip.y + (flipY ? -12 : 12),
            transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
          }}
        >
          {tip.content}
        </div>
      )}
    </TooltipContext.Provider>
  );
}

export const useTooltip = () => useContext(TooltipContext);

/** Props para qualquer elemento com tooltip no hover. */
export function useTipProps() {
  const { show, hide } = useTooltip();
  return (content: ReactNode) => ({
    onMouseEnter: (e: MouseEvent) => show(e, content),
    onMouseMove: (e: MouseEvent) => show(e, content),
    onMouseLeave: hide,
  });
}
