import * as vscode from "vscode";

export const DEFAULT_INDENT = "    ";
export const WORKSPACE_STATE_NEVER_KEY_PREFIX = "apy.bootstrap.never::";

export type VirtualPythonInfo = {
  apyUri: vscode.Uri;
  pyFileUri: vscode.Uri;
  prefixLineCount: number;
  indentSize: number;
};

export type ParsedSymbol =
  | { kind: "function"; name: string; signature: string }
  | { kind: "class"; name: string; signature: string }
  | { kind: "variable"; name: string; signature: string }
  | { kind: "method"; className: string; name: string; signature: string };

export type ParsedModuleIndex = {
  topLevel: Map<string, ParsedSymbol>;
  methodsByClass: Map<string, Map<string, ParsedSymbol>>;
};

export type ModuleIndexCacheEntry = { ts: number; index: ParsedModuleIndex };

export type AutoImportCache = {
  key: string;
  imports: string[];
  lastRefreshMs: number;
};

export const moduleIndexCache = new Map<string, ModuleIndexCacheEntry>();

export const autoImportCache: AutoImportCache = {
  key: "",
  imports: [],
  lastRefreshMs: 0,
};
