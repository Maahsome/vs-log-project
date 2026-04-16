const vscode = require("vscode");
const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "obsidianWorkspaceLog.captureStatus",
    async () => {
      const folder = getTargetWorkspaceFolder();
      if (!folder) {
        vscode.window.showErrorMessage("Open a workspace folder before creating an Obsidian log note.");
        return;
      }

      try {
        const folderPath = folder.uri.fsPath;
        const folderName = path.basename(folderPath);
        const dateStamp = formatDate(new Date());
        const branchName = await getGitBranchName(folderPath);
        const config = vscode.workspace.getConfiguration("obsidianWorkspaceLog");
        const vaultPath = await resolveVaultPath(folderPath, config.get("vaultPath", ""));
        const notesFolder = config.get("notesFolder", "VSCode").trim();
        const noteNameParts = [dateStamp, folderName];

        if (branchName) {
          noteNameParts.push(branchName);
        }

        const noteFileName = `${noteNameParts.map(sanitizeFileNamePart).join(" ")}.md`;
        const timestamp = formatTimestamp(new Date());
        const gitStatus = await getGitStatus(folderPath);
        const entry = buildEntry(timestamp, folderPath, gitStatus);
        const directoryParts = buildNoteDirectoryParts(new Date());
        const relativeNotePath = notesFolder
          ? path.posix.join(toPosixPath(notesFolder), ...directoryParts, noteFileName)
          : path.posix.join(...directoryParts, noteFileName);
        const notePath = path.join(vaultPath, ...relativeNotePath.split("/"));
        const existed = await pathExists(notePath);

        await fs.mkdir(path.dirname(notePath), { recursive: true });
        if (existed) {
          await fs.appendFile(notePath, `\n\n${entry}`, "utf8");
        } else {
          await fs.writeFile(notePath, `${entry}\n`, "utf8");
        }

        const action = existed ? "Updated" : "Created";
        vscode.window.showInformationMessage(
          `${action} Obsidian note: ${relativeNotePath}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Could not create Obsidian note: ${message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}

async function resolveVaultPath(workspaceFolderPath, configuredVaultPath) {
  const trimmedConfiguredPath = configuredVaultPath.trim();
  if (trimmedConfiguredPath) {
    const normalizedConfiguredPath = path.resolve(trimmedConfiguredPath);
    const obsidianConfigPath = path.join(normalizedConfiguredPath, ".obsidian");
    if (!(await pathExists(obsidianConfigPath))) {
      throw new Error(`Configured vault path does not contain .obsidian: ${normalizedConfiguredPath}`);
    }
    return normalizedConfiguredPath;
  }

  let currentPath = workspaceFolderPath;
  while (true) {
    if (await pathExists(path.join(currentPath, ".obsidian"))) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }

  throw new Error(
    'Set "obsidianWorkspaceLog.vaultPath" to your vault root, or open a workspace inside an Obsidian vault.'
  );
}

function getTargetWorkspaceFolder() {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    if (activeFolder) {
      return activeFolder;
    }
  }

  return vscode.workspace.workspaceFolders?.[0];
}

async function getGitBranchName(cwd) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"], {
      cwd
    });
    const branch = stdout.trim();
    if (!branch || branch === "HEAD") {
      return null;
    }
    return branch;
  } catch {
    return null;
  }
}

async function getGitStatus(cwd) {
  try {
    const { stdout, stderr } = await execFileAsync("git", ["-C", cwd, "status"], { cwd });
    return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  } catch (error) {
    if (error && typeof error === "object") {
      const stdout = typeof error.stdout === "string" ? error.stdout.trim() : "";
      const stderr = typeof error.stderr === "string" ? error.stderr.trim() : "";
      const combined = [stdout, stderr].filter(Boolean).join("\n");
      if (combined) {
        return combined;
      }
    }

    return "Git status unavailable.";
  }
}

function buildEntry(timestamp, folderPath, gitStatus) {
  return `## ${timestamp}\n\n- Path: \`${folderPath}\`\n\n\`\`\`text\n${gitStatus || "Git status unavailable."}\n\`\`\``;
}

function buildNoteDirectoryParts(date) {
  const year = String(date.getFullYear());
  const monthNumber = String(date.getMonth() + 1).padStart(2, "0");
  const monthName = date.toLocaleString("en-US", { month: "long" });
  const weekOfYear = getWeekOfYear(date);
  return [year, `${monthNumber}-${monthName}`, toOrdinal(weekOfYear)];
}

function getWeekOfYear(date) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const daysSinceStartOfYear = Math.floor((startOfDay - startOfYear) / millisecondsPerDay);
  return Math.floor(daysSinceStartOfYear / 7) + 1;
}

function toOrdinal(value) {
  const remainderTen = value % 10;
  const remainderHundred = value % 100;

  if (remainderTen === 1 && remainderHundred !== 11) {
    return `${value}st`;
  }

  if (remainderTen === 2 && remainderHundred !== 12) {
    return `${value}nd`;
  }

  if (remainderTen === 3 && remainderHundred !== 13) {
    return `${value}rd`;
  }

  return `${value}th`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function formatDate(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestamp(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function sanitizeFileNamePart(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").trim();
}

function toPosixPath(value) {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

module.exports = {
  activate,
  deactivate
};
