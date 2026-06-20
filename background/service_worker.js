importScripts("../vault/vault.js");

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function cleanFieldLabel(field) {
  const label = field.label || field.placeholder || field.name || field.id || field.type || field.tag;
  return String(label || "").trim();
}

function buildFieldLabels(fields) {
  return fields.map(cleanFieldLabel).filter(Boolean);
}

function stripJsonFences(text) {
  return text.replace(/```json?|```/g, "").trim();
}

async function getProvider() {
  const result = await chrome.storage.local.get([
    "gf_provider",
    "gf_gemini_key",
    "gf_claude_key"
  ]);

  const provider = result.gf_provider === "claude" ? "claude" : "gemini";
  const apiKey = provider === "claude" ? result.gf_claude_key : result.gf_gemini_key;

  return { provider, apiKey };
}

function buildPrompt(fields, domain, customFields) {
  const fieldLabels = buildFieldLabels(fields);

  return `You are a privacy tool. Generate a realistic but completely FAKE persona.
Site: ${domain}
Fields needed: ${fieldLabels.join(", ")}

Rules:
- Everything must be 100% fake
- email: use @mailnull.com
- phone: 555-xxx-xxxx format (fake)
- Use real city/state names but fake street numbers
- birthdate: YYYY-MM-DD format, age 25-45
- username: firstName + 3 random digits, lowercase
- password: 12 chars, letters + numbers + symbols

IMPORTANT: If the user has provided their own custom fields and values 
(passed in customFields object), you MUST use those exact values instead 
of generating fake ones for those fields.
Custom fields: ${JSON.stringify(customFields)}

Respond ONLY with a raw JSON object, no markdown, no explanation.`;
}

function getApiErrorMessage(data, fallback) {
  if (data && data.error) {
    if (typeof data.error === "string") {
      return data.error;
    }

    if (data.error.message) {
      return data.error.message;
    }

    if (data.error.type) {
      return data.error.type;
    }
  }

  return fallback || "API request failed";
}

function buildPersonaFromProfile(profile) {
  const persona = {};
  const customFields = Array.isArray(profile.customFields) ? profile.customFields : [];

  for (const [key, value] of Object.entries(profile)) {
    if (key !== "customFields" && value !== undefined && value !== null && value !== "") {
      persona[key] = value;
    }
  }

  persona.customFields = customFields;

  for (const field of customFields) {
    if (field && field.key && field.value !== undefined && field.value !== null) {
      persona[field.key] = field.value;
    }
  }

  return persona;
}

function buildCustomFieldsFromProfile(profile) {
  if (!profile) {
    return {};
  }

  const customFields = {};
  const profileFields = buildPersonaFromProfile(profile);

  for (const [key, value] of Object.entries(profileFields)) {
    if (key !== "customFields" && value !== undefined && value !== null && value !== "") {
      customFields[key] = value;
    }
  }

  return customFields;
}

async function parseProviderResponse(response, provider) {
  let data;

  try {
    data = await response.json();
  } catch (err) {
    throw new Error(err.message);
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, response.statusText));
  }

  if (provider === "gemini") {
    return data.candidates[0].content.parts[0].text;
  }

  return data.content[0].text;
}

async function generatePersona(fields, domain, provider, apiKey, customFields) {
  const prompt = buildPrompt(fields, domain, customFields);
  let response;

  if (provider === "gemini") {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 500,
            responseMimeType: "application/json"
          }
        })
      }
    );
  } else if (provider === "claude") {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      })
    });
  } else {
    throw new Error("Unsupported provider");
  }

  const rawText = await parseProviderResponse(response, provider);
  const cleanedText = stripJsonFences(rawText);

  try {
    return JSON.parse(cleanedText);
  } catch (err) {
    throw new Error("PARSE_ERROR");
  }
}

async function testApiKey(provider, apiKey) {
  const prompt = "Return only this JSON: {\"ok\":true}";

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 20,
            responseMimeType: "application/json"
          }
        })
      }
    );

    await parseProviderResponse(response, "gemini");
    return { valid: true };
  }

  if (provider === "claude") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        messages: [{ role: "user", content: prompt }]
      })
    });

    await parseProviderResponse(response, "claude");
    return { valid: true };
  }

  return { valid: false, error: "Unsupported provider" };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageType = message && message.type;

  if (messageType === "GENERATE_PERSONA") {
    (async () => {
      try {
        const domain = message.domain || "";
        const fillMode = await Vault.getFillMode();
        const profile = await Vault.getUserProfile();

        if (fillMode === "profile" && profile) {
          const persona = buildPersonaFromProfile(profile);
          await Vault.savePersona(domain, persona);
          sendResponse({ success: true, persona, source: "profile" });
          return;
        }

        const plan = await Vault.getPlan();
        const usage = await Vault.getUsage();
        const today = getToday();

        if (plan === "free" && usage.count >= 3 && usage.date === today) {
          sendResponse({ error: "LIMIT_REACHED" });
          return;
        }

        const { provider, apiKey } = await getProvider();

        if (!apiKey || !apiKey.trim()) {
          sendResponse({ error: "NO_API_KEY", provider });
          return;
        }

        const persona = await generatePersona(
          message.fields || [],
          domain,
          provider,
          apiKey,
          buildCustomFieldsFromProfile(profile)
        );

        await Vault.incrementUsage();
        await Vault.savePersona(domain, persona);
        sendResponse({ success: true, persona, provider });
      } catch (err) {
        if (err.message === "PARSE_ERROR") {
          sendResponse({ error: "PARSE_ERROR" });
          return;
        }

        sendResponse({ error: "API_ERROR", message: err.message });
      }
    })();

    return true;
  }

  if (messageType === "TEST_API_KEY") {
    (async () => {
      try {
        const provider = message.provider === "claude" ? "claude" : "gemini";
        const apiKey = message.apiKey || "";

        if (!apiKey.trim()) {
          sendResponse({ valid: false, error: "Missing API key" });
          return;
        }

        const result = await testApiKey(provider, apiKey);
        sendResponse(result);
      } catch (err) {
        sendResponse({ valid: false, error: err.message });
      }
    })();

    return true;
  }

  return false;
});
