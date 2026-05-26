/**
 * MHD Timetable Card – departure display for Home Assistant Lovelace
 */
var MHD_CARD_VERSION = "0.7.9";
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

  // Read config value with fallback default
  _cfg(key, def) {
    const v = this._config[key];
    return (v !== undefined && v !== null && v !== "") ? v : def;
  }

  _countdownClass(mins) {
    const urgent = this._cfg("urgent_minutes", 5);
    const warning = this._cfg("warning_minutes", 10);
    return mins <= urgent ? "cnt-red" : mins <= warning ? "cnt-yellow" : "cnt-green";
  }

  _render() {
    if (!this._config || !this._hass) return;

    const state = this._hass.states[this._config.entity];
    const attr = state ? state.attributes : {};
    const count = parseInt(this._cfg("departures_count", 3), 10) || 3;
    const departures = (attr.next_departures || []).slice(0, count);
    const stopName = this._cfg("header_text", null) || attr.stop || this._config.entity;
    const rawIcon = this._cfg("header_icon", "🚌");
    const iconHtml = (rawIcon.indexOf("mdi:") === 0 || rawIcon.indexOf("hass:") === 0)
      ? `<ha-icon icon="${rawIcon}" class="header-ha-icon"></ha-icon>`
      : `<span class="header-icon">${rawIcon}</span>`;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="card-header">
          ${iconHtml}
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
    const colorClass = this._countdownClass(mins);
    return `
      <div class="departure" data-idx="${idx}">
        <span class="dep-text">Linka ${dep.line} - Směr ${dep.direction} v ${dep.time}</span>
        <span class="dep-countdown ${colorClass}">(${countdownText})</span>
      </div>`;
  }

  _popupHTML(dep) {
    const stops = dep.route ? dep.route.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];
    const mins = dep.minutes_until;
    const colorClass = this._countdownClass(mins);
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
    this.shadowRoot.querySelectorAll(".departure").forEach(function(el) {
      el.addEventListener("click", function(e) {
        e.stopPropagation();
        var state = this._hass.states[this._config.entity];
        var deps = (state && state.attributes && state.attributes.next_departures) || [];
        var idx = parseInt(el.dataset.idx, 10);
        this._popup = deps[idx] || null;
        this._render();
      }.bind(this));
    }.bind(this));
  }

  _bindPopupEvents() {
    var close = function(e) {
      e.stopPropagation();
      this._popup = null;
      this._render();
    }.bind(this);
    var backdrop = this.shadowRoot.querySelector(".popup-backdrop");
    var closeBtn = this.shadowRoot.querySelector(".popup-close");
    if (backdrop) backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
  }

  _styles() {
    return `
      :host { display: block; }
      ha-card { padding: 0; overflow: hidden; border-radius: var(--ha-card-border-radius, 12px); }

      .card-header {
        display: flex; align-items: center; gap: 8px;
        padding: 14px 16px 12px;
        border-bottom: 1px solid var(--divider-color, rgba(255,255,255,.1));
      }
      .header-icon { font-size: 1.2em; line-height: 1; }
      .header-ha-icon { --mdc-icon-size: 1.3em; color: var(--primary-color); }
      .stop-name { font-size: 1.05em; font-weight: 600; color: var(--primary-text-color); }

      .departures { padding: 4px 0 8px; }
      .empty { padding: 16px; text-align: center; color: var(--secondary-text-color); font-size: 0.95em; }

      .departure {
        padding: 10px 16px; cursor: pointer;
        transition: background 0.15s; line-height: 1.55;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.06));
      }
      .departure:last-child { border-bottom: none; }
      .departure:hover { background: rgba(0,0,0,.06); }

      .dep-text { font-size: 1.05em; font-weight: 600; color: var(--primary-text-color); margin-right: 4px; }
      .dep-countdown { display: block; font-size: 0.95em; font-weight: 600; }
      .cnt-red    { color: var(--error-color, #f44336); }
      .cnt-yellow { color: #f9a825; }
      .cnt-green  { color: #4caf50; }

      /* Popup */
      .popup-backdrop {
        position: fixed; top: 0; right: 0; bottom: 0; left: 0;
        background: rgba(0,0,0,.5); z-index: 999;
      }
      .popup {
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: var(--card-background-color, #1c1c1e);
        border-radius: 16px; z-index: 1000;
        max-height: 80vh; width: calc(100vw - 32px); max-width: 520px;
        overflow-y: auto; box-shadow: 0 16px 48px rgba(0,0,0,.45);
      }
      .popup-header {
        display: flex; align-items: center; gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--divider-color, rgba(255,255,255,.1));
        position: sticky; top: 0;
        background: var(--card-background-color, #1c1c1e);
      }
      .popup-close {
        background: none; border: none; font-size: 1.1em; cursor: pointer;
        color: var(--secondary-text-color); padding: 4px; flex-shrink: 0; line-height: 1;
      }
      .popup-title { font-size: 1.05em; font-weight: 700; color: var(--primary-text-color); }
      .popup-body { padding: 16px 20px 20px; }
      .popup-time-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
      .popup-time-label { font-size: 0.95em; color: var(--secondary-text-color); }
      .popup-badge { padding: 3px 10px; border-radius: 20px; font-size: 0.82em; font-weight: 700; background: rgba(0,0,0,.15); }
      .popup-badge.cnt-red    { color: var(--error-color, #f44336); border: 1px solid var(--error-color, #f44336); }
      .popup-badge.cnt-yellow { color: #f9a825; border: 1px solid #f9a825; }
      .popup-badge.cnt-green  { color: #4caf50; border: 1px solid #4caf50; }
      .popup-route { font-size: 0.92em; color: var(--secondary-text-color); line-height: 1.7; margin: 0; }
      .popup-no-route { color: var(--secondary-text-color); font-size: 0.9em; margin: 0; }
    `;
  }

  static getConfigElement() {
    return document.createElement("mhd-timetable-card-editor");
  }

  static getStubConfig(hass) {
    var entity = "";
    if (hass) {
      var found = Object.keys(hass.states).find(function(id) {
        return id.indexOf("sensor.mhd_") === 0;
      });
      if (found) entity = found;
    }
    return {
      entity: entity,
      departures_count: 3,
      header_icon: "🚌",
      urgent_minutes: 5,
      warning_minutes: 10,
    };
  }
}

