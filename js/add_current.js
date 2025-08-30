async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function normalizeUrl(input) {
  if (/^[a-z]+:\/\//i.test(input)) return input;
  if (/^[\w-]+\.[\w.-]+/.test(input)) return `https://${input}`;
  return input;
}
function loadShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ shortcuts: {} }, (res) =>
      resolve(res.shortcuts || {})
    );
  });
}
function saveShortcuts(shortcuts) {
  return new Promise((resolve) =>
    chrome.storage.sync.set({ shortcuts }, resolve)
  );
}
function getDefaults() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "get-defaults" }, (res) =>
      resolve(res?.defaults || {})
    );
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const aliasEl = document.getElementById("alias");
  const urlEl = document.getElementById("url");
  const titleEl = document.getElementById("title");
  const errorEl = document.getElementById("error");
  const saveBtn = document.getElementById("save");
  const cancelBtn = document.getElementById("cancel");

  const tab = await getActiveTab();
  titleEl.textContent = tab?.title || "Current Page";
  urlEl.value = tab?.url || "";

  // Suggest a default alias from hostname (e.g., github → gh)
  try {
    const u = new URL(tab.url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const base = parts[0];
    aliasEl.value = (base?.slice(0, 2) || "").toLowerCase(); // simple suggestion
  } catch {}

  cancelBtn.addEventListener("click", () => window.close());

  saveBtn.addEventListener("click", async () => {
    errorEl.textContent = "";

    const alias = aliasEl.value.trim();
    let url = urlEl.value.trim();

    if (!alias) {
      errorEl.textContent = "Alias is required.";
      return;
    }
    if (!url) {
      errorEl.textContent = "URL is required.";
      return;
    }

    const defaults = await getDefaults();
    if (defaults[alias]) {
      errorEl.textContent = `"${alias}" is a built-in alias and cannot be changed. Choose another alias.`;
      return;
    }

    url = normalizeUrl(url);

    const shortcuts = await loadShortcuts();
    shortcuts[alias] = url;
    await saveShortcuts(shortcuts);

    window.close(); // done
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("save").click();
  });

  async function openOptionsSafe() {
    console.log("Opening options page");
    try {
      if (chrome.runtime.openOptionsPage) {
        await chrome.runtime.openOptionsPage();
        return;
      }
    } catch (e) {
      // continue to fallback
    }
    const url = chrome.runtime.getURL("options.html");
    chrome.tabs.create({ url });
  }

  const manage = document.getElementById("openOptions");
  if (manage) manage.addEventListener("click", openOptionsSafe);
});
