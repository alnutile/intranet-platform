# Sat Book

**Your files on GitHub, without the headache.**

A desktop app that lets you create and edit projects backed by GitHub — with zero git jargon. No branches, no commits, no pull requests. Just files.

## How it works

1. **Paste your GitHub token** — the app stores it locally
2. **Pick a folder** — where projects live on your disk
3. **Create a project** — or open an existing GitHub repo
4. **Edit your files** — nice markdown editing with live preview
5. **Hit Sync** — your changes go to GitHub, done

Behind the scenes, the app handles git clone, add, commit, and push. You never see any of it.

## Running it

```bash
cd electron-app
npm install
npm start
```

## Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+S` | Save file to disk |
| `Cmd+Shift+S` | Save & sync to GitHub |

## Stack

- **Electron** — desktop shell
- **isomorphic-git** — git operations (no git CLI needed)
- **Vanilla JS** — no build step, no bundler, just HTML/CSS/JS
