let detectedFields = [];
let detectedElements = [];

const FIELD_SELECTOR = [
  'input[type="text"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="password"]',
  'input[type="number"]',
  'input[type="date"]',
  "select",
  "textarea"
].join(", ");

const KEYWORD_MAP = [
  { keywords: ["first", "fname"], personaKey: "firstName" },
  { keywords: ["last", "lname"], personaKey: "lastName" },
  { keywords: ["email"], personaKey: "email" },
  { keywords: ["phone", "tel", "mobile"], personaKey: "phone" },
  { keywords: ["address", "street"], personaKey: "address" },
  { keywords: ["city"], personaKey: "city" },
  { keywords: ["state", "province"], personaKey: "state" },
  { keywords: ["zip", "postal"], personaKey: "zip" },
  { keywords: ["country"], personaKey: "country" },
  { keywords: ["birth", "dob", "date"], personaKey: "birthdate" },
  { keywords: ["username", "user"], personaKey: "username" },
  { keywords: ["password", "pass"], personaKey: "password" },
  { keywords: ["company", "org"], personaKey: "company" }
];

function getFieldLabel(field) {
  if (field.id) {
    const label = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);

    if (label) {
      return label.textContent.trim();
    }
  }

  const wrappedLabel = field.closest("label");

  if (wrappedLabel) {
    return wrappedLabel.textContent.trim();
  }

  return field.getAttribute("aria-label") || "";
}

function scanFields() {
  detectedElements = Array.from(document.querySelectorAll(FIELD_SELECTOR)).filter(
    (field) => field.offsetParent !== null
  );

  detectedFields = detectedElements.map((field, index) => ({
    index,
    tag: field.tagName.toLowerCase(),
    type: field.type || "select",
    name: field.name || "",
    id: field.id || "",
    placeholder: field.placeholder || "",
    label: getFieldLabel(field)
  }));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getExactPersonaValue(field, persona) {
  const fieldName = normalize(field.name);
  const fieldId = normalize(field.id);

  for (const key of Object.keys(persona)) {
    const normalizedKey = normalize(key);

    if (normalizedKey && (normalizedKey === fieldName || normalizedKey === fieldId)) {
      return persona[key];
    }
  }

  return undefined;
}

function getKeywordPersonaValue(field, persona) {
  const searchableText = normalize(
    [field.label, field.placeholder, field.name].filter(Boolean).join(" ")
  );

  for (const mapping of KEYWORD_MAP) {
    if (mapping.keywords.some((keyword) => searchableText.includes(keyword))) {
      return persona[mapping.personaKey];
    }
  }

  return undefined;
}

function getPersonaValue(field, persona) {
  const exactValue = getExactPersonaValue(field, persona);

  if (exactValue !== undefined && exactValue !== null) {
    return exactValue;
  }

  const keywordValue = getKeywordPersonaValue(field, persona);

  if (keywordValue !== undefined && keywordValue !== null) {
    return keywordValue;
  }

  return null;
}

function scoreOption(option, value) {
  const optionText = normalize(option.textContent);
  const optionValue = normalize(option.value);
  const target = normalize(value);

  if (!target) {
    return 0;
  }

  if (optionText === target || optionValue === target) {
    return 100;
  }

  if (optionText.includes(target) || optionValue.includes(target)) {
    return 75;
  }

  if (target.includes(optionText) || target.includes(optionValue)) {
    return 50;
  }

  return 0;
}

function fillSelect(field, value) {
  let bestOption = null;
  let bestScore = 0;

  for (const option of field.options) {
    const score = scoreOption(option, value);

    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }

  if (bestOption) {
    field.value = bestOption.value;
  }
}

function injectValue(field, value) {
  if (field.tagName.toLowerCase() === "select") {
    fillSelect(field, value);
  } else {
    field.value = value;
  }

  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillFields(persona) {
  let filledCount = 0;

  detectedFields.forEach((fieldInfo, index) => {
    const field = detectedElements[index];
    const value = getPersonaValue(fieldInfo, persona);

    if (!field || value === null || value === "") {
      return;
    }

    injectValue(field, value);
    filledCount += 1;
  });

  return filledCount;
}

function highlightFields() {
  detectedElements.forEach((field) => {
    field.dataset.ghostformPreviousOutline = field.style.outline;
    field.style.outline = "2px solid #7f77dd";
  });

  setTimeout(() => {
    detectedElements.forEach((field) => {
      field.style.outline = field.dataset.ghostformPreviousOutline || "";
      delete field.dataset.ghostformPreviousOutline;
    });
  }, 2000);
}

scanFields();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageType = typeof message === "string" ? message : message && message.type;

  if (!messageType) {
    sendResponse({ ok: false, error: "Unknown message" });
    return true;
  }

  if (messageType === "GET_FIELDS") {
    scanFields();
    sendResponse({ fields: detectedFields });
    return true;
  }

  if (messageType === "FILL_FIELDS") {
    scanFields();
    const filledCount = fillFields(message.persona || {});
    sendResponse({ ok: true, filledCount });
    return true;
  }

  if (messageType === "HIGHLIGHT_FIELDS") {
    scanFields();
    highlightFields();
    sendResponse({ ok: true });
    return true;
  }

  sendResponse({ ok: false, error: "Unknown message" });
  return true;
});
