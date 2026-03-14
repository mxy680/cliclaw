"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

type ToastFn = (message: string, type?: Toast["type"]) => void;

const ToastContext = createContext<ToastFn>(() => {});

let _globalToast: ToastFn = () => {};

export function toast(message: string, type: Toast["type"] = "info") {
  _globalToast(message, type);
}

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast: ToastFn = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    _globalToast = addToast;
  }, [addToast]);

  const typeStyles: Record<Toast["type"], string> = {
    success: "border-green-500/30 bg-green-500/10 text-green-400",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    info: "border-amber/30 bg-amber/10 text-amber",
  };

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-in-up rounded-sm border px-4 py-2 font-mono text-sm shadow-lg ${typeStyles[t.type]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
