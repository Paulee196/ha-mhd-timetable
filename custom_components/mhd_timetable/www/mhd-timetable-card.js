/**
 * MHD Timetable Card – departure display for Home Assistant Lovelace
 */
class MHDTimetableCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._popup = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("entity is required");
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._popup) this._render();
  }

  _render() {
    if (!this._config || !this._hass) return;

    const state = this._hass.states[this._config.entity];
    const attr = state ? state.attributes : {};
    const departures = attr.next_departures || [];
    const stopName = attr.stop || this._config.entity;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="card-header">
          <span class="header-icon">🚌</span>
          <span class="stop-name">${stopName}</span>
        </div>
        <div class="departures">
          ${departures.length === 0
            ? `<div class="empty">Žádné nadcházející spoje</div>`
            : departures.map((d, i) => this._depHTML(d, i)).join("")}
        </div>
      </ha-card>
      ${this._popup ? this._popupHTML(this._popup) : ""}
    `;

    this._bindCardEvents();
    if (this._popup) this._bindPopupEvents();
  }

  _depHTML(dep, idx) {
    const mins = dep.minutes_until;
    const countdownText = mins === 0 ? "Teď!" : `za ${mins} min`;
    const colorClass = mins <= 5 ? "cnt-red" : mins <= 10 ? "cnt-yellow" : "cnt-green";
    return `
      <div class="departure" data-idx="${idx}">
        <span class="dep-text">Linka ${dep.line} - Směr ${dep.direction} v ${dep.time}</span>
        <span class="dep-countdown ${colorClass}">(${countdownText})</span>
      </div>`;
  }

  _popupHTML(dep) {
    const stops = dep.route ? dep.route.split(",").map(s => s.trim()).filter(Boolean) : [];
    const mins = dep.minutes_until;
    const colorClass = mins <= 5 ? "cnt-red" : mins <= 10 ? "cnt-yellow" : "cnt-green";
    return `
      <div class="popup-backdrop"></div>
      <div class="popup" role="dialog" aria-modal="true">
        <div class="popup-header">
          <button class="popup-close" aria-label="Zavřít">✕</button>
          <span class="popup-title">Linka ${dep.line} - Směr ${dep.direction}</span>
        </div>
        <div class="popup-body">
          <div class="popup-time-row">
            <span class="popup-time-label">Odjezd v <strong>${dep.time}</strong></span>
            <span class="popup-badge ${colorClass}">za ${mins} min</span>
          </div>
          ${stops.length > 0
            ? `<p class="popup-route">${stops.join(", ")}</p>`
            : `<p class="popup-no-route">Trasa není k dispozici.</p>`}
        </div>
      </div>`;
  }

  _bindCardEvents() {
    this.shadowRoot.querySelectorAll(".departure").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const state = this._hass.states[this._config.entity];
        const deps = (state?.attributes?.next_departures) || [];
        const idx = parseInt(el.dataset.idx, 10);
        this._popup = deps[idx] || null;
        this._render();
      });
    });
  }

  _bindPopupEvents() {
    const close = (e) => {
      e.stopPropagation();
      this._popup = null;
      this._render();
    };
    this.shadowRoot.querySelector(".popup-backdrop")?.addEventListener("click", close);
    this.shadowRoot.querySelector(".popup-close")?.addEventListener("click", close);
  }

  _styles() {
    return `
      :host { display: block; }

      ha-card {
        padding: 0;
        overflow: hidden;
        border-radius: var(--ha-card-border-radius, 12px);
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 16px 12px;
        border-bottom: 1px solid var(--divider-color, rgba(255,255,255,.1));
      }

      .header-icon { font-size: 1.2em; line-height: 1; }

      .stop-name {
        font-size: 1.05em;
        font-weight: 600;
        color: var(--primary-text-color);
      }

      .departures { padding: 4px 0 8px; }

      .empty {
        padding: 16px;
        text-align: center;
        color: var(--secondary-text-color);
        font-size: 0.95em;
      }

      .departure {
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.15s;
        line-height: 1.55;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.06));
      }
      .departure:last-child { border-bottom: none; }
      .departure:hover { background: rgba(0,0,0,.06); }

      .dep-text {
        font-size: 1.05em;
        font-weight: 600;
        color: var(--primary-text-color);
        margin-right: 4px;
      }

      .dep-countdown {
        display: block;
        font-size: 0.95em;
        font-weight: 600;
      }

      .cnt-red    { color: var(--error-color, #f44336); }
      .cnt-yellow { color: #f9a825; }
      .cnt-green  { color: #4caf50; }

      /* Popup - centered modal */
      .popup-backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.5);
        z-index: 999;
      }
      .popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--card-background-color, #1c1c1e);
        border-radius: 16px;
        z-index: 1000;
        max-height: 80vh;
        width: min(520px, calc(100vw - 32px));
        overflow-y: auto;
        box-shadow: 0 16px 48px rgba(0,0,0,.45);
      }
      .popup-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--divider-color, rgba(255,255,255,.1));
        position: sticky; top: 0;
        background: var(--card-background-color, #1c1c1e);
      }
      .popup-close {
        background: none; border: none;
        font-size: 1.1em; cursor: pointer;
        color: var(--secondary-text-color);
        padding: 4px; flex-shrink: 0;
        line-height: 1;
      }
      .popup-title {
        font-size: 1.05em;
        font-weight: 700;
        color: var(--primary-text-color);
      }
      .popup-body { padding: 16px 20px 20px; }
      .popup-time-row {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 14px;
        flex-wrap: wrap;
      }
      .popup-time-label {
        font-size: 0.95em;
        color: var(--secondary-text-color);
      }
      .popup-badge {
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 0.82em;
        font-weight: 700;
        background: rgba(0,0,0,.15);
      }
      .popup-badge.cnt-red    { color: var(--error-color, #f44336); border: 1px solid var(--error-color, #f44336); }
      .popup-badge.cnt-yellow { color: #f9a825; border: 1px solid #f9a825; }
      .popup-badge.cnt-green  { color: #4caf50; border: 1px solid #4caf50; }
      .popup-route {
        font-size: 0.92em;
        color: var(--secondary-text-color);
        line-height: 1.7;
        margin: 0;
      }
      .popup-no-route { color: var(--secondary-text-color); font-size: 0.9em; margin: 0; }
    `;
  }

  static getConfigElement() {
    return document.createElement("mhd-timetable-card-editor");
  }

  static getStubConfig() {
    return { entity: "sensor.mhd_next" };
  }
}

// Card editor for Lovelace sidebar config panel
class MHDTimetableCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; }

  _render() {
    this.innerHTML = `
      <style>
        .row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
        label { font-size: 0.8em; font-weight: 600; color: #666; text-transform: uppercase; }
        input { padding: 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.95em; }
      </style>
      <div class="row">
        <label>Entity (senzor zastávky)</label>
        <input id="entity" value="${this._config?.entity || ""}" placeholder="sensor.mhd_...">
      </div>
    `;
    this.querySelector("#entity").addEventListener("change", e => {
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: { ...this._config, entity: e.target.value } },
        bubbles: true, composed: true,
      }));
    });
  }
}

customElements.define("mhd-timetable-card", MHDTimetableCard);
customElements.define("mhd-timetable-card-editor", MHDTimetableCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "mhd-timetable-card",
  name: "MHD Jízdní řády",
  description: "Zobrazí příští odjezdy z vybrané zastávky.",
  preview: true,
  documentationURL: "https://github.com/smarthome4u/ha-mhd-timetable",
});
