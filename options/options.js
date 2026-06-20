let currentPlan = "free";

const apiKeyInput = document.getElementById("apiKeyInput");
const toggleApiKeyBtn = document.getElementById("toggleApiKeyBtn");
const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
const apiKeyFeedback = document.getElementById("apiKeyFeedback");
const planBadge = document.getElementById("planBadge");
const planActions = document.getElementById("planActions");
const licenseKeyInput = document.getElementById("licenseKeyInput");
const activateLicenseBtn = document.getElementById("activateLicenseBtn");
const licenseFeedback = document.getElementById("licenseFeedback");
const vaultList = document.getElementById("vaultList");
const usageValue = document.getElementById("usageValue");

function getToday() {
  return new Date().toISOString().slice(0, 10);
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

async function loadApiKey() {
  const apiKey = await Vault.getApiKey();

  if (apiKey) {
    apiKeyInput.value = apiKey;
  }
}

async function saveApiKey() {
  setButtonLoading(saveApiKeyBtn, true, "Saving...", "Save key");
  setFeedback(apiKeyFeedback, "", false);

  try {
    await Vault.setApiKey(apiKeyInput.value.trim());
    setFeedback(apiKeyFeedback, "Saved ✓", false);
    clearFeedbackAfter(apiKeyFeedback, 2000);
  } catch (err) {
    setFeedback(apiKeyFeedback, "Could not save key", true);
  } finally {
    setButtonLoading(saveApiKeyBtn, false, "Saving...", "Save key");
  }
}

function toggleApiKeyVisibility() {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleApiKeyBtn.textContent = isPassword ? "Hide" : "Show";
}

function openUpgradePage() {
  chrome.tabs.create({ url: "https://ghostform.app/upgrade" });
}

function renderPlan() {
  const isPro = currentPlan === "pro";
  planBadge.textContent = isPro ? "Pro — Unlimited" : "Free — 3 fills/day";
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
  button.textContent = "Upgrade to Pro — $4.99/mo";
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

  row.append(domain, deleteButton);
  return row;
}

async function renderVault() {
  const personas = await Vault.getAllPersonas();
  vaultList.textContent = "";

  if (personas.length === 0) {
    renderEmptyVault();
    return;
  }

  personas.forEach((entry) => {
    vaultList.appendChild(createVaultRow(entry));
  });
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

async function init() {
  toggleApiKeyBtn.addEventListener("click", toggleApiKeyVisibility);
  saveApiKeyBtn.addEventListener("click", saveApiKey);
  activateLicenseBtn.addEventListener("click", activateLicense);

  await loadApiKey();
  await loadPlan();
  await Promise.all([renderVault(), renderUsage()]);
}

document.addEventListener("DOMContentLoaded", init);
