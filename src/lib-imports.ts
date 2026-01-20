import * as vscode from "vscode";
import { autoImportCache } from "./types";
import {
  getWorkspaceFolderForUri,
  pathExists,
  isValidIdentifier,
} from "./utils";

export async function getTopLevelLibImports(
  apyUri: vscode.Uri,
): Promise<string[]> {
  const workspaceFolder = getWorkspaceFolderForUri(apyUri);
  if (!workspaceFolder) return [];

  const cacheKey = workspaceFolder.uri.toString();
  const now = Date.now();
  if (
    autoImportCache.key === cacheKey &&
    now - autoImportCache.lastRefreshMs < 5000
  ) {
    return autoImportCache.imports;
  }

  const libsUri = vscode.Uri.joinPath(workspaceFolder.uri, "src", "libs");

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(libsUri);
  } catch {
    autoImportCache.key = cacheKey;
    autoImportCache.imports = [];
    autoImportCache.lastRefreshMs = now;
    return [];
  }

  const names: string[] = [];
  for (const [name, type] of entries) {
    if (name === "__pycache__") continue;

    if (type === vscode.FileType.Directory) {
      if (!isValidIdentifier(name)) continue;
      if (name.startsWith("_")) continue;
      names.push(name);
      continue;
    }

    if (type === vscode.FileType.File) {
      if (name.endsWith(".py")) {
        const moduleName = name.slice(0, -3);
        if (isValidIdentifier(moduleName) && !moduleName.startsWith("_"))
          names.push(moduleName);
        continue;
      }
      if (name.toLowerCase().endsWith(".apy")) {
        const moduleName = name.slice(0, -4);
        if (isValidIdentifier(moduleName) && !moduleName.startsWith("_"))
          names.push(moduleName);
        continue;
      }
    }
  }

  names.sort((a, b) => a.localeCompare(b));

  autoImportCache.key = cacheKey;
  autoImportCache.imports = names;
  autoImportCache.lastRefreshMs = now;

  return names;
}

async function moduleExistsUnderLibs(
  libsRoot: vscode.Uri,
  modulePath: string,
): Promise<boolean> {
  const parts = modulePath.split(".");
  if (parts.length === 0) return false;

  const lastPart = parts[parts.length - 1];

  const filePy = vscode.Uri.joinPath(
    libsRoot,
    ...parts.slice(0, -1),
    `${lastPart}.py`,
  );
  if (await pathExists(filePy)) return true;

  const fileApy = vscode.Uri.joinPath(
    libsRoot,
    ...parts.slice(0, -1),
    `${lastPart}.apy`,
  );
  if (await pathExists(fileApy)) return true;

  const directoryUri = vscode.Uri.joinPath(libsRoot, ...parts);
  if (await pathExists(directoryUri)) return true;

  return false;
}

export async function computeDeepLibImports(
  apyUri: vscode.Uri,
  apyText: string,
  topLevelImports: string[],
): Promise<string[]> {
  const workspaceFolder = getWorkspaceFolderForUri(apyUri);
  if (!workspaceFolder) return [];

  const libsRoot = vscode.Uri.joinPath(workspaceFolder.uri, "src", "libs");
  if (!(await pathExists(libsRoot))) return [];

  const topLevelSet = new Set(topLevelImports);
  const results = new Set<string>();

  const regex =
    /\b([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){1,10})\b/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(apyText)) !== null) {
    const chain = match[1];
    const parts = chain.split(".");
    if (parts.length < 2) continue;

    const rootModule = parts[0];
    if (!topLevelSet.has(rootModule)) continue;

    let chosenModule: string | null = null;
    for (let k = parts.length; k >= 2; k--) {
      const candidate = parts.slice(0, k).join(".");
      if (await moduleExistsUnderLibs(libsRoot, candidate)) {
        chosenModule = candidate;
        break;
      }
    }

    if (!chosenModule && parts.length >= 3) {
      const candidate = parts.slice(0, parts.length - 1).join(".");
      if (await moduleExistsUnderLibs(libsRoot, candidate))
        chosenModule = candidate;
    }

    if (chosenModule) results.add(chosenModule);
  }

  return Array.from(results).sort((a, b) => a.localeCompare(b));
}
