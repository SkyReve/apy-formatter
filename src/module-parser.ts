import * as vscode from "vscode";
import { ParsedSymbol, ParsedModuleIndex, moduleIndexCache } from "./types";
import {
  getWorkspaceFolderForUri,
  pathExists,
  readTextFile,
  isValidIdentifier,
} from "./utils";
import { getTopLevelLibImports } from "./lib-imports";

// -------------------- Completion + Definition + Signature helpers --------------------

export function extractDottedChainBeforeDot(linePrefix: string): string | null {
  const match = linePrefix.match(
    /([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.$/,
  );
  return match ? match[1] : null;
}

export function getDottedExpressionAt(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | null {
  const line = document.lineAt(position.line).text;
  const isIdentOrDot = (ch: string) => /[A-Za-z0-9_\.]/.test(ch);

  let start = position.character;
  while (start > 0 && isIdentOrDot(line[start - 1])) start--;

  let end = position.character;
  while (end < line.length && isIdentOrDot(line[end])) end++;

  const text = line.slice(start, end).trim();
  if (!text || !/[A-Za-z_]/.test(text)) return null;
  return text;
}

export function getTableNameAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | null {
  const line = document.lineAt(position.line).text;
  const col = position.character;

  // Match patterns like: database["TableName"] or database['TableName']
  // Also match: .database["TableName"] for reve.database["Order"]
  const regex = /\.?database\[["']([A-Za-z_][A-Za-z0-9_]*)["']\]/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const fullMatchStart = match.index;
    const fullMatchEnd = match.index + match[0].length;

    // Check if cursor is within the match
    if (col >= fullMatchStart && col < fullMatchEnd) {
      return match[1]; // Return the captured table name
    }
  }

  return null;
}

export async function resolveTableYamlPath(
  apyUri: vscode.Uri,
  tableName: string,
): Promise<vscode.Uri | null> {
  const workspaceFolder = getWorkspaceFolderForUri(apyUri);
  if (!workspaceFolder) return null;

  // Tables are stored in src/tables/{TableName}.yaml
  const tableYamlPath = vscode.Uri.joinPath(
    workspaceFolder.uri,
    "src",
    "tables",
    `${tableName}.yaml`,
  );

  if (await pathExists(tableYamlPath)) {
    return tableYamlPath;
  }

  return null;
}

export async function resolveLibModuleOrDirectory(
  apyUri: vscode.Uri,
  parts: string[],
): Promise<
  | { kind: "directory"; uri: vscode.Uri }
  | { kind: "module"; uri: vscode.Uri; ext: ".py" | ".apy" }
  | null
> {
  const workspaceFolder = getWorkspaceFolderForUri(apyUri);
  if (!workspaceFolder) return null;

  const libsRoot = vscode.Uri.joinPath(workspaceFolder.uri, "src", "libs");
  if (!(await pathExists(libsRoot))) return null;

  const directoryUri = vscode.Uri.joinPath(libsRoot, ...parts);
  if (await pathExists(directoryUri))
    return { kind: "directory", uri: directoryUri };

  if (parts.length === 0) return null;

  const lastPart = parts[parts.length - 1];
  const parentDirectory = vscode.Uri.joinPath(libsRoot, ...parts.slice(0, -1));

  const pyFile = vscode.Uri.joinPath(parentDirectory, `${lastPart}.py`);
  if (await pathExists(pyFile))
    return { kind: "module", uri: pyFile, ext: ".py" };

  const apyFile = vscode.Uri.joinPath(parentDirectory, `${lastPart}.apy`);
  if (await pathExists(apyFile))
    return { kind: "module", uri: apyFile, ext: ".apy" };

  return null;
}

export async function listDirectoryChildrenAsModules(
  directoryUri: vscode.Uri,
): Promise<vscode.CompletionItem[]> {
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(directoryUri);
  } catch {
    return [];
  }

  const items: vscode.CompletionItem[] = [];
  for (const [name, type] of entries) {
    if (name === "__pycache__") continue;
    if (name.startsWith("_")) continue;

    if (type === vscode.FileType.Directory) {
      if (!isValidIdentifier(name)) continue;
      const item = new vscode.CompletionItem(
        name,
        vscode.CompletionItemKind.Module,
      );
      item.detail = "(package)";
      items.push(item);
      continue;
    }

    if (type === vscode.FileType.File) {
      if (name.endsWith(".py")) {
        const moduleName = name.slice(0, -3);
        if (!isValidIdentifier(moduleName) || moduleName.startsWith("_"))
          continue;
        const item = new vscode.CompletionItem(
          moduleName,
          vscode.CompletionItemKind.Module,
        );
        item.detail = "(module)";
        items.push(item);
        continue;
      }
      if (name.toLowerCase().endsWith(".apy")) {
        const moduleName = name.slice(0, -4);
        if (!isValidIdentifier(moduleName) || moduleName.startsWith("_"))
          continue;
        const item = new vscode.CompletionItem(
          moduleName,
          vscode.CompletionItemKind.Module,
        );
        item.detail = "(module)";
        items.push(item);
        continue;
      }
    }
  }

  items.sort((a, b) => (a.label.toString() < b.label.toString() ? -1 : 1));
  return items;
}

function collectMultilineDef(
  lines: string[],
  lineIndex: number,
): { combined: string; linesConsumed: number } | null {
  const firstLine = lines[lineIndex];
  const trimmed = firstLine.trimStart();

  // Check if this looks like a function definition start
  const defMatch = trimmed.match(/^(async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (!defMatch) return null;

  // Count parentheses to find where the signature ends
  let parenDepth = 0;
  let combined = "";
  let linesConsumed = 0;

  for (let j = lineIndex; j < lines.length; j++) {
    const currentLine = lines[j];
    combined += (j > lineIndex ? " " : "") + currentLine.trim();
    linesConsumed++;

    for (const char of currentLine) {
      if (char === "(") parenDepth++;
      else if (char === ")") parenDepth--;
    }

    // Check if we've found the closing `:` after balanced parens
    if (parenDepth === 0 && combined.includes("):")) {
      return { combined, linesConsumed };
    }
    if (parenDepth === 0 && combined.match(/\)\s*->\s*[^:]+:/)) {
      return { combined, linesConsumed };
    }

    // Safety: don't consume too many lines
    if (linesConsumed > 20) break;
  }

  return null;
}

function parseFunctionDef(
  defString: string,
): { isAsync: boolean; name: string; params: string; returnType: string } | null {
  // Normalize whitespace
  const normalized = defString.replace(/\s+/g, " ").trim();

  const match = normalized.match(
    /^(async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*(?:->\s*([^:]+))?\s*:/,
  );
  if (!match) return null;

  return {
    isAsync: !!match[1],
    name: match[2],
    params: (match[3] ?? "").trim(),
    returnType: (match[4] ?? "").trim(),
  };
}

function parseModuleIndex(text: string): ParsedModuleIndex {
  const lines = text.split(/\r?\n/);

  const topLevel = new Map<string, ParsedSymbol>();
  const methodsByClass = new Map<string, Map<string, ParsedSymbol>>();

  const isTopLevel = (line: string) => line.length > 0 && !/^\s/.test(line);
  const getIndent = (line: string) =>
    line.length - line.replace(/^\s+/, "").length;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) continue;
    if (!isTopLevel(rawLine)) continue;
    if (line.trimStart().startsWith("#")) continue;

    // Try to parse function definition (single or multiline)
    const trimmedLine = line.trimStart();
    if (trimmedLine.startsWith("def ") || trimmedLine.startsWith("async def ")) {
      const collected = collectMultilineDef(lines, i);
      if (collected) {
        const parsed = parseFunctionDef(collected.combined);
        if (parsed) {
          const prefix = parsed.isAsync ? "async def" : "def";
          const signature = `${prefix} ${parsed.name}(${parsed.params})${parsed.returnType ? ` -> ${parsed.returnType}` : ""}`;
          topLevel.set(parsed.name, { kind: "function", name: parsed.name, signature });
          i += collected.linesConsumed - 1; // Skip consumed lines
          continue;
        }
      }
    }

    // Try class definition
    const classMatch = line.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\((.*)\))?\s*:/);
    if (classMatch) {
      const className = classMatch[1];
      const bases = (classMatch[3] ?? "").trim();
      const signature = `class ${className}${bases ? `(${bases})` : ""}`;
      topLevel.set(className, { kind: "class", name: className, signature });

      const classIndent = 0;
      const bodyIndent = 4;
      const methodMap = new Map<string, ParsedSymbol>();

      for (let j = i + 1; j < lines.length; j++) {
        const rawLine2 = lines[j];
        const line2 = rawLine2.trimEnd();
        if (line2.trim().length === 0) continue;
        if (line2.trimStart().startsWith("#")) continue;

        if (isTopLevel(rawLine2) && getIndent(rawLine2) === classIndent) break;

        const indent = getIndent(rawLine2);
        if (indent < bodyIndent) continue;

        const trimmedLine2 = line2.trimStart();

        // Try to parse method definition (single or multiline)
        if (trimmedLine2.startsWith("def ") || trimmedLine2.startsWith("async def ")) {
          const collected = collectMultilineDef(lines, j);
          if (collected) {
            const parsed = parseFunctionDef(collected.combined);
            if (parsed) {
              const prefix = parsed.isAsync ? "async def" : "def";
              const methodSignature = `${prefix} ${className}.${parsed.name}(${parsed.params})${parsed.returnType ? ` -> ${parsed.returnType}` : ""}`;
              methodMap.set(parsed.name, {
                kind: "method",
                className,
                name: parsed.name,
                signature: methodSignature,
              });
              j += collected.linesConsumed - 1; // Skip consumed lines
              continue;
            }
          }
        }
      }

      if (methodMap.size > 0) methodsByClass.set(className, methodMap);
      continue;
    }

    // Try variable assignment
    const varMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (varMatch) {
      const name = varMatch[1];
      topLevel.set(name, {
        kind: "variable",
        name,
        signature: `${name} = ...`,
      });
      continue;
    }
  }

  return { topLevel, methodsByClass };
}

export async function getModuleIndex(
  moduleUri: vscode.Uri,
): Promise<ParsedModuleIndex> {
  const key = moduleUri.toString();
  const now = Date.now();
  const cached = moduleIndexCache.get(key);
  if (cached && now - cached.ts < 3000) return cached.index;

  const text = await readTextFile(moduleUri);
  const index = text
    ? parseModuleIndex(text)
    : { topLevel: new Map(), methodsByClass: new Map() };

  moduleIndexCache.set(key, { ts: now, index });
  return index;
}

export async function findSymbolLocationInFile(
  uri: vscode.Uri,
  symbol: {
    kind: "function" | "class" | "variable" | "method";
    name: string;
    className?: string;
  },
): Promise<vscode.Location | null> {
  const text = await readTextFile(uri);
  if (text == null) return null;

  const lines = text.split(/\r?\n/);

  if (symbol.kind === "method" && symbol.className) {
    const className = symbol.className;
    const methodName = symbol.name;

    const classRegex = new RegExp(`^class\\s+${className}\\b`);
    let classLineNumber = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s/.test(line)) continue;
      if (classRegex.test(line.trimEnd())) {
        classLineNumber = i;
        break;
      }
    }
    if (classLineNumber === -1) return null;

    for (let j = classLineNumber + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim().length === 0) continue;

      if (!/^\s/.test(line)) break;

      const trimmedLine = line.trimStart().trimEnd();
      if (
        new RegExp(`^(async\\s+)?def\\s+${methodName}\\s*\\(`).test(trimmedLine)
      ) {
        return new vscode.Location(uri, new vscode.Position(j, 0));
      }
    }

    return new vscode.Location(uri, new vscode.Position(classLineNumber, 0));
  }

  const patterns = [
    symbol.kind === "function"
      ? new RegExp(`^def\\s+${symbol.name}\\s*\\(`)
      : null,
    symbol.kind === "function"
      ? new RegExp(`^async\\s+def\\s+${symbol.name}\\s*\\(`)
      : null,
    symbol.kind === "class" ? new RegExp(`^class\\s+${symbol.name}\\b`) : null,
    symbol.kind === "variable" ? new RegExp(`^${symbol.name}\\s*=`) : null,
  ].filter(Boolean) as RegExp[];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s/.test(line)) continue;
    const trimmedLine = line.trimEnd();
    for (const pattern of patterns) {
      if (pattern.test(trimmedLine))
        return new vscode.Location(uri, new vscode.Position(i, 0));
    }
  }

  return null;
}

