import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";

export function isApyFile(docOrUri: vscode.TextDocument | vscode.Uri): boolean {
  const uri = "uri" in docOrUri ? docOrUri.uri : docOrUri;
  return uri.scheme === "file" && uri.fsPath.toLowerCase().endsWith(".apy");
}

export async function forcePythonModeIfApy(
  document: vscode.TextDocument,
): Promise<vscode.TextDocument> {
  if (!isApyFile(document)) return document;
  if (document.languageId !== "python") {
    return await vscode.languages.setTextDocumentLanguage(document, "python");
  }
  return document;
}

export function hashUri(uri: vscode.Uri): string {
  return crypto
    .createHash("sha256")
    .update(uri.toString())
    .digest("hex")
    .slice(0, 16);
}

export function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

export function getWorkspaceFolderForUri(
  uri: vscode.Uri,
): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(uri);
}

export async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDirectory(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(uri);
}

export async function writeFileUtf8(
  uri: vscode.Uri,
  content: string,
): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
}

export async function readTextFile(uri: vscode.Uri): Promise<string | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return null;
  }
}

export async function deleteFileIfExists(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.delete(uri, {
      recursive: false,
      useTrash: false,
    });
  } catch {
    // ignore
  }
}

export function getReveApyRoots(workspaceFolder: vscode.WorkspaceFolder) {
  const base = vscode.Uri.joinPath(workspaceFolder.uri, ".reve", "apy");
  const libs = vscode.Uri.joinPath(base, "libs");
  return { base, libs };
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function getRelativePath(root: vscode.Uri, file: vscode.Uri): string {
  return toPosixPath(
    path.posix.normalize(path.posix.relative(root.path, file.path)),
  );
}
