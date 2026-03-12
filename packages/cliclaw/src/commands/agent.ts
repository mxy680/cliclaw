import { Command } from "commander";
import type { AgentStore } from "@cliclaw/auth";
import { handleAgentCreate, handleAgentList, handleAgentShow, handleAgentDelete } from "../agent/crud.js";
import { handleAgentGrant, handleAgentRevoke } from "../agent/permissions.js";
import { handleAgentMemory, handleAgentMemoryAdd, handleAgentMemoryClear } from "../agent/memory.js";

type AgentStoreFactory = () => AgentStore;

export function registerAgentCommands(program: Command, getAgentStore: AgentStoreFactory): void {
  const agent = program.command("agent").description("Manage agents");

  agent
    .command("create")
    .description("Create a new agent")
    .requiredOption("--name <name>", "Agent slug name")
    .requiredOption("--display-name <displayName>", "Display name")
    .requiredOption("--role <role>", "Role / system prompt")
    .action(async (opts) => {
      await handleAgentCreate(getAgentStore(), opts.name, opts.displayName, opts.role);
    });

  agent
    .command("list")
    .description("List all agents")
    .action(async () => {
      await handleAgentList(getAgentStore());
    });

  agent
    .command("show")
    .description("Show full agent config")
    .argument("<name>", "Agent name")
    .action(async (name) => {
      await handleAgentShow(getAgentStore(), name);
    });

  agent
    .command("delete")
    .description("Delete an agent")
    .argument("<name>", "Agent name")
    .action(async (name) => {
      await handleAgentDelete(getAgentStore(), name);
    });

  agent
    .command("grant")
    .description("Grant a permission to an agent")
    .argument("<name>", "Agent name")
    .requiredOption("--integration <integration>", "Integration name (gmail, gdrive)")
    .requiredOption("--account <account>", "Account name")
    .action(async (name, opts) => {
      await handleAgentGrant(getAgentStore(), name, opts.integration, opts.account);
    });

  agent
    .command("revoke")
    .description("Revoke a permission from an agent")
    .argument("<name>", "Agent name")
    .requiredOption("--integration <integration>", "Integration name (gmail, gdrive)")
    .requiredOption("--account <account>", "Account name")
    .action(async (name, opts) => {
      await handleAgentRevoke(getAgentStore(), name, opts.integration, opts.account);
    });

  const memory = agent
    .command("memory")
    .description("Manage agent memory")
    .argument("[name]", "Agent name (shows memory facts)")
    .action(async (name) => {
      if (name) {
        await handleAgentMemory(getAgentStore(), name);
      }
    });

  memory
    .command("add")
    .description("Add a memory fact")
    .argument("<name>", "Agent name")
    .requiredOption("--fact <fact>", "Fact to remember")
    .action(async (name, opts) => {
      await handleAgentMemoryAdd(getAgentStore(), name, opts.fact);
    });

  memory
    .command("clear")
    .description("Clear all memory")
    .argument("<name>", "Agent name")
    .action(async (name) => {
      await handleAgentMemoryClear(getAgentStore(), name);
    });
}
