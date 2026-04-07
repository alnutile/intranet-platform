/* ─── Sat Book — Renderer ─────────────────────────────────────────── */

const { marked } = window.marked || {};
let parseMarkdown;

// We'll use a simple marked import via the preload or inline
// Since we're using CSP, load marked from node_modules through a script
// For now, use a basic markdown renderer
function simpleMarkdown(text) {
  if (!text) return "";
  return text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Unordered lists
    .replace(/^[*-] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr>")
    // Line breaks → paragraphs
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupob])(.+)$/gm, "<p>$1</p>");
}

// ─── State ──────────────────────────────────────────────────────────

let state = {
  screen: "setup", // setup | projects | editor
  settings: {},
  projects: [],
  currentProject: null,
  files: [],
  currentFile: null,
  fileContent: "",
  editorMode: "write", // write | preview
  syncing: false,
  dirty: false,
};

// ─── DOM refs ───────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const screens = {
  setup: $("setup-screen"),
  projects: $("projects-screen"),
  editor: $("editor-screen"),
};

// ─── Screen management ──────────────────────────────────────────────

function showScreen(name) {
  state.screen = name;
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle("hidden", k !== name);
  });
}

// ─── Setup Screen ───────────────────────────────────────────────────

const tokenInput = $("token-input");
const folderDisplay = $("folder-display");
const folderBtn = $("folder-btn");
const setupContinue = $("setup-continue");
const tokenHelpLink = $("token-help-link");

function updateSetupButton() {
  setupContinue.disabled = !tokenInput.value.trim() || !state.settings.projectsDir;
}

tokenInput.addEventListener("input", updateSetupButton);

tokenHelpLink.addEventListener("click", () => {
  window.sat.openExternal("https://github.com/settings/tokens/new?description=Sat+Book&scopes=repo");
});

folderBtn.addEventListener("click", async () => {
  const dir = await window.sat.setProjectsFolder();
  if (dir) {
    state.settings.projectsDir = dir;
    folderDisplay.textContent = dir;
    updateSetupButton();
  }
});

setupContinue.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  await window.sat.saveToken(token);
  state.settings.token = token;
  await loadProjects();
  showScreen("projects");
});

$("settings-btn").addEventListener("click", () => {
  tokenInput.value = state.settings.token || "";
  folderDisplay.textContent = state.settings.projectsDir || "Not set";
  updateSetupButton();
  showScreen("setup");
});

// ─── Projects Screen ────────────────────────────────────────────────

async function loadProjects() {
  state.projects = await window.sat.listProjects();
  renderProjects();
}

