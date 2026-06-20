let currentPlan = "free";
let currentProvider = "gemini";
let currentFillMode = "ai";

document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();
  document.getElementById("theme-toggle")
    .addEventListener("click", () => ThemeManager.toggle());
});

const PROVIDER_CONFIG = {
  gemini: {
    key: "gf_gemini_key",
    label: "Gemini API Key",
    helper: "Get your Gemini key at aistudio.google.com"
  },
  claude: {
    key: "gf_claude_key",
    label: "Claude (Anthropic) API Key",
    helper: "Get your Claude key at console.anthropic.com"
  }
};

const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "password",
  "username",
  "houseNumber",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "birthdate",
  "company"
];

const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
const fillModeCards = Array.from(document.querySelectorAll("[data-fill-mode]"));
const providerCards = Array.from(document.querySelectorAll("[data-provider]"));
const providerSection = document.getElementById("providerSection");
const apiKeySection = document.getElementById("apiKeySection");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const apiKeyInput = document.getElementById("apiKeyInput");
const toggleApiKeyBtn = document.getElementById("toggleApiKeyBtn");
const saveTestApiKeyBtn = document.getElementById("saveTestApiKeyBtn");
const apiKeyHelper = document.getElementById("apiKeyHelper");
const apiKeyFeedback = document.getElementById("apiKeyFeedback");
const customFieldsList = document.getElementById("customFieldsList");
const addCustomFieldBtn = document.getElementById("addCustomFieldBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileFeedback = document.getElementById("profileFeedback");
const vaultList = document.getElementById("vaultList");
const clearVaultBtn = document.getElementById("clearVaultBtn");
const planBadge = document.getElementById("planBadge");
const planActions = document.getElementById("planActions");
const licenseKeyInput = document.getElementById("licenseKeyInput");
const activateLicenseBtn = document.getElementById("activateLicenseBtn");
const licenseFeedback = document.getElementById("licenseFeedback");
const usageValue = document.getElementById("usageValue");

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

function storageSet(items) {
  return chrome.storage.local.set(items);
}

function setFeedback(element, message, isError) {
  element.textContent = message;
  element.classList.toggle("error", Boolean(isError));
}

function clearFeedbackAfter(element, delay) {
  setTimeout(() => {
    element.textContent = "";
    element.classList.remove("error");
  }, delay);
}

function setButtonLoading(button, isLoading, loadingText, normalText) {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : normalText;
}

function switchTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
}

function getInitialTab() {
  const hashTab = window.location.hash.replace("#", "");
  return ["ai", "profile", "vault", "plan"].includes(hashTab) ? hashTab : "ai";
}

function updateFillModeUi() {
  fillModeCards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.fillMode === currentFillMode);
  });

  const showAiSettings = currentFillMode === "ai";
  providerSection.style.display = showAiSettings ? "block" : "none";
  apiKeySection.style.display = showAiSettings ? "block" : "none";
}

async function setFillMode(mode) {
  currentFillMode = mode === "profile" ? "profile" : "ai";
  await Vault.setFillMode(currentFillMode);
  updateFillModeUi();
}

function updateProviderUi() {
  providerCards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.provider === currentProvider);
  });
}

async function loadCurrentProviderKey() {
  const config = PROVIDER_CONFIG[currentProvider];
  const result = await storageGet(config.key);

  apiKeyLabel.textContent = config.label;
  apiKeyHelper.textContent = config.helper;
  apiKeyInput.type = "password";
  toggleApiKeyBtn.textContent = "Show";
  apiKeyInput.value = result[config.key] || "";
}

async function setProvider(provider) {
  currentProvider = provider === "claude" ? "claude" : "gemini";
  await storageSet({ gf_provider: currentProvider });
  updateProviderUi();
  await loadCurrentProviderKey();
  setFeedback(apiKeyFeedback, "", false);
}

function toggleApiKeyVisibility() {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleApiKeyBtn.textContent = isPassword ? "Hide" : "Show";
}

function testApiKey(provider, apiKey) {
  return chrome.runtime.sendMessage({
    type: "TEST_API_KEY",
    provider,
    apiKey
  });
}

