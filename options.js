const tbody = document.querySelector("#list tbody");
const aliasInput = document.getElementById("alias");
const urlInput = document.getElementById("url");
const addBtn = document.getElementById("addBtn");

// Get defaults from background.js
async function getDefaults() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "get-defaults" }, (res) => {
      resolve((res && res.defaults) || {});
    });
  });
}

// Load custom shortcuts from storage
function load() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ shortcuts: {} }, (res) =>
      resolve(res.shortcuts || {})
    );
  });
}

// Save custom shortcuts to storage
function save(shortcuts) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ shortcuts }, resolve);
  });
}

// Render defaults (read-only) + custom (editable)
function renderRows({ defaults, custom }) {
  tbody.innerHTML = "";

  // 1) Defaults (read-only)
  Object.entries(defaults).forEach(([alias, url]) => {
    const tr = document.createElement("tr");
    tr.className = "row-readonly";

    const a = document.createElement("td");
    a.textContent = alias;
    a.style.fontWeight = "600";

    const u = document.createElement("td");
    u.className = "url-cell";
    u.textContent = url;

    const actions = document.createElement("td");
    actions.textContent = "Built-in";
    actions.className = "muted-action";

    tr.append(a, u, actions);
    tbody.appendChild(tr);
  });

  // 2) Custom (editable)
  Object.entries(custom).forEach(([alias, url]) => {
    const tr = document.createElement("tr");

    const a = document.createElement("td");
    a.textContent = alias;
    a.style.fontWeight = "600";

    const u = document.createElement("td");
    u.className = "url-cell";
    u.textContent = url;

    const actions = document.createElement("td");
    actions.className = "actions";

    const edit = document.createElement("button");
    edit.className = "btn edit";
    edit.textContent = "Edit";
    edit.onclick = () => {
      aliasInput.value = alias;
      urlInput.value = url;
      aliasInput.focus();
    };

    const del = document.createElement("button");
    del.className = "btn delete";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      if (!confirm(`Are you sure you want to delete alias "${alias}"?`)) return;

      const current = await load();
      delete current[alias];
      await save(current);
      const defaults = await getDefaults();
      renderRows(tbody, { defaults, custom: await load() }, refs);
    });

    actions.append(edit, del);
    tr.append(a, u, actions);
    tbody.appendChild(tr);
  });
}

// Render all rows
async function renderAll() {
  const [defaults, custom] = await Promise.all([getDefaults(), load()]);
  renderRows({ defaults, custom });
}

// Add button handler
addBtn.addEventListener("click", async () => {
  const alias = aliasInput.value.trim();
  let url = urlInput.value.trim();
  if (!alias || !url) return;

  const defaults = await getDefaults();
  if (defaults[alias]) {
    alert(`"${alias}" is a built-in alias and cannot be changed.`);
    return;
  }

  // Normalize URL if no scheme provided
  if (!/^[a-z]+:\/\//i.test(url) && /^[\w-]+\.[\w.-]+/.test(url)) {
    url = `https://${url}`;
  }

  const current = await load();
  current[alias] = url;
  await save(current);

  aliasInput.value = "";
  urlInput.value = "";
  aliasInput.focus();

  await renderAll();
});

// Initial render
(async () => {
  await renderAll();
})();
