import { Command } from "commander";
import type { AgentStore } from "@cliclaw/auth";
import { handleAgentCreate, handleAgentList, handleAgentShow, handleAgentDelete } from "../agent/crud.js";
import { handleAgentGrant, handleAgentRevoke } from "../agent/permissions.js";
import {
  handleAgentMemory,
  handleAgentMemoryAdd,
  handleAgentMemoryRemove,
  handleAgentMemorySearch,
  handleAgentMemoryClear,
} from "../agent/memory.js";

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
    .option("--tag <tag>", "Filter by tag")
    .option("--recent <n>", "Show N most recent")
    .action(async (name, opts) => {
      if (name) {
        await handleAgentMemory(getAgentStore(), name, {
          tag: opts.tag,
          recent: opts.recent ? parseInt(opts.recent, 10) : undefined,
        });
      }
    });

  memory
    .command("add")
    .description("Add a memory fact")
    .argument("<name>", "Agent name")
    .requiredOption("--fact <fact>", "Fact to remember")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--source <source>", "Source: user, agent, or system", "user")
    .option("--importance <n>", "Importance: 1 (low), 2 (normal), 3 (critical)", "2")
    .action(async (name, opts) => {
      await handleAgentMemoryAdd(getAgentStore(), name, opts.fact, {
        tags: opts.tags,
        source: opts.source,
        importance: opts.importance,
      });
    });

  memory
    .command("remove")
    .description("Remove a memory by ID or tag")
    .argument("<name>", "Agent name")
    .argument("[id]", "Memory ID")
    .option("--tag <tag>", "Remove all with this tag")
    .action(async (name, id, opts) => {
      await handleAgentMemoryRemove(getAgentStore(), name, id, opts.tag);
    });

  memory
    .command("search")
    .description("Search memories")
    .argument("<name>", "Agent name")
    .argument("<query>", "Search query")
    .action(async (name, query) => {
      await handleAgentMemorySearch(getAgentStore(), name, query);
    });

  memory
    .command("clear")
    .description("Clear all memory")
    .argument("<name>", "Agent name")
    .action(async (name) => {
      await handleAgentMemoryClear(getAgentStore(), name);
    });
}