// ---------------------------------------------------------------------------
// Visual card editor – accordion sections, live preview via HA
// ---------------------------------------------------------------------------
class MHDTimetableCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    var picker = this.querySelector("#mhd-ep");
    if (picker) picker.hass = hass;
  }

  _fire() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true, composed: true,
    }));
  }

  _render() {
    var c = this._config || {};
    var entity     = c.entity || "";
    var headerText = c.header_text || "";
    var count      = c.departures_count !== undefined ? c.departures_count : 3;
    var icon       = c.header_icon !== undefined ? c.header_icon : "🚌";
    var urgent     = c.urgent_minutes !== undefined ? c.urgent_minutes : 5;
    var warning    = c.warning_minutes !== undefined ? c.warning_minutes : 10;
    var isMdi      = icon.indexOf("mdi:") === 0 || icon.indexOf("hass:") === 0;

    this.innerHTML = `
      <style>
        .ew { border: 1px solid var(--divider-color, rgba(0,0,0,.15)); border-radius: 12px; overflow: hidden; }

        .ew-title {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 16px;
          background: var(--secondary-background-color);
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.1));
        }
        .ew-title-name { font-weight: 700; font-size: 0.95em; color: var(--primary-text-color); }
        .ew-version {
          font-size: 0.7em; padding: 2px 9px;
          border: 1px solid var(--divider-color, rgba(0,0,0,.2));
          border-radius: 12px; color: var(--secondary-text-color);
        }

        details { border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.08)); }
        details:last-child { border-bottom: none; }

        summary {
          padding: 13px 16px; cursor: pointer;
          font-weight: 600; font-size: 0.9em;
          color: var(--primary-text-color);
          display: flex; align-items: center; justify-content: space-between;
          list-style: none; user-select: none;
          transition: background 0.15s;
        }
        summary::-webkit-details-marker { display: none; }
        summary::after { content: "▼"; font-size: 0.6em; color: var(--secondary-text-color); transition: transform 0.2s; }
        details[open] > summary::after { transform: rotate(180deg); }
        summary:hover { background: var(--secondary-background-color); }

        .sb {
          padding: 12px 16px 16px;
          border-top: 1px solid var(--divider-color, rgba(0,0,0,.06));
        }

        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
        .row.full { grid-template-columns: 1fr; }
        .field label {
          display: block; font-size: 0.75em; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--secondary-text-color); margin-bottom: 5px;
        }
        .hint { font-size: 0.74em; color: var(--secondary-text-color); margin-top: 4px; line-height: 1.4; }

        input[type="text"], input[type="number"] {
          width: 100%; box-sizing: border-box; padding: 9px 11px;
          border: 1px solid var(--divider-color, rgba(0,0,0,.2)); border-radius: 8px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color); font-size: 0.92em; font-family: inherit;
          transition: border-color 0.15s;
        }
        input:focus { outline: none; border-color: var(--primary-color); }

        .icon-prev { display: flex; align-items: center; gap: 7px; margin-top: 6px; }
        .icon-prev .pi { font-size: 1.5em; line-height: 1; }
        .icon-prev .pl { font-size: 0.76em; color: var(--secondary-text-color); }

        .legend {
          display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px;
          padding: 9px 12px; border-radius: 8px;
          background: var(--secondary-background-color);
        }
        .li { display: flex; align-items: center; gap: 5px; font-size: 0.8em; color: var(--secondary-text-color); }
        .sw { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
        .sw-r { background: #f44336; }
        .sw-y { background: #f9a825; }
        .sw-g { background: #4caf50; }
      </style>

      <div class="ew">
        <div class="ew-title">
          <span class="ew-title-name">MHD Jízdní řády</span>
          <span class="ew-version">${MHD_CARD_VERSION}</span>
        </div>

        <details open>
          <summary>Zastávka</summary>
          <div class="sb">
            <div class="row full">
              <div class="field">
                <label>Senzor zastávky</label>
                <ha-entity-picker id="mhd-ep" allow-custom-entity></ha-entity-picker>
                <p class="hint">Sensor zastávky vytvořený doplňkem MHD.</p>
              </div>
            </div>
            <div class="row full" style="margin-top:10px">
              <div class="field">
                <label>Vlastní název zastávky</label>
                <input name="header_text" type="text" value="${headerText}" placeholder="Ponech prázdné = název z integrace">
                <p class="hint">Přepíše název zobrazený v hlavičce karty.</p>
              </div>
            </div>
          </div>
        </details>

        <details>
          <summary>Zobrazení</summary>
          <div class="sb">
            <div class="row">
              <div class="field">
                <label>Počet odjezdů</label>
                <input name="departures_count" type="number" min="1" max="10" value="${count}">
                <p class="hint">Nejbližších spojů (1–10, výchozí 3)</p>
              </div>
              <div class="field">
                <label>Ikona</label>
                <input name="header_icon" type="text" value="${icon}" placeholder="🚌 nebo mdi:bus">
                <div class="icon-prev">
                  ${isMdi
                    ? `<ha-icon icon="${icon}" style="--mdc-icon-size:1.4em;color:var(--primary-color)"></ha-icon>`
                    : `<span class="pi">${icon}</span>`}
                  <span class="pl icon-label">${isMdi ? icon : "emoji ikona"}</span>
                </div>
              </div>
            </div>
          </div>
        </details>

        <details>
          <summary>Barvy odjezdů</summary>
          <div class="sb">
            <div class="row">
              <div class="field">
                <label>🔴 Červená pod</label>
                <input name="urgent_minutes" type="number" min="1" max="30" value="${urgent}">
                <p class="hint">minut do odjezdu (výchozí 5)</p>
              </div>
              <div class="field">
                <label>🟡 Žlutá pod</label>
                <input name="warning_minutes" type="number" min="1" max="60" value="${warning}">
                <p class="hint">minut do odjezdu (výchozí 10)</p>
              </div>
            </div>
            <div class="legend">
              <div class="li"><div class="sw sw-r"></div><span class="leg-u">do ${urgent} min</span></div>
              <div class="li"><div class="sw sw-y"></div><span class="leg-w">${urgent}–${warning} min</span></div>
              <div class="li"><div class="sw sw-g"></div><span class="leg-o">nad ${warning} min</span></div>
            </div>
          </div>
        </details>
      </div>
    `;

    this._bindInputs();
    this._setupEntityPicker(entity);
  }

  _setupEntityPicker(entity) {
    var self = this;
    var picker = this.querySelector("#mhd-ep");
    if (!picker) return;
    picker.hass = this._hass;
    picker.value = entity;
    picker.includeDomains = ["sensor"];
    picker.addEventListener("value-changed", function(e) {
      self._config = Object.assign({}, self._config);
      self._config.entity = e.detail.value || "";
      self._fire();
    });
  }

  _bindInputs() {
    var self = this;
    this.querySelectorAll("input").forEach(function(input) {
      input.addEventListener("change", function(e) {
        var name = e.target.name;
        var value = e.target.value;
        if (e.target.type === "number") {
          value = parseInt(value, 10);
          if (isNaN(value) || value < 1) value = 1;
        }
        self._config = Object.assign({}, self._config);
        self._config[name] = value;
        self._fire();
        if (name === "urgent_minutes" || name === "warning_minutes") {
          self._updateLegend();
        }
        if (name === "header_icon") {
          self._updateIconPreview(value);
        }
      });
    });
  }

  _updateLegend() {
    var urgent = this._config.urgent_minutes || 5;
    var warning = this._config.warning_minutes || 10;
    var u = this.querySelector(".leg-u");
    var w = this.querySelector(".leg-w");
    var o = this.querySelector(".leg-o");
    if (u) u.textContent = "do " + urgent + " min";
    if (w) w.textContent = urgent + "–" + warning + " min";
    if (o) o.textContent = "nad " + warning + " min";
  }

  _updateIconPreview(icon) {
    var isMdi = icon.indexOf("mdi:") === 0 || icon.indexOf("hass:") === 0;
    var prev = this.querySelector(".icon-prev");
    if (!prev) return;
    var label = prev.querySelector(".icon-label");
    var pi = prev.querySelector(".pi");
    var haIcon = prev.querySelector("ha-icon");
    if (isMdi) {
      if (pi) { pi.style.display = "none"; }
      if (!haIcon) {
        var el = document.createElement("ha-icon");
        el.setAttribute("style", "--mdc-icon-size:1.4em;color:var(--primary-color)");
        prev.insertBefore(el, prev.firstChild);
        haIcon = el;
      }
      haIcon.setAttribute("icon", icon);
      haIcon.style.display = "";
    } else {
      if (haIcon) haIcon.style.display = "none";
      if (!pi) {
        var span = document.createElement("span");
        span.className = "pi";
        prev.insertBefore(span, prev.firstChild);
        pi = span;
      }
      pi.textContent = icon;
      pi.style.display = "";
    }
    if (label) label.textContent = isMdi ? icon : "emoji ikona";
  }
}

if (!customElements.get("mhd-timetable-card")) {
  customElements.define("mhd-timetable-card", MHDTimetableCard);
}
if (!customElements.get("mhd-timetable-card-editor")) {
  customElements.define("mhd-timetable-card-editor", MHDTimetableCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "mhd-timetable-card",
  name: "MHD Jízdní řády",
  description: "Zobrazí příští odjezdy z vybrané zastávky.",
  preview: true,
  documentationURL: "https://github.com/smarthome4u/ha-mhd-timetable",
});
