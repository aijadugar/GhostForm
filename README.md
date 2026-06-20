<div align="center">

# 👻 About GhostForm

*The story behind the extension*

</div>

---

## The Problem

You visit a new website. They want your name, email, phone number, and address just to let you look around or grab a free trial.

You hand it over. A week later, your inbox has tripled in spam. A month later, your number is on cold-call lists. Six months later, your full name and address are sitting on Spokeo, Whitepages, and forty other sites you've never heard of — ready for anyone to look up.

**This is not an accident. It's the business model.**

Every form you fill honestly is a data point sold to someone you never agreed to share it with.

---

## The Idea

The fix seemed obvious: what if filling a form took one click, used a believable fake identity, and your real information never touched their database at all?

That's GhostForm.

Not a VPN. Not a tracker blocker. Something more direct — **a ghost that lives in your browser and shows up whenever a form asks too many questions.**

---

## What GhostForm Is

A Chrome and Firefox extension with one job: fill any web form with a realistic fake persona the moment you need one.

The persona is coherent — the name, email, address, and birthday all match. It's saved per domain, so if you come back, it remembers who you were on that site. And if you'd rather use your own real details for certain fields (like a password you actually want to keep), you can save a personal profile and GhostForm will use that instead.

Two AI providers. Two fill modes. Full control.

---

## What GhostForm Is Not

- ❌ Not a tool for fraud — fake personas for signups, not for identity theft
- ❌ Not a VPN — it doesn't hide your IP
- ❌ Not a password manager — though it can generate and fill passwords
- ❌ Not a temp email service — it fills a fake email address, it doesn't host an inbox

---

## The Philosophy

> *Privacy shouldn't require technical knowledge. It should be one click.*

Most privacy tools are built for power users — people who know what a DNS resolver is, who can configure WireGuard, who understand what metadata means. GhostForm is built for everyone else.

One icon in your toolbar. One button. Done.

---

## Built With

GhostForm is intentionally simple under the hood:

- **No build step.** No webpack, no bundler, no node_modules to install.
- **No frameworks.** Pure vanilla JavaScript — readable by anyone.
- **No backend for core features.** Everything runs locally in your browser.
- **Two AI options.** Gemini (free, default) and Claude (optional) — user's choice.

The extension is designed so that any developer can open the source, read it in an afternoon, and understand exactly what it does with their data (nothing, except generate a fake name).

---

## Roadmap

- [x] Gemini + Claude multi-provider support
- [x] Custom user profile mode
- [x] User-defined custom fields
- [x] System theme detection + dark/light/manual toggle
- [ ] Firefox extension (v1.2)
- [ ] Cross-device vault sync (Pro)
- [ ] Temp email inbox integration (view OTP emails in popup)
- [ ] Smart fill — detect the purpose of a form (newsletter vs checkout vs account) and adjust persona accordingly
- [ ] Export / import vault as JSON backup
- [ ] Edge and Brave support

---

## Open Source

GhostForm is MIT licensed. The code is on GitHub, readable and forkable.

If you find a bug, open an issue. If you have an idea, open a discussion. If you want to build on top of it, go ahead — that's what the license is for.
