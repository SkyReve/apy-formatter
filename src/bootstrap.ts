import * as vscode from "vscode";
import { WORKSPACE_STATE_NEVER_KEY_PREFIX } from "./types";
import { pathExists, readTextFile, writeFileUtf8 } from "./utils";
import { generateApyRuntimeStub } from "./apy-runtime-schema";

function getBootstrapFiles(workspaceFolder: vscode.WorkspaceFolder) {
  const pyright = vscode.Uri.joinPath(
    workspaceFolder.uri,
    "pyrightconfig.json",
  );
  const runtime = vscode.Uri.joinPath(workspaceFolder.uri, "apy_runtime.pyi");
  return { pyright, runtime };
}

interface PyrightConfig {
  include?: string[];
  exclude?: string[];
  ignore?: string[];
  executionEnvironments?: { root: string; extraPaths?: string[] }[];
  [key: string]: unknown;
}

const REQUIRED_PYRIGHT_CONFIG: PyrightConfig = {
  include: [".reve/apy"],
  exclude: ["**/.*"],
  ignore: ["**/*.apy"],
  executionEnvironments: [
    {
      root: ".",
      extraPaths: [".reve/apy/libs", "src/libs", "src/apis"],
    },
  ],
};

function mergeArrayUnique(existing: string[] | undefined, required: string[]): string[] {
  const set = new Set(existing ?? []);
  for (const item of required) set.add(item);
  return Array.from(set);
}

function mergePyrightConfig(existing: PyrightConfig): PyrightConfig {
  return {
    ...existing,
    include: mergeArrayUnique(existing.include, REQUIRED_PYRIGHT_CONFIG.include!),
    exclude: mergeArrayUnique(existing.exclude, REQUIRED_PYRIGHT_CONFIG.exclude!),
    ignore: mergeArrayUnique(existing.ignore, REQUIRED_PYRIGHT_CONFIG.ignore!),
    executionEnvironments: existing.executionEnvironments ?? REQUIRED_PYRIGHT_CONFIG.executionEnvironments,
  };
}

function getDefaultPyrightConfig(): string {
  return JSON.stringify(REQUIRED_PYRIGHT_CONFIG, null, 2) + "\n";
}

function isPyrightConfigComplete(config: PyrightConfig): boolean {
  const hasInclude = config.include?.includes(".reve/apy") ?? false;
  const hasExclude = config.exclude?.includes("**/.*") ?? false;
  const hasIgnore = config.ignore?.includes("**/*.apy") ?? false;
  return hasInclude && hasExclude && hasIgnore;
}

async function readPyrightConfig(uri: vscode.Uri): Promise<PyrightConfig | null> {
  const content = await readTextFile(uri);
  if (!content) return null;
  try {
    return JSON.parse(content) as PyrightConfig;
  } catch {
    return null;
  }
}

export async function ensureBootstrapFiles(
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<{ created: string[]; updated: string[] }> {
  const { pyright, runtime } = getBootstrapFiles(workspaceFolder);

  const created: string[] = [];
  const updated: string[] = [];

  // Handle pyrightconfig.json
  const pyrightExists = await pathExists(pyright);
  if (!pyrightExists) {
    await writeFileUtf8(pyright, getDefaultPyrightConfig());
    created.push("pyrightconfig.json");
  } else {
    const existing = await readPyrightConfig(pyright);
    if (existing && !isPyrightConfigComplete(existing)) {
      const merged = mergePyrightConfig(existing);
      await writeFileUtf8(pyright, JSON.stringify(merged, null, 2) + "\n");
      updated.push("pyrightconfig.json");
    }
  }

  // Handle apy_runtime.pyi - always overwrite with latest version
  const runtimeExists = await pathExists(runtime);
  await writeFileUtf8(runtime, generateApyRuntimeStub());
  if (!runtimeExists) {
    created.push("apy_runtime.pyi");
  }

  return { created, updated };
}

export async function ensureApyRuntimeStub(
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<void> {
  const runtime = vscode.Uri.joinPath(workspaceFolder.uri, "apy_runtime.pyi");
  await writeFileUtf8(runtime, generateApyRuntimeStub());
}

function getNeverKey(workspaceFolder: vscode.WorkspaceFolder): string {
  return `${WORKSPACE_STATE_NEVER_KEY_PREFIX}${workspaceFolder.uri.toString()}`;
}

async function shouldPromptBootstrap(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<boolean> {
  const never = context.workspaceState.get<boolean>(
    getNeverKey(workspaceFolder),
    false,
  );
  if (never) return false;

  const mode = vscode.workspace
    .getConfiguration("apy")
    .get<string>("bootstrap.promptMode", "always");
  if (mode === "never") return false;

  return true;
}

async function checkBootstrapNeeds(
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<{ missing: string[]; needsUpdate: string[] }> {
  const { pyright, runtime } = getBootstrapFiles(workspaceFolder);

  const missing: string[] = [];
  const needsUpdate: string[] = [];

  const pyrightExists = await pathExists(pyright);
  if (!pyrightExists) {
    missing.push("pyrightconfig.json");
  } else {
    const existing = await readPyrightConfig(pyright);
    if (existing && !isPyrightConfigComplete(existing)) {
      needsUpdate.push("pyrightconfig.json");
    }
  }

  if (!(await pathExists(runtime))) missing.push("apy_runtime.pyi");

  return { missing, needsUpdate };
}

export async function promptBootstrapIfNeeded(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<void> {
  const { missing, needsUpdate } = await checkBootstrapNeeds(workspaceFolder);
  if (missing.length === 0 && needsUpdate.length === 0) return;

  const mode = vscode.workspace
    .getConfiguration("apy")
    .get<string>("bootstrap.promptMode", "always");
  if (mode === "never") return;

  const ok = await shouldPromptBootstrap(context, workspaceFolder);
  if (!ok) return;

  const hasUpdate = needsUpdate.length > 0;
  const hasMissing = missing.length > 0;

  let message: string;
  if (hasMissing && hasUpdate) {
    message = `APY: Missing ${missing.join(", ")} and ${needsUpdate.join(", ")} needs update. Apply changes?`;
  } else if (hasMissing) {
    message = `APY: Missing ${missing.join(", ")}. Create for better IntelliSense?`;
  } else {
    message = `APY: ${needsUpdate.join(", ")} needs update for diagnostics. Apply changes?`;
  }

  const APPLY = hasMissing && !hasUpdate ? "Create" : "Apply";
  const NOT_NOW = "Not Now";
  const NEVER = "Never";

  const choice = await vscode.window.showWarningMessage(message, APPLY, NOT_NOW, NEVER);

  if (choice === APPLY) {
    const result = await ensureBootstrapFiles(workspaceFolder);
    const actions: string[] = [];
    if (result.created.length > 0) actions.push(`created ${result.created.join(", ")}`);
    if (result.updated.length > 0) actions.push(`updated ${result.updated.join(", ")}`);
    if (actions.length > 0) {
      vscode.window.showInformationMessage(`APY: Successfully ${actions.join(" and ")}.`);
    }
    return;
  }

  if (choice === NEVER) {
    await context.workspaceState.update(getNeverKey(workspaceFolder), true);
    vscode.window.showInformationMessage(
      "APY: This prompt will not appear again for this workspace.",
    );
    return;
  }

  // Not now -> keep prompting later
}
