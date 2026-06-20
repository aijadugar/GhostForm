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

async function generatePersona(fields, domain) {
  const plan = await Vault.getPlan();
  const usage = await Vault.getUsage();
  const today = getToday();

  if (plan === "free" && usage.count >= 3 && usage.date === today) {
    return { error: "LIMIT_REACHED" };
  }

  const apiKey = await Vault.getApiKey();

  if (!apiKey || !apiKey.trim()) {
    return { error: "NO_API_KEY" };
  }

  const fieldLabels = buildFieldLabels(fields);

  let response;

  try {
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
        messages: [{
          role: "user",
          content: `Generate a realistic but completely FAKE persona to fill a web form.
Site: ${domain}
Fields needed: ${fieldLabels.join(", ")}

Rules:
- Everything must be 100% fake — not a real person
- firstName, lastName: common Western names, mix of cultures
- email: use @mailnull.com or @tempinbox.io as the domain
- phone: US format, always use 555 as area code e.g. 555-382-1947
- address: fake street number + real US street name
- city, state, zip: real US city/state/zip combinations
- birthdate: format YYYY-MM-DD, age between 25 and 45
- username: combine firstName + random 3-digit number, lowercase
- password: 12 characters, mix of letters numbers symbols
- company: a believable but fake company name

Respond ONLY with a raw JSON object. No explanation, no markdown fences, no extra text.
Keys must be camelCase: firstName, lastName, email, phone, address, city, state, 
zip, country, birthdate, username, password, company`
        }]
      })
    });
  } catch (err) {
    return { error: "API_ERROR", message: err.message };
  }

  let data;

  try {
    data = await response.json();
  } catch (err) {
    return { error: "API_ERROR", message: err.message };
  }

  let parsedPersona;

  try {
    const rawText = data.content[0].text;
    const cleanedText = stripJsonFences(rawText);
    parsedPersona = JSON.parse(cleanedText);
  } catch (err) {
    return { error: "PARSE_ERROR" };
  }

  await Vault.incrementUsage();
  await Vault.savePersona(domain, parsedPersona);

  return { success: true, persona: parsedPersona };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageType = message && message.type;

  if (messageType !== "GENERATE_PERSONA") {
    return false;
  }

  (async () => {
    try {
      const result = await generatePersona(message.fields || [], message.domain || "");
      sendResponse(result);
    } catch (err) {
      sendResponse({ error: "API_ERROR", message: err.message });
    }
  })();

  return true;
});