async function saveAndTestApiKey() {
  const apiKey = apiKeyInput.value.trim();
  const config = PROVIDER_CONFIG[currentProvider];

  if (!apiKey) {
    setFeedback(apiKeyFeedback, "✗ Invalid: enter an API key", true);
    return;
  }

  setButtonLoading(saveTestApiKeyBtn, true, "Testing...", "Save & Test");
  setFeedback(apiKeyFeedback, "", false);

  try {
    const result = await testApiKey(currentProvider, apiKey);

    if (result && result.valid) {
      await storageSet({ [config.key]: apiKey });
      setFeedback(apiKeyFeedback, "✓ Valid", false);
      return;
    }

    setFeedback(apiKeyFeedback, `✗ Invalid${result && result.error ? `: ${result.error}` : ""}`, true);
  } catch (err) {
    setFeedback(apiKeyFeedback, `✗ Invalid: ${err.message}`, true);
  } finally {
    setButtonLoading(saveTestApiKeyBtn, false, "Testing...", "Save & Test");
  }
}

function profileInputId(fieldName) {
  return `${fieldName}Input`;
}

function createCustomFieldRow(customField) {
  const row = document.createElement("div");
  row.className = "custom-field-row";

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.placeholder = "Display Label";
  labelInput.dataset.customField = "label";
  labelInput.value = customField && customField.label ? customField.label : "";

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.placeholder = "Value";
  valueInput.dataset.customField = "value";
  valueInput.value = customField && customField.value ? customField.value : "";
  valueInput.dataset.key = customField && customField.key ? customField.key : "";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger";
  deleteButton.textContent = "🗑";
  deleteButton.title = "Delete custom field";
  deleteButton.addEventListener("click", () => row.remove());

  row.append(labelInput, valueInput, deleteButton);
  customFieldsList.appendChild(row);
}

function keyFromLabel(label, fallback) {
  const key = String(label || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (match, chr) => chr.toUpperCase())
    .replace(/[^a-z0-9]/gi, "");

  return key || fallback;
}

function collectCustomFields() {
  return Array.from(customFieldsList.querySelectorAll(".custom-field-row"))
    .map((row, index) => {
      const label = row.querySelector('[data-custom-field="label"]').value.trim();
      const valueInput = row.querySelector('[data-custom-field="value"]');
      const value = valueInput.value.trim();
      const savedKey = valueInput.dataset.key;
      const key = savedKey || keyFromLabel(label, `customField${index + 1}`);

      return { key, label, value };
    })
    .filter((field) => field.label || field.value);
}

function collectProfile() {
  const profile = {};

  PROFILE_FIELDS.forEach((fieldName) => {
    const input = document.getElementById(profileInputId(fieldName));
    profile[fieldName] = input ? input.value.trim() : "";
  });

  profile.customFields = collectCustomFields();
  return profile;
}

async function saveProfile() {
  setButtonLoading(saveProfileBtn, true, "Saving...", "Save Profile");

  try {
    await Vault.saveUserProfile(collectProfile());
    setFeedback(profileFeedback, "Profile saved ✓", false);
    clearFeedbackAfter(profileFeedback, 2000);
  } catch (err) {
    setFeedback(profileFeedback, "Could not save profile", true);
  } finally {
    setButtonLoading(saveProfileBtn, false, "Saving...", "Save Profile");
  }
}

async function loadProfile() {
  const profile = await Vault.getUserProfile();

  PROFILE_FIELDS.forEach((fieldName) => {
    const input = document.getElementById(profileInputId(fieldName));

    if (input) {
      input.value = profile && profile[fieldName] ? profile[fieldName] : "";
    }
  });

  customFieldsList.textContent = "";

  if (profile && Array.isArray(profile.customFields)) {
    profile.customFields.forEach(createCustomFieldRow);
  }
}

function openUpgradePage() {
  chrome.tabs.create({ url: "https://ghostform.app/upgrade" });
}

