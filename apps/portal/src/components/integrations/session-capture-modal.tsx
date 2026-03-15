"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface SessionCaptureModalProps {
  integration: string;
  displayName: string;
  open: boolean;
  onConnected: (username: string) => void;
  onCancel: () => void;
}

export function SessionCaptureModal({
  integration,
  displayName,
  open,
  onConnected,
  onCancel,
}: SessionCaptureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const remoteSize = useRef({ width: 1024, height: 768 });
  const [status, setStatus] = useState<
    "idle" | "starting" | "active" | "connected" | "error"
  >("idle");
  const [connectedUser, setConnectedUser] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Input sending helper
  const sendInput = useCallback(
    async (event: Record<string, unknown>) => {
      if (!sessionIdRef.current) return;
      try {
        await fetch(`/api/integrations/session/${integration}/input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            ...event,
          }),
        });
      } catch {}
    },
    [integration]
  );

  // Get canvas coordinates scaled to remote viewport
  const getScaledCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = remoteSize.current.width / rect.width;
      const scaleY = remoteSize.current.height / rect.height;
      return {
        x: Math.round((clientX - rect.left) * scaleX),
        y: Math.round((clientY - rect.top) * scaleY),
      };
    },
    []
  );

  // Start session when modal opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function startSession() {
      setStatus("starting");
      setErrorMsg("");

      try {
        // Create browser session
        const res = await fetch(
          `/api/integrations/session/${integration}`,
          { method: "POST" }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create session");
        }
        const { sessionId } = await res.json();
        if (cancelled) return;

        sessionIdRef.current = sessionId;

        // Connect SSE stream
        const es = new EventSource(
          `/api/integrations/session/${integration}?sessionId=${sessionId}`
        );
        eventSourceRef.current = es;

        es.addEventListener("metadata", (e) => {
          const { width, height } = JSON.parse(e.data);
          remoteSize.current = { width, height };
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = width;
            canvas.height = height;
          }
        });

        es.addEventListener("frame", (e) => {
          setStatus("active");
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = `data:image/jpeg;base64,${e.data}`;
        });

        es.addEventListener("connected", (e) => {
          const { username } = JSON.parse(e.data);
          setStatus("connected");
          setConnectedUser(username);
          setTimeout(() => onConnected(username), 1500);
        });

        es.addEventListener("error", (e) => {
          if (e instanceof MessageEvent && e.data) {
            const { message } = JSON.parse(e.data);
            setErrorMsg(message);
          }
          setStatus("error");
        });

        es.addEventListener("closed", () => {
          es.close();
        });

        es.onerror = () => {
          // EventSource will auto-reconnect, but if the session is closed
          // this just means we're done
          if (status === "connected") return;
        };
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to start session"
        );
        setStatus("error");
      }
    }

    startSession();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      sessionIdRef.current = null;
      setStatus("idle");
    };
  }, [open, integration]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { x, y } = getScaledCoords(e.clientX, e.clientY);
      sendInput({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
    },
    [getScaledCoords, sendInput]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { x, y } = getScaledCoords(e.clientX, e.clientY);
      sendInput({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    },
    [getScaledCoords, sendInput]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Only send on button press (dragging) to reduce traffic
      if (e.buttons === 0) return;
      const { x, y } = getScaledCoords(e.clientX, e.clientY);
      sendInput({ type: "mouseMoved", x, y });
    },
    [getScaledCoords, sendInput]
  );

  // Touch event handlers (mobile)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = getScaledCoords(touch.clientX, touch.clientY);
      sendInput({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
    },
    [getScaledCoords, sendInput]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const { x, y } = getScaledCoords(touch.clientX, touch.clientY);
      sendInput({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    },
    [getScaledCoords, sendInput]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = getScaledCoords(touch.clientX, touch.clientY);
      sendInput({ type: "mouseMoved", x, y });
    },
    [getScaledCoords, sendInput]
  );

  // Keyboard event handlers
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      sendInput({
        type: "keyDown",
        key: e.key,
        code: e.code,
        text: e.key.length === 1 ? e.key : undefined,
        keyCode: e.keyCode,
      });
    },
    [sendInput]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      sendInput({
        type: "keyUp",
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
      });
    },
    [sendInput]
  );

  // Wheel event handler
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { x, y } = getScaledCoords(e.clientX, e.clientY);
      sendInput({
        type: "mouseWheel",
        x,
        y,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
      });
    },
    [getScaledCoords, sendInput]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col bg-card border border-border rounded-sm shadow-xl max-w-[95vw] max-h-[95vh] w-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <span
              className={`w-2 h-2 rounded-full ${
                status === "connected"
                  ? "bg-green-500"
                  : status === "active"
                    ? "bg-amber-500 animate-pulse"
                    : status === "error"
                      ? "bg-red-500"
                      : "bg-muted-foreground/30"
              }`}
            />
            <p className="font-mono text-sm">
              {status === "starting"
                ? `Loading ${displayName} login...`
                : status === "connected"
                  ? `Connected as @${connectedUser}`
                  : status === "error"
                    ? errorMsg || "Connection error"
                    : `Log into ${displayName}`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {status === "connected" ? "Done" : "Cancel"}
          </Button>
        </div>

        {/* Browser viewport */}
        <div className="relative overflow-hidden">
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex items-center gap-3">
                <div className="thinking-dot" style={{ animationDelay: "0s" }} />
                <div className="thinking-dot" style={{ animationDelay: "0.2s" }} />
                <div className="thinking-dot" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}

          {status === "connected" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="font-mono text-sm text-green-500">
                  Connected as @{connectedUser}
                </p>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={1024}
            height={768}
            tabIndex={0}
            className="block w-full max-w-[1024px] h-auto cursor-default outline-none"
            style={{ touchAction: "none" }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onWheel={handleWheel}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
