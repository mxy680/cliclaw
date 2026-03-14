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

function buildOptions(prompt, sessionId, model) {
  return {
    prompt,
    options: {
      cwd: "/instance/workspace",
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true, // safe — containerized
      systemPrompt: { type: "preset", preset: "claude_code" },
      includePartialMessages: true,
      settingSources: ["project"],
      maxTurns: 20,
      model: model || "claude-sonnet-4-6",
      ...(sessionId ? { resume: sessionId } : {}),
    },
  };
}

async function run(prompt, sessionId, model) {
  const conversation = query(buildOptions(prompt, sessionId, model));
  for await (const event of conversation) {
    process.stdout.write(JSON.stringify(event) + "\n");
  }
}

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
    await run(prompt, sessionId, model);
  } catch (err) {
    // If resume fails (stale session), retry without sessionId
    if (sessionId && err.message?.includes("No conversation found")) {
      process.stderr.write(`Session ${sessionId} not found, starting fresh\n`);
      try {
        await run(prompt, null, model);
        return;
      } catch (retryErr) {
        process.stderr.write(`Agent error: ${retryErr.message}\n${retryErr.stack || ""}\n`);
        process.exit(1);
      }
    }
    process.stderr.write(`Agent error: ${err.message}\n${err.stack || ""}\n`);
    if (err.stderr) process.stderr.write(`Claude stderr: ${err.stderr}\n`);
    process.exit(1);
  }
}

main();
