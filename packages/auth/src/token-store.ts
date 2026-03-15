import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OAuthCredentials = Record<string, any>;

interface TokenFile {
  [account: string]: OAuthCredentials;
}

export class TokenStore {
  constructor(private tokensPath: string) {}

  private load(): TokenFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as TokenFile;
    } catch {
      return {};
    }
  }

  private save(data: TokenFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  get(account: string): OAuthCredentials | null {
    const data = this.load();
    if (data[account]) return data[account];
    // Fall back to integration:account key format (portal token injection)
    for (const key of Object.keys(data)) {
      const colonIdx = key.indexOf(":");
      if (colonIdx !== -1 && key.slice(colonIdx + 1) === account) {
        return data[key];
      }
    }
    return null;
  }

  set(account: string, tokens: OAuthCredentials): void {
    const data = this.load();
    data[account] = tokens;
    this.save(data);
  }

  has(account: string): boolean {
    return this.get(account) !== null;
  }

  delete(account: string): boolean {
    const data = this.load();
    if (account in data) {
      delete data[account];
      this.save(data);
      return true;
    }
    // Try integration:account key format
    for (const key of Object.keys(data)) {
      const colonIdx = key.indexOf(":");
      if (colonIdx !== -1 && key.slice(colonIdx + 1) === account) {
        delete data[key];
        this.save(data);
        return true;
      }
    }
    return false;
  }

  list(): string[] {
    return Object.keys(this.load());
  }
}
