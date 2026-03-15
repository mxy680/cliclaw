import { Command } from "commander";
import { TokenStore } from "@digitalpresence/cliclaw-auth";
import {
  handleWhoami,
  handleProjects, handleProject, handleProjectCreate, handleProjectDelete,
  handleDeployments, handleDeployment, handleRedeploy, handlePromote, handleDeploymentDelete, handleBuildLogs,
  handleDomains, handleDomain, handleDomainAdd, handleDomainRemove, handleDomainVerify,
  handleEnvs, handleEnvGet, handleEnvCreate, handleEnvUpdate, handleEnvDelete,
} from "../vercel/handlers.js";

type TokenStoreFactory = () => TokenStore;

export function registerVercelCommands(program: Command, getTokenStore: TokenStoreFactory): void {
  let cached: TokenStore | null = null;
  function resolve() {
    if (!cached) cached = getTokenStore();
    return cached;
  }

  const vercel = program.command("vercel").description("Vercel commands");

  // --- Account ---

  vercel
    .command("whoami")
    .description("Show authenticated user info")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleWhoami(resolve(), opts.account);
    });

  // --- Projects ---

  vercel
    .command("projects")
    .description("List projects")
    .option("--max-results <n>", "Maximum projects to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleProjects(resolve(), opts.account, parseInt(opts.maxResults));
    });

  vercel
    .command("project")
    .description("Get project details")
    .requiredOption("--project <id>", "Project ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleProject(resolve(), opts.account, opts.project);
    });

  vercel
    .command("project-create")
    .description("Create a project")
    .requiredOption("--name <name>", "Project name")
    .option("--framework <framework>", "Framework preset")
    .option("--git-repo <owner/repo>", "Git repository (owner/repo)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleProjectCreate(resolve(), opts.account, opts.name, opts.framework, opts.gitRepo);
    });

  vercel
    .command("project-delete")
    .description("Delete a project")
    .requiredOption("--project <id>", "Project ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleProjectDelete(resolve(), opts.account, opts.project);
    });

  // --- Deployments ---

  vercel
    .command("deployments")
    .description("List deployments")
    .option("--project <id>", "Project ID")
    .option("--max-results <n>", "Maximum deployments to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleDeployments(resolve(), opts.account, opts.project, parseInt(opts.maxResults));
    });

  vercel
    .command("deployment")
    .description("Get deployment details")
    .requiredOption("--deployment-id <id>", "Deployment ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleDeployment(resolve(), opts.account, opts.deploymentId);
    });

  vercel
    .command("redeploy")
    .description("Redeploy an existing deployment")
    .requiredOption("--deployment-id <id>", "Deployment ID")
    .option("--target <target>", "Deployment target (production/preview)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleRedeploy(resolve(), opts.account, opts.deploymentId, opts.target);
    });

  vercel
    .command("promote")
    .description("Promote deployment to production")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--deployment-id <id>", "Deployment ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handlePromote(resolve(), opts.account, opts.project, opts.deploymentId);
    });

  vercel
    .command("deployment-delete")
    .description("Delete a deployment")
    .requiredOption("--deployment-id <id>", "Deployment ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleDeploymentDelete(resolve(), opts.account, opts.deploymentId);
    });

  vercel
    .command("build-logs")
    .description("Get build logs for a deployment")
    .requiredOption("--deployment-id <id>", "Deployment ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleBuildLogs(resolve(), opts.account, opts.deploymentId);
    });

  // --- Domains ---

  vercel
    .command("domains")
    .description("List domains")
    .option("--max-results <n>", "Maximum domains to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleDomains(resolve(), opts.account, parseInt(opts.maxResults));
    });

  vercel
    .command("domain")
    .description("Get domain details")
    .requiredOption("--domain <domain>", "Domain name")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleDomain(resolve(), opts.account, opts.domain);
    });

  vercel
    .command("domain-add")
    .description("Add domain to project")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--domain <domain>", "Domain name")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleDomainAdd(resolve(), opts.account, opts.project, opts.domain);
    });

  vercel
    .command("domain-remove")
    .description("Remove domain from project")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--domain <domain>", "Domain name")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleDomainRemove(resolve(), opts.account, opts.project, opts.domain);
    });

  vercel
    .command("domain-verify")
    .description("Verify domain on project")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--domain <domain>", "Domain name")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleDomainVerify(resolve(), opts.account, opts.project, opts.domain);
    });

  // --- Environment Variables ---

  vercel
    .command("envs")
    .description("List environment variables")
    .requiredOption("--project <id>", "Project ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleEnvs(resolve(), opts.account, opts.project);
    });

  vercel
    .command("env")
    .description("Get environment variable")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--env-id <id>", "Environment variable ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleEnvGet(resolve(), opts.account, opts.project, opts.envId);
    });

  vercel
    .command("env-create")
    .description("Create environment variable")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--key <key>", "Variable key")
    .requiredOption("--value <value>", "Variable value")
    .requiredOption("--target <targets>", "Comma-separated deployment targets")
    .option("--type <type>", "Variable type", "encrypted")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const target = opts.target.split(",").map((t: string) => t.trim());
      await handleEnvCreate(resolve(), opts.account, opts.project, opts.key, opts.value, target, opts.type);
    });

  vercel
    .command("env-update")
    .description("Update environment variable value")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--env-id <id>", "Environment variable ID")
    .requiredOption("--value <value>", "New variable value")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleEnvUpdate(resolve(), opts.account, opts.project, opts.envId, opts.value);
    });

  vercel
    .command("env-delete")
    .description("Delete environment variable")
    .requiredOption("--project <id>", "Project ID")
    .requiredOption("--env-id <id>", "Environment variable ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleEnvDelete(resolve(), opts.account, opts.project, opts.envId);
    });
}
