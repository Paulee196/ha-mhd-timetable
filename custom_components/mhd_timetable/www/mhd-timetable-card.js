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
    const stops = dep.route ? dep.route.split(",").map(s => s.trim()) : [];
    return `
      <div class="popup-backdrop"></div>
      <div class="popup" role="dialog" aria-modal="true">
        <div class="popup-header">
          <div>
            <span class="popup-line">Linka ${dep.line}</span>
            <span class="popup-dir">Směr ${dep.direction}</span>
          </div>
          <button class="popup-close">✕</button>
        </div>
        <div class="popup-body">
          <p class="popup-time">Odjezd v <strong>${dep.time}</strong> (za ${dep.minutes_until} min)</p>
          ${stops.length > 0
            ? `<div class="route-list">${stops.map((s, i) =>
                `<div class="route-stop${i === 0 ? " first" : ""}">
                  <span class="stop-dot"></span>${s}
                </div>`).join("")}</div>`
            : `<p class="no-route">Trasa není k dispozici.</p>`}
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
        background: rgba(0,0,0,.45);
        z-index: 999;
      }
      .popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--card-background-color, #fff);
        border-radius: 14px;
        z-index: 1000;
        max-height: 80vh;
        width: min(480px, calc(100vw - 32px));
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,.3);
      }
      .popup-header {
        display: flex; align-items: flex-start; justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12));
        position: sticky; top: 0;
        background: var(--card-background-color, #fff);
      }
      .popup-line {
        font-size: 1.1em; font-weight: 700;
        color: var(--primary-color);
        margin-right: 8px;
      }
      .popup-dir { font-size: 1em; color: var(--primary-text-color); }
      .popup-close {
        background: none; border: none; font-size: 1.3em;
        cursor: pointer; padding: 0 4px; color: var(--secondary-text-color);
      }
      .popup-body { padding: 16px; }
      .popup-time { margin: 0 0 12px; color: var(--secondary-text-color); font-size: 0.9em; }
      .route-list { display: flex; flex-direction: column; }
      .route-stop {
        display: flex; align-items: center; gap: 10px;
        padding: 6px 0;
        font-size: 0.9em;
        color: var(--primary-text-color);
        border-left: 2px solid var(--divider-color, #ccc);
        padding-left: 12px;
        margin-left: 6px;
      }
      .route-stop.first { font-weight: 600; border-left-color: var(--primary-color); }
      .stop-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: var(--primary-color);
        flex-shrink: 0;
        margin-left: -17px;
      }
      .no-route { color: var(--secondary-text-color); font-size: 0.9em; }
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
