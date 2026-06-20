const ThemeManager = {
  init() {
    // Load saved preference first
    chrome.storage.local.get("gf_theme", (data) => {
      const saved = data.gf_theme; // "light", "dark", or "system"
      this.apply(saved || "system");
    });

    // Watch for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        chrome.storage.local.get("gf_theme", (data) => {
          if (!data.gf_theme || data.gf_theme === "system") {
            this.applyScheme(e.matches ? "dark" : "light");
          }
        });
      });
  },

  apply(preference) {
    // preference is "light", "dark", or "system"
    if (preference === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.applyScheme(isDark ? "dark" : "light");
    } else {
      this.applyScheme(preference);
    }
    // Update toggle button state if it exists
    const btn = document.getElementById("theme-toggle");
    if (btn) this.updateToggleUI(btn, preference);
  },

  applyScheme(scheme) {
    // scheme is "light" or "dark"
    if (scheme === "dark") {
      document.body.classList.add("dark");
      document.body.classList.remove("light");
    } else {
      document.body.classList.add("light");
      document.body.classList.remove("dark");
    }
  },

  toggle() {
    chrome.storage.local.get("gf_theme", (data) => {
      const current = data.gf_theme || "system";
      // Cycle: system -> light -> dark -> system
      const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
      chrome.storage.local.set({ gf_theme: next });
      this.apply(next);
    });
  },

  updateToggleUI(btn, preference) {
    const icons = { light: "☀️", dark: "🌙", system: "💻" };
    btn.textContent = icons[preference] || "💻";
    btn.title = `Theme: ${preference} (click to change)`;
  }
};
