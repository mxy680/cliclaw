import { Command } from "commander";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { generateUniversalClaudeMd, getConfigDir } from "@digitalpresence/cliclaw-auth";
import { outputJson } from "../lib/output.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize/update the universal CLAUDE.md for all agents")
    .action(async () => {
      const configDir = getConfigDir();
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      const claudeMdPath = join(configDir, "CLAUDE.md");
      writeFileSync(claudeMdPath, generateUniversalClaudeMd(), "utf-8");

      outputJson({ status: "initialized", path: claudeMdPath });
    });
}
