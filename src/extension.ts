import * as vscode from "vscode";
import { moveCommandIds } from "./commands/move";
import { Configuration } from "./configuration/configuration";
import { EmacsEmulator } from "./emulator";
import { EmacsEmulatorMap } from "./emulator-map";
import { executeCommands } from "./execute-commands";
import { KillRing } from "./kill-yank/kill-ring";
import { logger } from "./logger";
import { MessageManager } from "./message";
import { InputBoxMinibuffer } from "./minibuffer";

export function activate(context: vscode.ExtensionContext): void {
  MessageManager.registerDispose(context);
  Configuration.registerDispose(context);

  const killRing = new KillRing(Configuration.instance.killRingMax);
  const minibuffer = new InputBoxMinibuffer();

  const emulatorMap = new EmacsEmulatorMap(killRing, minibuffer);

  function getAndUpdateEmulator() {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (typeof activeTextEditor === "undefined") {
      return undefined;
    }

    const [curEmulator, isNew] = emulatorMap.getOrCreate(activeTextEditor);
    if (isNew) {
      context.subscriptions.push(curEmulator);
    }

    return curEmulator;
  }

  vscode.workspace.onDidCloseTextDocument(() => {
    const documents = vscode.workspace.textDocuments;

    // Delete emulators once all tabs of this document have been closed
    for (const key of emulatorMap.getKeys()) {
      const emulator = emulatorMap.get(key);
      if (
        emulator === undefined ||
        emulator.getTextEditor() === undefined ||
        documents.indexOf(emulator.getTextEditor().document) === -1
      ) {
        emulatorMap.delete(key);
      }
    }
  });

  function registerEmulatorCommand(
    commandName: string,
    callback: (emulator: EmacsEmulator, ...args: any[]) => any,
    onNoEmulator?: (...args: any[]) => any
  ) {
    const disposable = vscode.commands.registerCommand(commandName, (...args) => {
      logger.debug(`[command]\t Command "${commandName}" executed with args (${args})`);

      const emulator = getAndUpdateEmulator();
      if (!emulator) {
        if (typeof onNoEmulator === "function") {
          return onNoEmulator(...args);
        }
        return;
      }

      return callback(emulator, ...args);
    });
    context.subscriptions.push(disposable);
  }

  if (Configuration.instance.enableOverridingTypeCommand) {
    registerEmulatorCommand(
      "type",
      (emulator, args) => {
        // Capture typing characters for prefix argument functionality.
        logger.debug(`[type command]\t args.text = "${args.text}"`);

        return emulator.type(args.text);
      },
      (args) => vscode.commands.executeCommand("default:type", args)
    );
  }

  registerEmulatorCommand("emacs-mcx.universalArgumentDigit", (emulator, args) => {
    const arg = args[0];
    if (typeof arg !== "number") {
      return;
    }
    emulator.universalArgumentDigit(arg);
  });

  registerEmulatorCommand("emacs-mcx.typeChar", (emulator, args) => {
    const arg = args[0];
    if (typeof arg !== "string") {
      return;
    }
    emulator.typeChar(arg);
  });

  moveCommandIds.map((commandName) => {
    registerEmulatorCommand(`emacs-mcx.${commandName}`, (emulator) => {
      emulator.runCommand(commandName);
    });
  });

  registerEmulatorCommand("emacs-mcx.isearchForward", (emulator) => {
    emulator.runCommand("isearchForward");
  });

  registerEmulatorCommand("emacs-mcx.isearchBackward", (emulator) => {
    emulator.runCommand("isearchBackward");
  });

  registerEmulatorCommand("emacs-mcx.isearchAbort", (emulator) => {
    emulator.runCommand("isearchAbort");
  });

  registerEmulatorCommand("emacs-mcx.isearchExit", (emulator, args) => {
    emulator.runCommand("isearchExit").then(() => {
      const secondCommand = args.then;

      if (typeof secondCommand === "string") {
        return vscode.commands.executeCommand(secondCommand);
      }
    });
  });

  registerEmulatorCommand("emacs-mcx.deleteBackwardChar", (emulator) => {
    emulator.runCommand("deleteBackwardChar");
  });

  registerEmulatorCommand("emacs-mcx.deleteForwardChar", (emulator) => {
    emulator.runCommand("deleteForwardChar");
  });

  registerEmulatorCommand("emacs-mcx.universalArgument", (emulator) => {
    emulator.universalArgument();
  });

  registerEmulatorCommand("emacs-mcx.killLine", (emulator) => {
    return emulator.runCommand("killLine");
  });

  registerEmulatorCommand("emacs-mcx.killWord", (emulator) => {
    return emulator.runCommand("killWord");
  });

  registerEmulatorCommand("emacs-mcx.backwardKillWord", (emulator) => {
    return emulator.runCommand("backwardKillWord");
  });

  registerEmulatorCommand("emacs-mcx.killWholeLine", (emulator) => {
    return emulator.runCommand("killWholeLine");
  });

  registerEmulatorCommand("emacs-mcx.killRegion", (emulator) => {
    return emulator.runCommand("killRegion");
  });

  registerEmulatorCommand("emacs-mcx.copyRegion", (emulator) => {
    return emulator.runCommand("copyRegion");
  });

  registerEmulatorCommand("emacs-mcx.yank", (emulator) => {
    return emulator.runCommand("yank");
  });

  registerEmulatorCommand("emacs-mcx.yank-pop", (emulator) => {
    return emulator.runCommand("yankPop");
  });

  registerEmulatorCommand("emacs-mcx.startRectCommand", (emulator) => {
    return emulator.runCommand("startAcceptingRectCommand");
  });

  registerEmulatorCommand("emacs-mcx.killRectangle", (emulator) => {
    return emulator.runCommand("killRectangle");
  });

  registerEmulatorCommand("emacs-mcx.copyRectangleAsKill", (emulator) => {
    return emulator.runCommand("copyRectangleAsKill");
  });

  registerEmulatorCommand("emacs-mcx.deleteRectangle", (emulator) => {
    return emulator.runCommand("deleteRectangle");
  });

  registerEmulatorCommand("emacs-mcx.yankRectangle", (emulator) => {
    return emulator.runCommand("yankRectangle");
  });

  registerEmulatorCommand("emacs-mcx.openRectangle", (emulator) => {
    return emulator.runCommand("openRectangle");
  });

  registerEmulatorCommand("emacs-mcx.clearRectangle", (emulator) => {
    return emulator.runCommand("clearRectangle");
  });

  registerEmulatorCommand("emacs-mcx.stringRectangle", (emulator) => {
    return emulator.runCommand("stringRectangle");
  });

  registerEmulatorCommand("emacs-mcx.replaceKillRingToRectangle", (emulator) => {
    return emulator.runCommand("replaceKillRingToRectangle");
  });

  registerEmulatorCommand("emacs-mcx.setMarkCommand", (emulator) => {
    emulator.setMarkCommand();
  });

  registerEmulatorCommand("emacs-mcx.rectangleMarkMode", (emulator) => {
    emulator.rectangleMarkMode();
  });

  registerEmulatorCommand("emacs-mcx.popMark", (emulator) => {
    emulator.popMark();
  });

  registerEmulatorCommand("emacs-mcx.exchangePointAndMark", (emulator) => {
    emulator.exchangePointAndMark();
  });

  registerEmulatorCommand("emacs-mcx.addSelectionToNextFindMatch", (emulator) => {
    emulator.runCommand("addSelectionToNextFindMatch");
  });

  registerEmulatorCommand("emacs-mcx.addSelectionToPreviousFindMatch", (emulator) => {
    emulator.runCommand("addSelectionToPreviousFindMatch");
  });

  registerEmulatorCommand("emacs-mcx.cancel", (emulator) => {
    emulator.cancel();
  });

  registerEmulatorCommand("emacs-mcx.newLine", (emulator) => {
    emulator.runCommand("newLine");
  });

  registerEmulatorCommand("emacs-mcx.transformToUppercase", (emulator) => {
    emulator.runCommand("transformToUppercase");
  });

  registerEmulatorCommand("emacs-mcx.transformToLowercase", (emulator) => {
    emulator.runCommand("transformToLowercase");
  });

  registerEmulatorCommand("emacs-mcx.transformToTitlecase", (emulator) => {
    emulator.runCommand("transformToTitlecase");
  });

  registerEmulatorCommand("emacs-mcx.deleteBlankLines", (emulator) => {
    emulator.runCommand("deleteBlankLines");
  });

  registerEmulatorCommand("emacs-mcx.recenterTopBottom", (emulator) => {
    emulator.runCommand("recenterTopBottom");
  });

  registerEmulatorCommand("emacs-mcx.paredit.forwardSexp", (emulator) => {
    emulator.runCommand("paredit.forwardSexp");
  });

  registerEmulatorCommand("emacs-mcx.paredit.forwardDownSexp", (emulator) => {
    emulator.runCommand("paredit.forwardDownSexp");
  });

  registerEmulatorCommand("emacs-mcx.paredit.backwardSexp", (emulator) => {
    emulator.runCommand("paredit.backwardSexp");
  });

  registerEmulatorCommand("emacs-mcx.paredit.backwardUpSexp", (emulator) => {
    emulator.runCommand("paredit.backwardUpSexp");
  });

  registerEmulatorCommand("emacs-mcx.paredit.killSexp", (emulator) => {
    emulator.runCommand("paredit.killSexp");
  });

  vscode.commands.registerCommand("emacs-mcx.executeCommands", async (...args: any[]) => {
    if (1 <= args.length) {
      executeCommands(args[0]);
    }
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
  return;
}
