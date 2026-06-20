let currentTabId = null;
let currentDomain = "";
let detectedFields = [];
let savedPersona = null;
let activePersona = null;
let currentPlan = "free";
let currentUsage = { count: 0, date: "" };

const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const planBadgeEl = document.getElementById("planBadge");
const personaCardEl = document.getElementById("personaCard");
const savedNoteEl = document.getElementById("savedNote");
const personaNameEl = document.getElementById("personaName");
const personaEmailEl = document.getElementById("personaEmail");
const personaPhoneEl = document.getElementById("personaPhone");
const generateBtn = document.getElementById("generateBtn");
const savedBtn = document.getElementById("savedBtn");
const usageEl = document.getElementById("usage");
const settingsLink = document.getElementById("settingsLink");

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function setError(html) {
  errorEl.innerHTML = html;
  errorEl.style.display = html ? "block" : "none";

  const link = errorEl.querySelector("[data-open-settings]");

  if (link) {
    link.addEventListener("click", openSettings);
  }
}

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  savedBtn.disabled = isLoading || !savedPersona;
  generateBtn.innerHTML = isLoading
    ? '<span class="spinner"></span>Generating...'
    : "✨ Generate ghost persona";
}

function updatePlanBadge() {
  const isPro = currentPlan === "pro";
  planBadgeEl.textContent = isPro ? "Pro" : "Free";
  planBadgeEl.classList.toggle("pro", isPro);
}

function updateUsageIndicator() {
  usageEl.classList.remove("limit");

  if (currentPlan !== "free") {
    usageEl.textContent = "";
    return;
  }

  const count = currentUsage.date === getToday() ? currentUsage.count : 0;

  if (count >= 3) {
    usageEl.classList.add("limit");
    usageEl.innerHTML = 'Limit reached — Upgrade to Pro <a id="upgradeLink">Upgrade →</a>';
    document.getElementById("upgradeLink").addEventListener("click", openSettings);
    return;
  }

  usageEl.textContent = `${count} / 3 free fills used today`;
}

function updateFieldStatus() {
  const count = detectedFields.length;
  statusEl.textContent = count === 0
    ? "No form fields detected on this page"
    : `Found ${count} fields`;
}

function displayPersona(persona, isFromVault) {
  activePersona = persona;

  const fullName = [persona.firstName, persona.lastName].filter(Boolean).join(" ");
  personaNameEl.textContent = fullName || "";
  personaEmailEl.textContent = persona.email || "";
  personaPhoneEl.textContent = persona.phone || "";
  personaCardEl.classList.add("visible");
  savedNoteEl.classList.toggle("visible", Boolean(isFromVault));
}

function sendTabMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(currentTabId, message, (response) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function loadTabContext() {
  const tab = await getCurrentTab();
  currentTabId = tab.id;
  currentDomain = new URL(tab.url).hostname;
}

async function loadFields() {
  try {
    const response = await sendTabMessage("GET_FIELDS");
    detectedFields = response && Array.isArray(response.fields) ? response.fields : [];
  } catch (err) {
    detectedFields = [];
  }

  updateFieldStatus();
}

async function loadVaultState() {
  currentPlan = await Vault.getPlan();
  currentUsage = await Vault.getUsage();
  savedPersona = await Vault.getPersona(currentDomain);

  savedBtn.disabled = !savedPersona;
  updatePlanBadge();
  updateUsageIndicator();
}

async function refreshUsageState() {
  currentUsage = await Vault.getUsage();
  updateUsageIndicator();
}

function showApiKeyPrompt() {
  setError('API key not set. Go to <a data-open-settings>Settings →</a>');
}

function showUpgradeMessage() {
  usageEl.classList.add("limit");
  usageEl.innerHTML = 'Limit reached — Upgrade to Pro <a id="upgradeLink">Upgrade →</a>';
  document.getElementById("upgradeLink").addEventListener("click", openSettings);
}

async function handleGenerateClick() {
  setError("");

  const apiKey = await Vault.getApiKey();

  if (!apiKey || !apiKey.trim()) {
    showApiKeyPrompt();
    return;
  }

  setLoading(true);

  try {
    const response = await sendRuntimeMessage({
      type: "GENERATE_PERSONA",
      fields: detectedFields,
      domain: currentDomain
    });

    if (response && response.success) {
      savedPersona = response.persona;
      savedBtn.disabled = false;
      displayPersona(response.persona, false);
      await sendTabMessage({ type: "FILL_FIELDS", persona: response.persona });
      await refreshUsageState();
      return;
    }

    if (response && response.error === "LIMIT_REACHED") {
      showUpgradeMessage();
      return;
    }

    if (response && response.error === "NO_API_KEY") {
      showApiKeyPrompt();
      return;
    }

    setError("Something went wrong. Check your API key in Settings.");
  } catch (err) {
    setError("Something went wrong. Check your API key in Settings.");
  } finally {
    setLoading(false);
  }
}

async function handleSavedClick() {
  setError("");
  const persona = await Vault.getPersona(currentDomain);

  if (!persona) {
    savedPersona = null;
    savedBtn.disabled = true;
    return;
  }

  savedPersona = persona;
  displayPersona(persona, true);
  await sendTabMessage({ type: "FILL_FIELDS", persona });
}

async function handleCopyClick(event) {
  const button = event.target.closest(".copy-btn");

  if (!button || !activePersona) {
    return;
  }

  const copyType = button.dataset.copy;
  const value = copyType === "name"
    ? [activePersona.firstName, activePersona.lastName].filter(Boolean).join(" ")
    : activePersona[copyType];

  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(value);
  button.textContent = "✓";

  setTimeout(() => {
    button.textContent = "📋";
  }, 1500);
}

async function init() {
  settingsLink.addEventListener("click", openSettings);
  generateBtn.addEventListener("click", handleGenerateClick);
  savedBtn.addEventListener("click", handleSavedClick);
  personaCardEl.addEventListener("click", handleCopyClick);

  try {
    await loadTabContext();
    await Promise.all([loadFields(), loadVaultState()]);
  } catch (err) {
    statusEl.textContent = "Unable to scan this page";
  }
}

document.addEventListener("DOMContentLoaded", init);