export async function resolveLibTargetForDotted(
  apyUri: vscode.Uri,
  dotted: string,
): Promise<{
  moduleUri: vscode.Uri;
  member?: string;
  memberOwnerClass?: string;
} | null> {
  const parts = dotted.split(".").filter(Boolean);
  if (parts.length === 0) return null;

  for (let k = parts.length; k >= 1; k--) {
    const head = parts.slice(0, k);
    const tail = parts.slice(k);

    const resolved = await resolveLibModuleOrDirectory(apyUri, head);
    if (!resolved) continue;
    if (resolved.kind === "directory") return null;

    if (tail.length === 0) return { moduleUri: resolved.uri };

    if (tail.length >= 2) {
      return {
        moduleUri: resolved.uri,
        memberOwnerClass: tail[0],
        member: tail[1],
      };
    }
    return { moduleUri: resolved.uri, member: tail[0] };
  }

  return null;
}

// Signature help helpers

function isAtTopLevel(
  parenDepth: number,
  bracketDepth: number,
  braceDepth: number,
): boolean {
  return parenDepth === 0 && bracketDepth === 0 && braceDepth === 0;
}

function updateBracketDepth(
  char: string,
  depths: { paren: number; bracket: number; brace: number },
): void {
  if (char === "(") depths.paren++;
  else if (char === ")") depths.paren = Math.max(0, depths.paren - 1);
  else if (char === "[") depths.bracket++;
  else if (char === "]") depths.bracket = Math.max(0, depths.bracket - 1);
  else if (char === "{") depths.brace++;
  else if (char === "}") depths.brace = Math.max(0, depths.brace - 1);
}

