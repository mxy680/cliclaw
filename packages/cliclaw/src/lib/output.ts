export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputError(error: string, message?: string): never {
  console.log(JSON.stringify({ error, message: message ?? error }));
  process.exit(1);
}

export function outputAuthRequired(): never {
  console.log(JSON.stringify({ error: "auth_required", action: "Run: cliclaw gmail auth" }));
  process.exit(1);
}
