const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const git = require("isomorphic-git");
const http = require("isomorphic-git/http/node");
const Store = require("./lib/store");
const GitHub = require("./lib/github");

const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0d1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// ─── Settings ───────────────────────────────────────────────────────

ipcMain.handle("get-settings", () => store.data);

ipcMain.handle("save-token", (_e, token) => {
  store.set("token", token);
  return true;
});

ipcMain.handle("set-projects-folder", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Choose where to keep your projects",
  });
  if (canceled) return null;
  store.set("projectsDir", filePaths[0]);
  return filePaths[0];
});

// ─── Projects ───────────────────────────────────────────────────────

function projectDir(name) {
  return path.join(store.data.projectsDir, name);
}

ipcMain.handle("list-projects", async () => {
  const dir = store.data.projectsDir;
  if (!dir || !fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, ".git")))
    .map((e) => ({ name: e.name, path: path.join(dir, e.name) }));
});

ipcMain.handle("create-project", async (_e, name) => {
  const token = store.data.token;
  if (!token) throw new Error("No GitHub token set");

  const gh = new GitHub(token);
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

  // Create remote repo
  const repo = await gh.createRepo(safeName);

  // Clone it locally
  const dir = projectDir(safeName);
  fs.mkdirSync(dir, { recursive: true });

  await git.init({ fs, dir });
  await git.addRemote({ fs, dir, remote: "origin", url: repo.clone_url });

  // Create initial README
  const readmePath = path.join(dir, "README.md");
  fs.writeFileSync(readmePath, `# ${name}\n\nCreated with Sat Book.\n`);

  await git.add({ fs, dir, filepath: "README.md" });
  await git.commit({
    fs,
    dir,
    message: "First page",
    author: { name: repo.owner.login, email: `${repo.owner.login}@users.noreply.github.com` },
  });

  // Set branch to main
  await git.branch({ fs, dir, ref: "main" });
  await git.checkout({ fs, dir, ref: "main" });

  // Push
  await git.push({
    fs,
    http,
    dir,
    remote: "origin",
    ref: "main",
    onAuth: () => ({ username: "x-access-token", password: token }),
  });

  return { name: safeName, path: dir };
});

ipcMain.handle("clone-project", async (_e, repoFullName) => {
  const token = store.data.token;
  const gh = new GitHub(token);
  const safeName = repoFullName.split("/").pop();
  const dir = projectDir(safeName);

  fs.mkdirSync(dir, { recursive: true });

  await git.clone({
    fs,
    http,
    dir,
    url: `https://github.com/${repoFullName}.git`,
    singleBranch: true,
    onAuth: () => ({ username: "x-access-token", password: token }),
  });

  return { name: safeName, path: dir };
});

// ─── Files ──────────────────────────────────────────────────────────

function walkDir(dir, base = "") {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push({ name: entry.name, path: rel, type: "dir", children: walkDir(path.join(dir, entry.name), rel) });
    } else {
      results.push({ name: entry.name, path: rel, type: "file" });
    }
  }
  return results.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
}

ipcMain.handle("list-files", (_e, projectName) => {
  const dir = projectDir(projectName);
  if (!fs.existsSync(dir)) return [];
  return walkDir(dir);
});

ipcMain.handle("read-file", (_e, projectName, filePath) => {
  const full = path.join(projectDir(projectName), filePath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf-8");
});

ipcMain.handle("write-file", async (_e, projectName, filePath, content) => {
  const dir = projectDir(projectName);
  const full = path.join(dir, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
  return true;
});

ipcMain.handle("create-file", async (_e, projectName, filePath) => {
  const dir = projectDir(projectName);
  const full = path.join(dir, filePath);
  if (fs.existsSync(full)) throw new Error("File already exists");
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, "", "utf-8");
  return true;
});

ipcMain.handle("delete-file", async (_e, projectName, filePath) => {
  const full = path.join(projectDir(projectName), filePath);
  if (fs.existsSync(full)) {
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      fs.rmSync(full, { recursive: true });
    } else {
      fs.unlinkSync(full);
    }
  }
  return true;
});

ipcMain.handle("rename-file", async (_e, projectName, oldPath, newPath) => {
  const dir = projectDir(projectName);
  const fullOld = path.join(dir, oldPath);
  const fullNew = path.join(dir, newPath);
  fs.mkdirSync(path.dirname(fullNew), { recursive: true });
  fs.renameSync(fullOld, fullNew);
  return true;
});

// ─── Sync (the magic — user never sees git) ─────────────────────────

ipcMain.handle("sync-project", async (_e, projectName) => {
  const token = store.data.token;
  const dir = projectDir(projectName);

  // Stage everything
  const status = await git.statusMatrix({ fs, dir });
  for (const [filepath, head, workdir, stage] of status) {
    if (filepath.startsWith(".")) continue;
    if (workdir === 0) {
      // deleted
      await git.remove({ fs, dir, filepath });
    } else if (workdir !== stage || head !== workdir) {
      await git.add({ fs, dir, filepath });
    }
  }

  // Check if there's anything to commit
  const statusAfter = await git.statusMatrix({ fs, dir });
  const hasChanges = statusAfter.some(([f, h, w, s]) => h !== s || w !== s);

  if (hasChanges) {
    // Get user info for commit
    const gh = new GitHub(token);
    const user = await gh.getUser();

    await git.commit({
      fs,
      dir,
      message: `Updated ${new Date().toLocaleDateString()}`,
      author: { name: user.login, email: `${user.login}@users.noreply.github.com` },
    });
  }

  // Pull then push
  try {
    await git.pull({
      fs,
      http,
      dir,
      remote: "origin",
      ref: "main",
      singleBranch: true,
      author: { name: "Sat Book", email: "satbook@local" },
      onAuth: () => ({ username: "x-access-token", password: token }),
    });
  } catch (e) {
    // If pull fails (e.g. empty remote), that's okay
    console.log("Pull skipped:", e.message);
  }

  await git.push({
    fs,
    http,
    dir,
    remote: "origin",
    ref: "main",
    onAuth: () => ({ username: "x-access-token", password: token }),
  });

  return true;
});

// ─── Open in Finder / File Manager ──────────────────────────────────

ipcMain.handle("open-in-finder", (_e, projectName) => {
  shell.openPath(projectDir(projectName));
});

ipcMain.handle("open-external", (_e, url) => {
  shell.openExternal(url);
});

// ─── GitHub repos list ──────────────────────────────────────────────

ipcMain.handle("list-repos", async () => {
  const token = store.data.token;
  if (!token) return [];
  const gh = new GitHub(token);
  return gh.listRepos();
});
