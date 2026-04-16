# Obsidian Workspace Log

This VS Code extension creates or updates a Markdown note directly in your Obsidian vault.

Default behavior:

- Trigger the command with `Cmd+K`, then `N` on macOS, or `Ctrl+K`, then `N` on Windows/Linux.
- The note name is `YYYY-MM-DD <top-level-folder> <branch>.md` when the folder is a Git repository.
- Notes are created in the `VSCode/YYYY/MM-MonthName/weekOrdinal/` folder structure inside your Obsidian vault by default.
- If the note already exists, a new `## YYYY-MM-DD HH:mm:ss` section is appended.
- Each section contains the current `git status` output in a fenced code block.

Command palette command:

- `Obsidian Workspace Log: Capture Git Status`

Settings:

- `obsidianWorkspaceLog.vaultPath`: Absolute path to your vault root. Leave empty only if the current workspace sits inside a vault.
- `obsidianWorkspaceLog.notesFolder`: Folder inside the vault for these notes. Defaults to `VSCode`.
