const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sat", {
  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveToken: (token) => ipcRenderer.invoke("save-token", token),
  setProjectsFolder: () => ipcRenderer.invoke("set-projects-folder"),

  // Projects
  listProjects: () => ipcRenderer.invoke("list-projects"),
  createProject: (name) => ipcRenderer.invoke("create-project", name),
  cloneProject: (repoFullName) => ipcRenderer.invoke("clone-project", repoFullName),

  // Files
  listFiles: (project) => ipcRenderer.invoke("list-files", project),
  readFile: (project, path) => ipcRenderer.invoke("read-file", project, path),
  writeFile: (project, path, content) => ipcRenderer.invoke("write-file", project, path, content),
  createFile: (project, path) => ipcRenderer.invoke("create-file", project, path),
  deleteFile: (project, path) => ipcRenderer.invoke("delete-file", project, path),
  renameFile: (project, oldPath, newPath) => ipcRenderer.invoke("rename-file", project, oldPath, newPath),

  // Sync
  sync: (project) => ipcRenderer.invoke("sync-project", project),

  // Utilities
  openInFinder: (project) => ipcRenderer.invoke("open-in-finder", project),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  listRepos: () => ipcRenderer.invoke("list-repos"),
});
