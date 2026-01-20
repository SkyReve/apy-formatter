import * as vscode from "vscode";
import { isApyFile } from "./utils";
import { getTopLevelLibImports } from "./lib-imports";
import {
  APY_RUNTIME_COMPLETIONS,
  getApyRuntimeSignature,
  APY_RUNTIME_ROOTS,
} from "./apy-runtime-schema";
import {
  extractDottedChainBeforeDot,
  getDottedExpressionAt,
  getTableNameAtPosition,
  resolveTableYamlPath,
  resolveLibModuleOrDirectory,
  listDirectoryChildrenAsModules,
  getModuleIndex,
  findSymbolLocationInFile,
  resolveLibTargetForDotted,
  findCallStart,
  countTopLevelCommas,
  extractParamLabelsFromSignature,
  listTopLevelLibCompletions,
} from "./module-parser";

// -------------------- Completion Provider --------------------

export function createCompletionProvider(): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    { language: "python", scheme: "file" },
    {
      async provideCompletionItems(document, position) {
        if (!isApyFile(document)) return;

        const line = document.lineAt(position.line).text;
        const prefix = line.slice(0, position.character);

        // If not in a "chain." context, offer top-level libs
        const chain = extractDottedChainBeforeDot(prefix);
        if (!chain) {
          return await listTopLevelLibCompletions(document.uri);
        }

        // runtime completions (logger., exceptions., reve., Response.)
        if (APY_RUNTIME_COMPLETIONS[chain]) {
          const items = APY_RUNTIME_COMPLETIONS[chain].map((entry) => {
            const item = new vscode.CompletionItem(entry.label, entry.kind);
            if (entry.detail) item.detail = entry.detail;
            item.sortText = "0_" + entry.label; // keep runtime items near top
            return item;
          });
          return items;
        }

        const parts = chain.split(".");
        if (parts.length === 0) return;

        const topLevelImports = new Set(await getTopLevelLibImports(document.uri));
        if (!topLevelImports.has(parts[0])) return;

        const resolved = await resolveLibModuleOrDirectory(document.uri, parts);
        if (!resolved) return;

        if (resolved.kind === "directory") {
          return await listDirectoryChildrenAsModules(resolved.uri);
        }

        // module: offer top-level symbols with signatures
        const moduleIndex = await getModuleIndex(resolved.uri);
        const items: vscode.CompletionItem[] = [];

        for (const symbol of moduleIndex.topLevel.values()) {
          const name = symbol.name;
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;

          let kind = vscode.CompletionItemKind.Field;
          if (symbol.kind === "function")
            kind = vscode.CompletionItemKind.Function;
          if (symbol.kind === "class") kind = vscode.CompletionItemKind.Class;
          if (symbol.kind === "variable")
            kind = vscode.CompletionItemKind.Variable;

          const item = new vscode.CompletionItem(name, kind);
          item.detail = symbol.signature;
          items.push(item);
        }

        return items;
      },
    },
    ".",
  );
}

// -------------------- Definition Provider --------------------

export function createDefinitionProvider(): vscode.Disposable {
  return vscode.languages.registerDefinitionProvider(
    { language: "python", scheme: "file" },
    {
      async provideDefinition(document, position) {
        if (!isApyFile(document)) return;

        // Handle database["TableName"] pattern -> tables/TableName.yaml
        const tableName = getTableNameAtPosition(document, position);
        if (tableName) {
          const tableYamlUri = await resolveTableYamlPath(
            document.uri,
            tableName,
          );
          if (tableYamlUri) {
            return new vscode.Location(tableYamlUri, new vscode.Position(0, 0));
          }
        }

        const dotted = getDottedExpressionAt(document, position);
        if (!dotted) return;

        const topLevelImports = new Set(await getTopLevelLibImports(document.uri));
        const rootModule = dotted.split(".")[0];

        // Handle libs module references
        if (rootModule && topLevelImports.has(rootModule)) {
          const target = await resolveLibTargetForDotted(document.uri, dotted);
          if (!target) return;

          // module only
          if (!target.member && !target.memberOwnerClass) {
            return new vscode.Location(
              target.moduleUri,
              new vscode.Position(0, 0),
            );
          }

          const moduleIndex = await getModuleIndex(target.moduleUri);

          // module.Class.method
          if (target.memberOwnerClass && target.member) {
            const classMethods = moduleIndex.methodsByClass.get(
              target.memberOwnerClass,
            );
            const symbol = classMethods?.get(target.member);
            if (symbol && symbol.kind === "method") {
              const location = await findSymbolLocationInFile(
                target.moduleUri,
                {
                  kind: "method",
                  name: symbol.name,
                  className: symbol.className,
                },
              );
              if (location) return location;
            }
            return new vscode.Location(
              target.moduleUri,
              new vscode.Position(0, 0),
            );
          }

          // module.member
          if (target.member) {
            const symbol = moduleIndex.topLevel.get(target.member);
            if (symbol && symbol.kind !== "method") {
              const location = await findSymbolLocationInFile(
                target.moduleUri,
                { kind: symbol.kind, name: symbol.name },
              );
              if (location) return location;
            }
            return new vscode.Location(
              target.moduleUri,
              new vscode.Position(0, 0),
            );
          }

          return;
        }

        // Handle same-file symbol references (single identifier, no dots)
        if (!dotted.includes(".")) {
          // Try to find as function
          let location = await findSymbolLocationInFile(document.uri, {
            kind: "function",
            name: dotted,
          });
          if (location) return location;

          // Try to find as class
          location = await findSymbolLocationInFile(document.uri, {
            kind: "class",
            name: dotted,
          });
          if (location) return location;

          // Try to find as variable
          location = await findSymbolLocationInFile(document.uri, {
            kind: "variable",
            name: dotted,
          });
          if (location) return location;
        }

        return;
      },
    },
  );
}