function renderPlan() {
  const isPro = currentPlan === "pro";
  planBadge.textContent = isPro ? "Pro - Unlimited" : "Free - 3 fills/day";
  planBadge.classList.toggle("pro", isPro);
  planActions.textContent = "";

  if (isPro) {
    const link = document.createElement("a");
    link.textContent = "Manage subscription";
    link.href = "https://ghostform.app/account";
    link.target = "_blank";
    planActions.appendChild(link);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Upgrade to Pro - $4.99/mo";
  button.addEventListener("click", openUpgradePage);
  planActions.appendChild(button);
}

async function loadPlan() {
  currentPlan = await Vault.getPlan();
  renderPlan();
}

async function activateLicense() {
  const licenseKey = licenseKeyInput.value.trim();

  if (!licenseKey) {
    setFeedback(licenseFeedback, "Enter a license key", true);
    return;
  }

  setButtonLoading(activateLicenseBtn, true, "Checking...", "Activate");
  setFeedback(licenseFeedback, "", false);

  try {
    const response = await fetch("https://ghostform.app/api/validate-license", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ licenseKey })
    });
    const result = await response.json();

    if (result.valid === true) {
      await Vault.setPlan("pro");
      currentPlan = "pro";
      renderPlan();
      await renderUsage();
      setFeedback(licenseFeedback, "Activated ✓", false);
      clearFeedbackAfter(licenseFeedback, 2000);
      return;
    }

    setFeedback(licenseFeedback, "Invalid license key", true);
  } catch (err) {
    setFeedback(licenseFeedback, "Could not validate license key", true);
  } finally {
    setButtonLoading(activateLicenseBtn, false, "Checking...", "Activate");
  }
}

function renderEmptyVault() {
  vaultList.innerHTML = '<div class="empty">No saved personas yet</div>';
}

function createVaultRow(entry) {
  const row = document.createElement("div");
  row.className = "vault-row";
  row.dataset.domain = entry.domain;

  const domain = document.createElement("div");
  domain.className = "domain";
  domain.textContent = entry.domain;

  const personaPreview = document.createElement("div");
  personaPreview.className = "persona-preview";
  personaPreview.textContent = JSON.stringify(entry.persona || {});
  personaPreview.title = personaPreview.textContent;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger";
  deleteButton.textContent = "Delete";

  deleteButton.addEventListener("click", async () => {
    setButtonLoading(deleteButton, true, "Deleting...", "Delete");

    try {
      await Vault.deletePersona(entry.domain);
      row.remove();

      if (!vaultList.querySelector(".vault-row")) {
        renderEmptyVault();
      }
    } catch (err) {
      setButtonLoading(deleteButton, false, "Deleting...", "Delete");
    }
  });

  row.append(domain, personaPreview, deleteButton);
  return row;
}

async function renderVault() {
  const personas = await Vault.getAllPersonas();
  vaultList.textContent = "";
  clearVaultBtn.disabled = personas.length === 0;

  if (personas.length === 0) {
    renderEmptyVault();
    return;
  }

  personas.forEach((entry) => {
    vaultList.appendChild(createVaultRow(entry));
  });
}

async function clearVault() {
  const personas = await Vault.getAllPersonas();

  if (personas.length === 0) {
    return;
  }

  if (!confirm("Clear all saved personas?")) {
    return;
  }

  setButtonLoading(clearVaultBtn, true, "Clearing...", "Clear all");

  try {
    await Promise.all(personas.map((entry) => Vault.deletePersona(entry.domain)));
    await renderVault();
  } finally {
    setButtonLoading(clearVaultBtn, false, "Clearing...", "Clear all");
  }
}

async function renderUsage() {
  const usage = await Vault.getUsage();

  if (currentPlan === "pro") {
    usageValue.textContent = "Unlimited";
    return;
  }

  const count = usage.date === getToday() ? usage.count : 0;
  usageValue.textContent = `${count} / 3 fills used today`;
}

async function loadSettings() {
  const result = await storageGet("gf_provider");
  currentProvider = result.gf_provider === "claude" ? "claude" : "gemini";
  currentFillMode = await Vault.getFillMode();

  updateProviderUi();
  updateFillModeUi();
  await loadCurrentProviderKey();
}

async function init() {
  switchTab(getInitialTab());

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
      window.location.hash = button.dataset.tab;
    });
  });

  toggleApiKeyBtn.addEventListener("click", toggleApiKeyVisibility);
  saveTestApiKeyBtn.addEventListener("click", saveAndTestApiKey);
  addCustomFieldBtn.addEventListener("click", () => createCustomFieldRow());
  saveProfileBtn.addEventListener("click", saveProfile);
  clearVaultBtn.addEventListener("click", clearVault);
  activateLicenseBtn.addEventListener("click", activateLicense);

  fillModeCards.forEach((card) => {
    card.addEventListener("click", () => setFillMode(card.dataset.fillMode));
  });

  providerCards.forEach((card) => {
    card.addEventListener("click", () => setProvider(card.dataset.provider));
  });

  await loadSettings();
  await loadProfile();
  await loadPlan();
  await Promise.all([renderVault(), renderUsage()]);
}

document.addEventListener("DOMContentLoaded", init);
