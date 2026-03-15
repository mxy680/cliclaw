import { chromium, type Browser, type Page, type CDPSession } from "playwright";
import { INTEGRATIONS, type SessionConfig } from "@digitalpresence/cliclaw-auth";

export type SessionEvent =
  | { type: "frame"; data: string }
  | { type: "metadata"; width: number; height: number }
  | {
      type: "connected";
      username: string;
      cookies: Record<string, string>;
    }
  | { type: "error"; message: string }
  | { type: "closed" };

interface BrowserSession {
  id: string;
  browser: Browser;
  page: Page;
  cdp: CDPSession;
  userId: string;
  integration: string;
  config: SessionConfig;
  listeners: Set<(event: SessionEvent) => void>;
  timeout: ReturnType<typeof setTimeout>;
  cookieCheckInterval: ReturnType<typeof setInterval>;
  status: "starting" | "active" | "connected" | "closed";
  viewportWidth: number;
  viewportHeight: number;
}

const MAX_CONCURRENT = 5;
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;

class BrowserSessionManager {
  private sessions = new Map<string, BrowserSession>();

  async createSession(
    userId: string,
    integration: string
  ): Promise<string> {
    if (this.sessions.size >= MAX_CONCURRENT) {
      throw new Error("Too many concurrent browser sessions");
    }

    const def = INTEGRATIONS[integration];
    if (!def?.sessionConfig) {
      throw new Error(`No session config for integration: ${integration}`);
    }
    const config = def.sessionConfig;

    const id = crypto.randomUUID();

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    const session: BrowserSession = {
      id,
      browser,
      page,
      cdp,
      userId,
      integration,
      config,
      listeners: new Set(),
      timeout: setTimeout(() => this.closeSession(id), SESSION_TIMEOUT),
      cookieCheckInterval: setInterval(() => this.checkCookies(id), 1000),
      status: "starting",
      viewportWidth: VIEWPORT_WIDTH,
      viewportHeight: VIEWPORT_HEIGHT,
    };

    this.sessions.set(id, session);

    // Stream viewport frames via CDP screencast
    cdp.on("Page.screencastFrame", (params: { data: string; sessionId: number }) => {
      this.emit(id, { type: "frame", data: params.data });
      cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => {});
    });

    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 60,
      maxWidth: VIEWPORT_WIDTH,
      maxHeight: VIEWPORT_HEIGHT,
    });

    // Navigate to login page
    await page.goto(config.loginUrl, { waitUntil: "domcontentloaded" });
    session.status = "active";

    this.emit(id, {
      type: "metadata",
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    });

    return id;
  }

  async dispatchInput(sessionId: string, event: InputPayload): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "closed") return;

    const { cdp } = session;

    try {
      switch (event.type) {
        case "mousePressed":
        case "mouseReleased":
        case "mouseMoved":
          await cdp.send("Input.dispatchMouseEvent", {
            type: event.type,
            x: event.x,
            y: event.y,
            button: (event.button || "left") as "left" | "right" | "middle" | "back" | "forward" | "none",
            clickCount: event.clickCount || 1,
          });
          break;

        case "mouseWheel":
          await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseWheel",
            x: event.x,
            y: event.y,
            deltaX: event.deltaX || 0,
            deltaY: event.deltaY || 0,
          });
          break;

        case "keyDown":
          await cdp.send("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: event.key,
            code: event.code,
            text: event.text,
            windowsVirtualKeyCode: event.keyCode,
            nativeVirtualKeyCode: event.keyCode,
          });
          // Also send char event for text input
          if (event.text && event.text.length === 1) {
            await cdp.send("Input.dispatchKeyEvent", {
              type: "char",
              text: event.text,
            });
          }
          break;

        case "keyUp":
          await cdp.send("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: event.key,
            code: event.code,
            windowsVirtualKeyCode: event.keyCode,
            nativeVirtualKeyCode: event.keyCode,
          });
          break;
      }
    } catch {
      // Input dispatch can fail during page navigation, ignore
    }
  }

  subscribe(
    sessionId: string,
    listener: (event: SessionEvent) => void
  ): () => void {
    const session = this.sessions.get(sessionId);
    if (!session) return () => {};

    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  private emit(sessionId: string, event: SessionEvent) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    for (const listener of session.listeners) {
      try {
        listener(event);
      } catch {}
    }
  }

  private async checkCookies(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") return;

    try {
      const cookies = await session.page.context().cookies();
      const domainCookies = cookies.filter((c) =>
        c.domain.includes(session.config.domain)
      );

      const hasAllRequired = session.config.successCookies.every((name: string) =>
        domainCookies.some((c) => c.name === name && c.value)
      );

      if (!hasAllRequired) return;

      // Login detected!
      session.status = "connected";
      clearInterval(session.cookieCheckInterval);

      const extractedCookies: Record<string, string> = {};
      for (const name of session.config.extractCookies) {
        const cookie = domainCookies.find((c) => c.name === name);
        if (cookie) extractedCookies[name] = cookie.value;
      }

      // Try to identify the user
      const username = await this.getUserIdentifier(
        session.integration,
        extractedCookies
      );

      this.emit(sessionId, {
        type: "connected",
        username: username || "unknown",
        cookies: extractedCookies,
      });

      // Close browser after a short delay to let the client see the success
      setTimeout(() => this.closeSession(sessionId), 3000);
    } catch {
      // Page might be navigating, ignore
    }
  }

  private async getUserIdentifier(
    integration: string,
    cookies: Record<string, string>
  ): Promise<string | null> {
    try {
      if (integration === "instagram") {
        const cookieHeader = Object.entries(cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; ");

        const res = await fetch(
          "https://i.instagram.com/api/v1/accounts/current_user/?edit=true",
          {
            headers: {
              Cookie: cookieHeader,
              "User-Agent": "Instagram 275.0.0.27.98 Android",
              "X-IG-App-ID": "936619743392459",
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          return data.user?.username || null;
        }
      }
    } catch {}
    return null;
  }

  async closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = "closed";
    clearTimeout(session.timeout);
    clearInterval(session.cookieCheckInterval);

    this.emit(sessionId, { type: "closed" });

    try {
      await session.cdp.send("Page.stopScreencast").catch(() => {});
      await session.browser.close();
    } catch {}

    this.sessions.delete(sessionId);
  }
}

export type InputPayload =
  | {
      type: "mousePressed" | "mouseReleased" | "mouseMoved";
      x: number;
      y: number;
      button?: string;
      clickCount?: number;
    }
  | {
      type: "mouseWheel";
      x: number;
      y: number;
      deltaX?: number;
      deltaY?: number;
    }
  | {
      type: "keyDown" | "keyUp";
      key: string;
      code: string;
      text?: string;
      keyCode?: number;
    };

// Singleton that survives HMR
function getSessionManager(): BrowserSessionManager {
  const g = globalThis as Record<string, unknown>;
  if (!g.__browserSessionManager) {
    g.__browserSessionManager = new BrowserSessionManager();
  }
  return g.__browserSessionManager as BrowserSessionManager;
}

export { getSessionManager };
