import * as vscode from "vscode";
import { VirtualPythonInfo } from "./types";
import { isApyFile, getWorkspaceFolderForUri } from "./utils";
import { ensureBootstrapFiles } from "./bootstrap";
import { syncLibsApyMirror } from "./libs-mirror";

// -------------------- Commands --------------------

export function createOpenVirtualPythonCommand(
  refreshApyDocument: (document: vscode.TextDocument) => Promise<void>,
  virtualInfoByApyUri: Map<string, VirtualPythonInfo>,
): vscode.Disposable {
  return vscode.commands.registerCommand("apy.openVirtualPython", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    if (!isApyFile(document)) {
      vscode.window.showInformationMessage(
        "APY: Please open an .apy file first.",
      );
      return;
    }

    await refreshApyDocument(document);

    const info = virtualInfoByApyUri.get(document.uri.toString());
    if (!info) return;

    const virtualDocument = await vscode.workspace.openTextDocument(
      info.pyFileUri,
    );
    await vscode.window.showTextDocument(virtualDocument, {
      preview: true,
      preserveFocus: false,
    });
  });
}

export function createInitializeWorkspaceCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "apy.initializeWorkspace",
    async () => {
      const editor = vscode.window.activeTextEditor;
      const uri = editor?.document?.uri;
      const workspaceFolder = uri
        ? getWorkspaceFolderForUri(uri)
        : vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage(
          "APY: Please open a folder or workspace first.",
        );
        return;
      }

      const result = await ensureBootstrapFiles(workspaceFolder);
      if (result.created.length === 0 && result.updated.length === 0) {
        vscode.window.showInformationMessage(
          "APY: Bootstrap files are already up to date.",
        );
      } else {
        const actions: string[] = [];
        if (result.created.length > 0) actions.push(`created ${result.created.join(", ")}`);
        if (result.updated.length > 0) actions.push(`updated ${result.updated.join(", ")}`);
        vscode.window.showInformationMessage(`APY: Successfully ${actions.join(" and ")}.`);
      }

      await syncLibsApyMirror(workspaceFolder);
    },
  );
}