export function findCallStart(
  linePrefix: string,
): { expression: string; argsText: string } | null {
  let depth = 0;
  for (let i = linePrefix.length - 1; i >= 0; i--) {
    const char = linePrefix[i];
    if (char === ")") depth++;
    else if (char === "(") {
      if (depth === 0) {
        const before = linePrefix.slice(0, i);
        const after = linePrefix.slice(i + 1);
        const match = before.match(
          /([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*$/,
        );
        if (!match) return null;
        return { expression: match[1], argsText: after };
      }
      depth--;
    }
  }
  return null;
}

export function countTopLevelCommas(text: string): number {
  const depths = { paren: 0, bracket: 0, brace: 0 };
  let commas = 0;

  for (const char of text) {
    updateBracketDepth(char, depths);
    if (char === "," && isAtTopLevel(depths.paren, depths.bracket, depths.brace)) {
      commas++;
    }
  }
  return commas;
}

export function extractParamLabelsFromSignature(signature: string): string[] {
  const match = signature.match(/\((.*)\)/);
  if (!match) return [];
  const inside = match[1].trim();
  if (!inside) return [];

  const result: string[] = [];
  let buffer = "";
  const depths = { paren: 0, bracket: 0, brace: 0 };

  for (const char of inside) {
    updateBracketDepth(char, depths);

    if (char === "," && isAtTopLevel(depths.paren, depths.bracket, depths.brace)) {
      const param = buffer.trim();
      if (param) result.push(param);
      buffer = "";
      continue;
    }
    buffer += char;
  }

  const lastParam = buffer.trim();
  if (lastParam) result.push(lastParam);
  return result;
}

export async function listTopLevelLibCompletions(
  apyUri: vscode.Uri,
): Promise<vscode.CompletionItem[]> {
  const modules = await getTopLevelLibImports(apyUri);
  const items: vscode.CompletionItem[] = [];

  for (const moduleName of modules) {
    const item = new vscode.CompletionItem(
      moduleName,
      vscode.CompletionItemKind.Module,
    );
    item.detail = "(module)";
    items.push(item);
  }

  return items;
}
