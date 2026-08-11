#!/usr/bin/env node
// Regression check for the frontend card/panel modules.
//
// This exists because of a real incident: ha-timetable-card.js registered
// the same class under two custom element names via two calls to
// customElements.define(). Real browsers throw on the second call ("this
// constructor has already been used with this registry"), which aborted
// the rest of the module - including the code that makes the card show up
// in the Lovelace "add card" picker - on every browser, silently, with no
// server-side symptom at all. Nothing short of loading the file the way a
// browser does would have caught it.
//
// This script stubs just enough of the browser environment (a spec-accurate
// CustomElementRegistry, HTMLElement, window/navigator/document) to import
// both modules under Node exactly like the frontend does, and fails the
// build if:
//   - importing either module throws (e.g. the duplicate-registration bug),
//   - the expected custom elements did not end up registered,
//   - the card did not register itself in window.customCards.
//
// Run: node .github/scripts/check-frontend-modules.mjs

import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const wwwDir = path.join(here, "..", "..", "custom_components", "mhd_timetable", "www");

class FakeCustomElementRegistry {
  constructor() {
    this._byName = new Map();
    this._usedCtors = new Set();
  }
  get(name) {
    return this._byName.get(name);
  }
  define(name, ctor) {
    if (this._byName.has(name)) {
      throw new DOMExceptionLike(
        `Failed to execute 'define' on 'CustomElementRegistry': the name "${name}" has already been used with this registry`
      );
    }
    if (this._usedCtors.has(ctor)) {
      throw new DOMExceptionLike(
        "Failed to execute 'define' on 'CustomElementRegistry': this constructor has already been used with this registry"
      );
    }
    this._byName.set(name, ctor);
    this._usedCtors.add(ctor);
  }
}

class DOMExceptionLike extends Error {
  constructor(message) {
    super(message);
    this.name = "DOMException";
  }
}

function installBrowserStubs() {
  globalThis.HTMLElement = class HTMLElement {
    attachShadow() {
      return { innerHTML: "", appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    addEventListener() {}
    removeEventListener() {}
    setAttribute() {}
    getAttribute() { return null; }
    dispatchEvent() { return true; }
  };
  globalThis.customElements = new FakeCustomElementRegistry();
  globalThis.window = globalThis;
  // Node >= 21 ships a read-only `navigator` global without `.language`;
  // override it with a plain, writable stub instead of assigning into it.
  Object.defineProperty(globalThis, "navigator", {
    value: { language: "en-US" },
    configurable: true,
    writable: true,
  });
  globalThis.document = globalThis.document || {
    createElement: () => new globalThis.HTMLElement(),
    head: { appendChild() {} },
    querySelector: () => null,
    addEventListener() {},
  };
  globalThis.CustomEvent = globalThis.CustomEvent || class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init && init.detail; }
  };
}

const checks = [
  {
    file: "ha-timetable-card.js",
    expectElements: ["ha-timetable-card", "mhd-timetable-card", "ha-timetable-card-editor", "mhd-timetable-card-editor"],
    expectCustomCardType: "ha-timetable-card",
  },
  {
    file: "ha-timetable-panel.js",
    expectElements: ["ha-timetable-panel", "mhd-timetable-panel"],
    expectCustomCardType: null,
  },
  {
    // The loader has no query string here, so it falls back to importing
    // "./ha-timetable-card.js" with no ?v= - still the real file, still
    // proves the retrying import actually resolves and registers the card.
    file: "ha-timetable-loader.js",
    expectElements: ["ha-timetable-card"],
    expectCustomCardType: "ha-timetable-card",
  },
];

let failed = false;

for (const check of checks) {
  installBrowserStubs();
  const fileUrl = pathToFileURL(path.join(wwwDir, check.file)).href + `?check=${Date.now()}`;
  try {
    await import(fileUrl);
  } catch (err) {
    failed = true;
    console.error(`FAIL: importing ${check.file} threw:`);
    console.error(err);
    continue;
  }

  for (const name of check.expectElements) {
    if (!customElements.get(name)) {
      failed = true;
      console.error(`FAIL: ${check.file} did not register custom element "${name}"`);
    }
  }

  if (check.expectCustomCardType) {
    const list = Array.isArray(window.customCards) ? window.customCards : [];
    const found = list.some((c) => c.type === check.expectCustomCardType);
    if (!found) {
      failed = true;
      console.error(`FAIL: ${check.file} did not push a window.customCards entry of type "${check.expectCustomCardType}"`);
    }
  }

  if (!failed) {
    console.log(`OK: ${check.file}`);
  }
}

if (failed) {
  process.exit(1);
}