// -------------------- Signature Help Provider --------------------

export function createSignatureHelpProvider(): vscode.Disposable {
  return vscode.languages.registerSignatureHelpProvider(
    { language: "python", scheme: "file" },
    {
      async provideSignatureHelp(document, position) {
        if (!isApyFile(document)) return;

        const line = document.lineAt(position.line).text;
        const prefix = line.slice(0, position.character);

        const call = findCallStart(prefix);
        if (!call) return;

        const expression = call.expression;
        const rootModule = expression.split(".")[0];

        let signatureText: string | null = null;

        // Handle runtime objects (reve, logger, exceptions, Response)
        if (rootModule && APY_RUNTIME_ROOTS.has(rootModule)) {
          signatureText = getApyRuntimeSignature(expression);
        } else {
          // Handle libs modules
          const topLevelImports = new Set(await getTopLevelLibImports(document.uri));
          if (!rootModule || !topLevelImports.has(rootModule)) return;

          const target = await resolveLibTargetForDotted(
            document.uri,
            expression,
          );
          if (!target) return;

          const moduleIndex = await getModuleIndex(target.moduleUri);

          if (target.memberOwnerClass && target.member) {
            signatureText =
              moduleIndex.methodsByClass
                .get(target.memberOwnerClass)
                ?.get(target.member)?.signature ?? null;
          } else if (target.member) {
            const symbol = moduleIndex.topLevel.get(target.member);
            if (symbol && symbol.kind === "function")
              signatureText = symbol.signature;
          }
        }

        if (!signatureText) return;

        const params = extractParamLabelsFromSignature(signatureText);
        const activeParam = Math.min(
          countTopLevelCommas(call.argsText),
          Math.max(0, params.length - 1),
        );

        const signatureInfo = new vscode.SignatureInformation(signatureText);
        signatureInfo.parameters = params.map(
          (param) => new vscode.ParameterInformation(param),
        );

        const help = new vscode.SignatureHelp();
        help.signatures = [signatureInfo];
        help.activeSignature = 0;
        help.activeParameter = activeParam;

        return help;
      },
    },
    "(",
    ",",
  );
}

// -------------------- Hover Provider --------------------

export function createHoverProvider(): vscode.Disposable {
  return vscode.languages.registerHoverProvider(
    { language: "python", scheme: "file" },
    {
      async provideHover(document, position) {
        if (!isApyFile(document)) return;

        const dotted = getDottedExpressionAt(document, position);
        if (!dotted) return;

        const rootModule = dotted.split(".")[0];
        let signatureText: string | null = null;

        // Handle runtime objects (reve, logger, exceptions, Response)
        if (rootModule && APY_RUNTIME_ROOTS.has(rootModule)) {
          signatureText = getApyRuntimeSignature(dotted);
        } else {
          // Handle libs modules
          const topLevelImports = new Set(await getTopLevelLibImports(document.uri));
          if (!rootModule || !topLevelImports.has(rootModule)) return;

          const target = await resolveLibTargetForDotted(document.uri, dotted);
          if (!target) return;

          if (!target.member && !target.memberOwnerClass) return;

          const moduleIndex = await getModuleIndex(target.moduleUri);

          // module.Class.method
          if (target.memberOwnerClass && target.member) {
            signatureText =
              moduleIndex.methodsByClass
                .get(target.memberOwnerClass)
                ?.get(target.member)?.signature ?? null;
          }
          // module.func / module.Class / module.CONST
          else if (target.member) {
            signatureText =
              moduleIndex.topLevel.get(target.member)?.signature ?? null;
          }
        }

        if (!signatureText) return;

        const markdownContent = new vscode.MarkdownString();
        markdownContent.appendCodeblock(signatureText, "python");
        markdownContent.isTrusted = false;

        return new vscode.Hover(markdownContent);
      },
    },
  );
}
