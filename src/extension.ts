import * as vscode from "vscode";
import {
  DEFAULT_INDENT,
  VirtualPythonInfo,
  autoImportCache,
  moduleIndexCache,
} from "./types";
import {
  isApyFile,
  forcePythonModeIfApy,
  getWorkspaceFolderForUri,
} from "./utils";
import { promptBootstrapIfNeeded, ensureApyRuntimeStub } from "./bootstrap";
import { syncLibsApyMirror } from "./libs-mirror";
import {
  buildVirtualPython,
  writeVirtualPyFile,
  ensureDocumentAnalyzed,
  isApyRuntimeNoiseDiagnostic,
  mapDiagnosticsToApy,
} from "./virtual-python";
import {
  createCompletionProvider,
  createDefinitionProvider,
  createSignatureHelpProvider,
  createHoverProvider,
} from "./providers";
import {
  createOpenVirtualPythonCommand,
  createInitializeWorkspaceCommand,
} from "./commands";

// -------------------- activate --------------------

export function activate(context: vscode.ExtensionContext): void {
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("apy");
  context.subscriptions.push(diagnosticCollection);

  const virtualInfoByApyUri = new Map<string, VirtualPythonInfo>();

  async function ensureLibsMirror(
    workspaceFolder: vscode.WorkspaceFolder,
  ): Promise<void> {
    await syncLibsApyMirror(workspaceFolder);
  }

  async function refreshApyDocument(
    document: vscode.TextDocument,
  ): Promise<void> {
    if (!isApyFile(document)) return;

    const workspaceFolder = getWorkspaceFolderForUri(document.uri);
    if (workspaceFolder) {
      await promptBootstrapIfNeeded(context, workspaceFolder);
      await ensureLibsMirror(workspaceFolder);
    }

    document = await forcePythonModeIfApy(document);

    const { text, prefixLineCount } = await buildVirtualPython(
      document.uri,
      document.getText(),
    );
    const pyFileUri = await writeVirtualPyFile(document.uri, text);

    const info: VirtualPythonInfo = {
      apyUri: document.uri,
      pyFileUri,
      prefixLineCount,
      indentSize: DEFAULT_INDENT.length,
    };
    virtualInfoByApyUri.set(document.uri.toString(), info);

    await ensureDocumentAnalyzed(pyFileUri);

    const virtualDiagnostics = vscode.languages
      .getDiagnostics(pyFileUri)
      .filter((diagnostic) => !isApyRuntimeNoiseDiagnostic(diagnostic));
    diagnosticCollection.set(
      document.uri,
      mapDiagnosticsToApy(virtualDiagnostics, info),
    );
  }

  (async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const workspaceFolder of folders) {
      const apyFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, "**/*.apy"),
        "**/.reve/**",
        1,
      );
      if (apyFiles.length > 0) {
        await promptBootstrapIfNeeded(context, workspaceFolder);
        await ensureApyRuntimeStub(workspaceFolder);
        await ensureLibsMirror(workspaceFolder);
      }
    }
  })();

  const libsApyWatcher = vscode.workspace.createFileSystemWatcher(
    "**/src/libs/**/*.apy",
  );
  context.subscriptions.push(libsApyWatcher);

  const onLibsChanged = async (uri?: vscode.Uri) => {
    const workspaceFolder = uri
      ? getWorkspaceFolderForUri(uri)
      : vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) await ensureLibsMirror(workspaceFolder);

    autoImportCache.key = "";
    autoImportCache.imports = [];
    autoImportCache.lastRefreshMs = 0;

    moduleIndexCache.clear();

    for (const document of vscode.workspace.textDocuments) {
      if (isApyFile(document)) void refreshApyDocument(document);
    }
  };

  libsApyWatcher.onDidCreate(onLibsChanged);
  libsApyWatcher.onDidChange(onLibsChanged);
  libsApyWatcher.onDidDelete(onLibsChanged);

  for (const document of vscode.workspace.textDocuments) {
    void refreshApyDocument(document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      void refreshApyDocument(document);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      void refreshApyDocument(event.document);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      void refreshApyDocument(document);
    }),
  );

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((event) => {
      const touchedUris = new Set(event.uris.map((uri) => uri.toString()));
      for (const [, info] of virtualInfoByApyUri) {
        if (!touchedUris.has(info.pyFileUri.toString())) continue;

        const virtualDiagnostics = vscode.languages
          .getDiagnostics(info.pyFileUri)
          .filter((diagnostic) => !isApyRuntimeNoiseDiagnostic(diagnostic));
        diagnosticCollection.set(
          info.apyUri,
          mapDiagnosticsToApy(virtualDiagnostics, info),
        );
      }
    }),
  );

  // Register providers
  context.subscriptions.push(createCompletionProvider());
  context.subscriptions.push(createDefinitionProvider());
  context.subscriptions.push(createSignatureHelpProvider());
  context.subscriptions.push(createHoverProvider());

  // Register commands
  context.subscriptions.push(
    createOpenVirtualPythonCommand(refreshApyDocument, virtualInfoByApyUri),
  );
  context.subscriptions.push(createInitializeWorkspaceCommand());
}

export function deactivate(): void {}