function renderProjects() {
  const list = $("project-list");
  if (state.projects.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📚</div>
        <p>No projects yet.</p>
        <p style="font-size:13px;margin-top:8px;">Create one to get started!</p>
      </div>`;
    return;
  }
  list.innerHTML = state.projects
    .map(
      (p) => `
    <div class="project-card" data-name="${p.name}">
      <div class="icon">📖</div>
      <div>
        <div class="name">${p.name}</div>
        <div class="path">${p.path}</div>
      </div>
    </div>`
    )
    .join("");

  list.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", () => openProject(card.dataset.name));
  });
}

// ─── New Project Modal ──────────────────────────────────────────────

const modal = $("new-project-modal");
const panelNew = $("panel-new");
const panelExisting = $("panel-existing");
let activeTab = "new";
let repos = [];
let selectedRepo = null;

$("new-project-btn").addEventListener("click", () => {
  modal.classList.remove("hidden");
  $("new-project-name").value = "";
  $("new-project-name").focus();
  switchTab("new");
});

$("modal-cancel").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

document.querySelectorAll(".tab-bar button").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab-bar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  panelNew.classList.toggle("hidden", tab !== "new");
  panelExisting.classList.toggle("hidden", tab !== "existing");
  $("modal-create").textContent = tab === "new" ? "Create" : "Add";

  if (tab === "existing" && repos.length === 0) {
    loadRepos();
  }
}

async function loadRepos() {
  const repoList = $("repo-list");
  repoList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);"><span class="loader"></span></div>';
  repos = await window.sat.listRepos();
  renderRepos(repos);
}

function renderRepos(list) {
  const repoList = $("repo-list");
  if (list.length === 0) {
    repoList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">No repos found.</div>';
    return;
  }
  repoList.innerHTML = list
    .map(
      (r) => `
    <div class="repo-item" data-fullname="${r.fullName}">
      <div>
        <div class="repo-name">${r.name}</div>
        <div class="repo-meta">${r.fullName}${r.private ? " · Private" : ""}</div>
      </div>
    </div>`
    )
    .join("");

  repoList.querySelectorAll(".repo-item").forEach((item) => {
    item.addEventListener("click", () => {
      repoList.querySelectorAll(".repo-item").forEach((i) => (i.style.background = ""));
      item.style.background = "var(--bg-active)";
      selectedRepo = item.dataset.fullname;
    });
  });
}

$("repo-search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  renderRepos(repos.filter((r) => r.name.toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q)));
});

$("modal-create").addEventListener("click", async () => {
  const btn = $("modal-create");
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span>';

  try {
    if (activeTab === "new") {
      const name = $("new-project-name").value.trim();
      if (!name) { btn.disabled = false; btn.textContent = "Create"; return; }
      await window.sat.createProject(name);
    } else {
      if (!selectedRepo) { btn.disabled = false; btn.textContent = "Add"; return; }
      await window.sat.cloneProject(selectedRepo);
      selectedRepo = null;
    }
    modal.classList.add("hidden");
    await loadProjects();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = activeTab === "new" ? "Create" : "Add";
  }
});

// ─── Editor Screen ──────────────────────────────────────────────────

async function openProject(name) {
  state.currentProject = name;
  state.currentFile = null;
  state.dirty = false;
  $("editor-project-name").textContent = name;
  $("editor-filename").textContent = "";
  $("editor-status").textContent = "";
  showScreen("editor");
  showEditorEmpty();
  await refreshFiles();
}

$("editor-back").addEventListener("click", async () => {
  if (state.dirty) {
    await autoSave();
  }
  state.currentProject = null;
  await loadProjects();
  showScreen("projects");
});

// File tree
async function refreshFiles() {
  state.files = await window.sat.listFiles(state.currentProject);
  renderFileTree();
}

function renderFileTree() {
  const tree = $("file-tree");
  tree.innerHTML = renderTreeNodes(state.files);
  tree.querySelectorAll(".file-tree-item[data-type='file']").forEach((item) => {
    item.addEventListener("click", () => openFile(item.dataset.path));
  });
  tree.querySelectorAll(".file-tree-item[data-type='dir']").forEach((item) => {
    item.addEventListener("click", () => {
      const children = item.nextElementSibling;
      if (children && children.classList.contains("file-tree-children")) {
        children.classList.toggle("hidden");
        const icon = item.querySelector(".file-icon");
        icon.textContent = children.classList.contains("hidden") ? "▸" : "▾";
      }
    });
  });
}

function renderTreeNodes(nodes, depth = 0) {
  return nodes
    .map((n) => {
      if (n.type === "dir") {
        return `
          <div class="file-tree-item dir" data-path="${n.path}" data-type="dir">
            <span class="file-icon">▾</span>
            <span>${n.name}</span>
          </div>
          <div class="file-tree-children">
            ${n.children ? renderTreeNodes(n.children, depth + 1) : ""}
          </div>`;
      }
      const isActive = state.currentFile === n.path;
      const icon = fileIcon(n.name);
      return `
        <div class="file-tree-item${isActive ? " active" : ""}" data-path="${n.path}" data-type="file">
          <span class="file-icon">${icon}</span>
          <span>${n.name}</span>
        </div>`;
    })
    .join("");
}

function fileIcon(name) {
  if (name.endsWith(".md")) return "📝";
  if (name.endsWith(".txt")) return "📄";
  if (name.match(/\.(png|jpg|jpeg|gif|svg)$/)) return "🖼";
  if (name.match(/\.(pdf)$/)) return "📕";
  return "📄";
}

// File opening & editing
let saveTimeout = null;

async function openFile(filepath) {
  if (state.dirty) await autoSave();

  state.currentFile = filepath;
  $("editor-filename").textContent = filepath.split("/").pop();
  renderFileTree(); // update active state

  const content = await window.sat.readFile(state.currentProject, filepath);
  state.fileContent = content || "";

  const isMarkdown = filepath.endsWith(".md");

  if (state.editorMode === "preview" && isMarkdown) {
    showPreview(state.fileContent);
  } else {
    showEditor(state.fileContent);
  }
}

function showEditorEmpty() {
  $("editor-empty").classList.remove("hidden");
  $("editor-textarea").classList.add("hidden");
  $("editor-preview").classList.add("hidden");
}

function showEditor(content) {
  $("editor-empty").classList.add("hidden");
  $("editor-preview").classList.add("hidden");
  const textarea = $("editor-textarea");
  textarea.classList.remove("hidden");
  textarea.value = content;
  textarea.focus();
}

function showPreview(content) {
  $("editor-empty").classList.add("hidden");
  $("editor-textarea").classList.add("hidden");
  const preview = $("editor-preview");
  preview.classList.remove("hidden");
  preview.innerHTML = simpleMarkdown(content);
}

$("editor-textarea").addEventListener("input", (e) => {
  state.fileContent = e.target.value;
  state.dirty = true;
  $("editor-status").textContent = "Unsaved";
  $("editor-status").className = "status";

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(autoSave, 1500);
});

// Tab switching
$("tab-write").addEventListener("click", () => {
  state.editorMode = "write";
  $("tab-write").classList.add("active");
  $("tab-preview").classList.remove("active");
  if (state.currentFile) showEditor(state.fileContent);
});

$("tab-preview").addEventListener("click", () => {
  state.editorMode = "preview";
  $("tab-preview").classList.add("active");
  $("tab-write").classList.remove("active");
  if (state.currentFile) showPreview(state.fileContent);
});

// Auto-save to disk (not sync)
async function autoSave() {
  if (!state.dirty || !state.currentFile) return;
  $("editor-status").textContent = "Saving…";
  $("editor-status").className = "status saving";
  await window.sat.writeFile(state.currentProject, state.currentFile, state.fileContent);
  state.dirty = false;
  $("editor-status").textContent = "Saved";
  $("editor-status").className = "status saved";
}

// New file
$("new-file-btn").addEventListener("click", async () => {
  const name = prompt("File name (e.g. chapter-1.md):");
  if (!name) return;
  try {
    await window.sat.createFile(state.currentProject, name);
    await refreshFiles();
    openFile(name);
  } catch (err) {
    alert(err.message);
  }
});

// Open in Finder
$("open-finder-btn").addEventListener("click", () => {
  window.sat.openInFinder(state.currentProject);
});

// ─── Sync ───────────────────────────────────────────────────────────

$("sync-btn").addEventListener("click", async () => {
  if (state.syncing) return;
  if (state.dirty) await autoSave();

  state.syncing = true;
  $("sync-label").innerHTML = '<span class="spinning">↻</span> Syncing…';
  $("sync-status").textContent = "Syncing with GitHub…";
  $("sync-status").className = "sync-badge syncing";

  try {
    await window.sat.sync(state.currentProject);
    $("sync-status").textContent = "All synced ✓";
    $("sync-status").className = "sync-badge synced";
    await refreshFiles();
  } catch (err) {
    console.error("Sync error:", err);
    $("sync-status").textContent = "Sync failed — " + (err.message || "try again");
    $("sync-status").className = "sync-badge error";
  } finally {
    state.syncing = false;
    $("sync-label").innerHTML = "↑ Save & Sync";
  }
});

// ─── Keyboard shortcuts ─────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  // Cmd/Ctrl+S → save
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    autoSave();
  }
  // Cmd/Ctrl+Shift+S → sync
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "S") {
    e.preventDefault();
    $("sync-btn").click();
  }
});

// ─── Init ───────────────────────────────────────────────────────────

async function init() {
  state.settings = await window.sat.getSettings();

  if (state.settings.token && state.settings.projectsDir) {
    // Already configured, go to projects
    await loadProjects();
    showScreen("projects");
  } else {
    // Need setup
    tokenInput.value = state.settings.token || "";
    folderDisplay.textContent = state.settings.projectsDir || "Not set";
    updateSetupButton();
    showScreen("setup");
  }
}

init();
