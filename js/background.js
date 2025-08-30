const DEFAULT_SHORTCUTS = {
  gh: "https://github.com",
  yt: "https://www.youtube.com",
  gm: "https://mail.google.com",
  x: "https://x.com",
  lk: "https://www.linkedin.com",
};

// Normalize a value into a URL (adds https:// if missing & no protocol)
function normalizeToUrl(input) {
  if (/^[a-z]+:\/\//i.test(input)) return input; // already has protocol
  if (/^[\w-]+\.[\w.-]+/.test(input)) return `https://${input}`;
  return input;
}

async function getShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ shortcuts: DEFAULT_SHORTCUTS }, (res) => {
      resolve(res.shortcuts || {});
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getShortcuts();
  // Seed defaults only if empty
  if (!Object.keys(existing).length) {
    chrome.storage.sync.set({ shortcuts: DEFAULT_SHORTCUTS });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ql_add_shortcut",
    title: "Add this page to Quick Launch…",
    contexts: ["page", "frame", "link", "selection", "page_action", "action"],
  });
});

// Context menu handler → opens the popup prefilled
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "ql_add_shortcut") return;
  // Programmatically open the action popup pointing at current tab
  chrome.action.openPopup(); // popup reads active tab to prefill
});

// Let options page read the built-in defaults without duplicating them
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg && msg.type === "get-defaults") {
    sendResponse({ defaults: DEFAULT_SHORTCUTS });
  }
});

// Provide live suggestions as the user types after the keyword
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const shortcuts = await getShortcuts();
  const q = text.trim().toLowerCase();

  // If user typed "alias moreText" allow passing the rest as a path/query
  // e.g., "gh topics/chrome" -> https://github.com/topics/chrome
  const [alias, ...rest] = q.split(/\s+/);
  const base = shortcuts[alias];

  const suggestions = [];

  // Show all matching aliases
  Object.entries(shortcuts).forEach(([k, url]) => {
    if (!q || k.includes(q) || url.toLowerCase().includes(q)) {
      suggestions.push({
        content: `$${k} ${Math.random().toString(36).slice(2)}`, // ensure unique content
        description: `🔗 ${k} — ${url}`,
      });
    }
  });

  // If alias found and extra text is provided, show a composed suggestion too
  if (base && rest.length) {
    const tail = rest.join(" ");
    const composed = base.replace(/\/+$/, "") + "/" + tail.replace(/^\/+/, "");
    suggestions.unshift({
      content: `${alias} ${tail}`,
      description: `➡️ ${alias} → ${composed}`,
    });
  }

  suggest(suggestions.slice(0, 6));
});

// Handle Enter
chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const shortcuts = await getShortcuts();
  const trimmed = text.trim();

  // Support "alias extra/path?query"
  const [alias, ...rest] = trimmed.split(/\s+/);
  const base = shortcuts[alias];

  let target;
  if (base) {
    if (rest.length) {
      const tail = rest.join(" ");
      target = base.replace(/\/+$/, "") + "/" + tail.replace(/^\/+/, "");
    } else {
      target = base;
    }
  } else {
    // If no alias match: treat as URL or search text
    if (/^[\w-]+:\/\//.test(trimmed) || /^[\w-]+\.[\w.-]+/.test(trimmed)) {
      target = normalizeToUrl(trimmed);
    } else {
      // Fallback: Google search (change to your preferred engine)
      target = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }
  }

  const open = (url) => {
    switch (disposition) {
      case "currentTab":
        chrome.tabs.update({ url });
        break;
      case "newForegroundTab":
        chrome.tabs.create({ url });
        break;
      case "newBackgroundTab":
        chrome.tabs.create({ url, active: false });
        break;
      default:
        chrome.tabs.create({ url });
    }
  };

  open(target);
});
