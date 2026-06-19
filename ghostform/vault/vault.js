(function () {
  const INDEX_KEY = "gf_vault_index";
  const USAGE_KEY = "gf_usage";
  const PLAN_KEY = "gf_plan";
  const API_KEY = "gf_api_key";

  function personaKey(domain) {
    return `gf_vault_${domain}`;
  }

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  async function storageGet(keys) {
    return chrome.storage.local.get(keys);
  }

  async function storageSet(items) {
    return chrome.storage.local.set(items);
  }

  async function storageRemove(keys) {
    return chrome.storage.local.remove(keys);
  }

  async function getIndex() {
    const result = await storageGet(INDEX_KEY);
    return Array.isArray(result[INDEX_KEY]) ? result[INDEX_KEY] : [];
  }

  async function saveIndex(domains) {
    const uniqueDomains = Array.from(new Set(domains));
    await storageSet({ [INDEX_KEY]: uniqueDomains });
  }

  globalThis.Vault = {
    async savePersona(domain, persona) {
      const domains = await getIndex();

      if (!domains.includes(domain)) {
        domains.push(domain);
      }

      await storageSet({
        [personaKey(domain)]: persona,
        [INDEX_KEY]: domains
      });
    },

    async getPersona(domain) {
      const key = personaKey(domain);
      const result = await storageGet(key);
      return result[key] || null;
    },

    async getAllPersonas() {
      const domains = await getIndex();
      const keys = domains.map(personaKey);
      const result = await storageGet(keys);

      return domains
        .filter((domain) => result[personaKey(domain)] !== undefined)
        .map((domain) => ({
          domain,
          persona: result[personaKey(domain)]
        }));
    },

    async deletePersona(domain) {
      const domains = await getIndex();
      const nextDomains = domains.filter((savedDomain) => savedDomain !== domain);

      await storageRemove(personaKey(domain));
      await saveIndex(nextDomains);
    },

    async getUsage() {
      const today = getToday();
      const result = await storageGet(USAGE_KEY);
      const usage = result[USAGE_KEY];

      if (!usage || typeof usage.count !== "number" || !usage.date) {
        return { count: 0, date: today };
      }

      return usage;
    },

    async incrementUsage() {
      const today = getToday();
      const usage = await this.getUsage();
      const nextUsage = {
        count: usage.date === today ? usage.count + 1 : 1,
        date: today
      };

      await storageSet({ [USAGE_KEY]: nextUsage });
      return nextUsage;
    },

    async getPlan() {
      const result = await storageGet(PLAN_KEY);
      return result[PLAN_KEY] || "free";
    },

    async setPlan(plan) {
      await storageSet({ [PLAN_KEY]: plan });
    },

    async getApiKey() {
      const result = await storageGet(API_KEY);
      return result[API_KEY] || null;
    },

    async setApiKey(key) {
      await storageSet({ [API_KEY]: key });
    }
  };
})();
