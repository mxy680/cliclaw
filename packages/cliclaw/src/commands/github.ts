import { Command } from "commander";
import { TokenStore } from "@digitalpresence/cliclaw-auth";
import {
  handleWhoami,
  handleRepos, handleRepoGet,
  handleIssues, handleIssueGet, handleIssueCreate, handleIssueComment, handleIssueClose,
  handlePulls, handlePullGet, handlePullReviews, handlePullMerge,
  handleNotifications,
  handleSearch,
  handleWorkflowRuns, handleWorkflowRunLogs,
} from "../github/handlers.js";

type TokenStoreFactory = () => TokenStore;

export function registerGithubCommands(program: Command, getTokenStore: TokenStoreFactory): void {
  let cached: TokenStore | null = null;
  function resolve() {
    if (!cached) cached = getTokenStore();
    return cached;
  }

  const github = program.command("github").description("GitHub commands");

  // --- User ---

  github
    .command("whoami")
    .description("Show authenticated user info")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleWhoami(resolve(), opts.account);
    });

  // --- Repos ---

  github
    .command("repos")
    .description("List repositories")
    .option("--max-results <n>", "Maximum repos to return", "30")
    .option("--type <type>", "Filter: all, owner, public, private, member", "all")
    .option("--sort <sort>", "Sort: created, updated, pushed, full_name", "updated")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleRepos(resolve(), opts.account, parseInt(opts.maxResults), opts.type, opts.sort);
    });

  github
    .command("repo")
    .description("Get repository details")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleRepoGet(resolve(), opts.account, opts.owner, opts.repo);
    });

  // --- Issues ---

  github
    .command("issues")
    .description("List issues in a repository")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .option("--state <state>", "Filter: open, closed, all", "open")
    .option("--max-results <n>", "Maximum issues to return", "30")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleIssues(resolve(), opts.account, opts.owner, opts.repo, opts.state, parseInt(opts.maxResults));
    });

  github
    .command("issue")
    .description("Get a single issue")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--number <number>", "Issue number")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleIssueGet(resolve(), opts.account, opts.owner, opts.repo, parseInt(opts.number));
    });

  github
    .command("issue-create")
    .description("Create an issue")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--title <title>", "Issue title")
    .option("--body <body>", "Issue body")
    .option("--labels <labels>", "Comma-separated labels")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const labels = opts.labels ? opts.labels.split(",").map((l: string) => l.trim()) : undefined;
      await handleIssueCreate(resolve(), opts.account, opts.owner, opts.repo, opts.title, opts.body, labels);
    });

  github
    .command("issue-comment")
    .description("Comment on an issue")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--number <number>", "Issue number")
    .requiredOption("--body <body>", "Comment body")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleIssueComment(resolve(), opts.account, opts.owner, opts.repo, parseInt(opts.number), opts.body);
    });

  github
    .command("issue-close")
    .description("Close an issue")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--number <number>", "Issue number")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleIssueClose(resolve(), opts.account, opts.owner, opts.repo, parseInt(opts.number));
    });

  // --- Pull Requests ---

  github
    .command("pulls")
    .description("List pull requests")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .option("--state <state>", "Filter: open, closed, all", "open")
    .option("--max-results <n>", "Maximum PRs to return", "30")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handlePulls(resolve(), opts.account, opts.owner, opts.repo, opts.state, parseInt(opts.maxResults));
    });

  github
    .command("pull")
    .description("Get a single pull request")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--number <number>", "PR number")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handlePullGet(resolve(), opts.account, opts.owner, opts.repo, parseInt(opts.number));
    });

  github
    .command("pull-reviews")
    .description("List reviews on a pull request")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--number <number>", "PR number")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handlePullReviews(resolve(), opts.account, opts.owner, opts.repo, parseInt(opts.number));
    });

  github
    .command("pull-merge")
    .description("Merge a pull request")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--number <number>", "PR number")
    .option("--method <method>", "Merge method: merge, squash, rebase", "merge")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handlePullMerge(resolve(), opts.account, opts.owner, opts.repo, parseInt(opts.number), opts.method);
    });

  // --- Notifications ---

  github
    .command("notifications")
    .description("List unread notifications")
    .option("--max-results <n>", "Maximum notifications to return", "30")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleNotifications(resolve(), opts.account, parseInt(opts.maxResults));
    });

  // --- Search ---

  github
    .command("search")
    .description("Search GitHub")
    .requiredOption("--query <query>", "Search query")
    .option("--type <type>", "Search type: repositories, code, issues, users", "repositories")
    .option("--max-results <n>", "Maximum results to return", "30")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleSearch(resolve(), opts.account, opts.query, opts.type, parseInt(opts.maxResults));
    });

  // --- Actions ---

  github
    .command("runs")
    .description("List workflow runs")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .option("--max-results <n>", "Maximum runs to return", "10")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleWorkflowRuns(resolve(), opts.account, opts.owner, opts.repo, parseInt(opts.maxResults));
    });

  github
    .command("run-jobs")
    .description("List jobs for a workflow run")
    .requiredOption("--owner <owner>", "Repository owner")
    .requiredOption("--repo <repo>", "Repository name")
    .requiredOption("--run-id <id>", "Workflow run ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      await handleWorkflowRunLogs(resolve(), opts.account, opts.owner, opts.repo, parseInt(opts.runId));
    });
}
