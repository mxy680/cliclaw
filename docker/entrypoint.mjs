#!/usr/bin/env node

/**
 * Docker container entrypoint for cliclaw agents.
 *
 * Reads session.json from /instance/, invokes Claude via the agent SDK,
 * and streams events as NDJSON to stdout.
 */

import { readFileSync } from "fs";
import { query } from "@anthropic-ai/claude-agent-sdk";

const SESSION_PATH = "/instance/session.json";

async function main() {
  let session;
  try {
    session = JSON.parse(readFileSync(SESSION_PATH, "utf-8"));
  } catch (err) {
    process.stderr.write(`Error reading session.json: ${err.message}\n`);
    process.exit(1);
  }

  const { prompt, sessionId, model } = session;

  if (!prompt) {
    process.stderr.write("session.json must contain a 'prompt' field\n");
    process.exit(1);
  }

  try {
    const conversation = query({
      prompt,
      options: {
        cwd: "/instance/workspace",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true, // safe — containerized
        systemPrompt: { type: "preset", preset: "claude_code" },
        includePartialMessages: true,
        settingSources: ["project"],
        model: model || "claude-sonnet-4-6",
        ...(sessionId ? { resume: sessionId } : {}),
      },
    });

    for await (const event of conversation) {
      process.stdout.write(JSON.stringify(event) + "\n");
    }
  } catch (err) {
    process.stderr.write(`Agent error: ${err.message}\n${err.stack || ""}\n`);
    if (err.stderr) process.stderr.write(`Claude stderr: ${err.stderr}\n`);
    process.exit(1);
  }
}

main();
