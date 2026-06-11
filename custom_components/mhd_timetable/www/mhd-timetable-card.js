/**
 * MHD Timetable Card – departure display for Home Assistant Lovelace
 */
var MHD_CARD_VERSION = "0.10.2";
// The card is always loaded as an ES module (?v= set by __init__.py), so the
// badge follows the installed version automatically; the constant is a fallback.
try {
  var _mhdV = new URL(import.meta.url).searchParams.get("v");
  if (_mhdV) MHD_CARD_VERSION = _mhdV;
} catch (_e) { /* keep fallback */ }

var MHD_I18N = {
  cs: {
    no_departures: "Žádné nadcházející spoje",
    now: "Teď!", in_min: "za {0} min",
    line_word: "Linka",
    dep_text: "{0} - Směr {1} v {2}",
    popup_title: "{0} - Směr {1}",
    departure_at: "Odjezd v <strong>{0}</strong>",
    no_route: "Trasa není k dispozici.",
    ed_title: "Jízdní řády",
    sec_stop: "Zastávka", sensor_label: "Senzor zastávky",
    sensor_hint: "Senzor zastávky vytvořený doplňkem.",
    custom_name: "Vlastní název zastávky", custom_name_ph: "Ponechte prázdné = název z integrace",
    custom_name_hint: "Přepíše název zobrazený v hlavičce karty.",
    sec_display: "Zobrazení", dep_count: "Počet odjezdů", dep_count_hint: "Nejbližších spojů (1–10, výchozí 3)",
    sec_colors: "Barvy odjezdů", home_stop: "Domovská zastávka",
    red_below: "🔴 Červená pod", yellow_below: "🟡 Žlutá pod",
    min_default: "minut (výchozí {0})", min_inherit: "minut (prázdné = jako domovská)",
    leg_under: "do {0} min", leg_between: "{0}–{1} min", leg_over: "nad {0} min",
    cc_desc: "Zobrazí příští odjezdy z vybrané zastávky.",
  },
  sk: {
    no_departures: "Žiadne nadchádzajúce spoje",
    now: "Teraz!", in_min: "o {0} min",
    line_word: "Linka",
    dep_text: "{0} - Smer {1} o {2}",
    popup_title: "{0} - Smer {1}",
    departure_at: "Odchod o <strong>{0}</strong>",
    no_route: "Trasa nie je k dispozícii.",
    ed_title: "Cestovné poriadky",
    sec_stop: "Zastávka", sensor_label: "Senzor zastávky",
    sensor_hint: "Senzor zastávky vytvorený doplnkom.",
    custom_name: "Vlastný názov zastávky", custom_name_ph: "Nechajte prázdne = názov z integrácie",
    custom_name_hint: "Prepíše názov zobrazený v hlavičke karty.",
    sec_display: "Zobrazenie", dep_count: "Počet odchodov", dep_count_hint: "Najbližších spojov (1–10, predvolené 3)",
    sec_colors: "Farby odchodov", home_stop: "Domovská zastávka",
    red_below: "🔴 Červená pod", yellow_below: "🟡 Žltá pod",
    min_default: "minút (predvolené {0})", min_inherit: "minút (prázdne = ako domovská)",
    leg_under: "do {0} min", leg_between: "{0}–{1} min", leg_over: "nad {0} min",
    cc_desc: "Zobrazí najbližšie odchody z vybranej zastávky.",
  },
  en: {
    no_departures: "No upcoming departures",
    now: "Now!", in_min: "in {0} min",
    line_word: "Line",
    dep_text: "{0} - To {1} at {2}",
    popup_title: "{0} - To {1}",
    departure_at: "Departure at <strong>{0}</strong>",
    no_route: "Route not available.",
    ed_title: "Timetables",
    sec_stop: "Stop", sensor_label: "Stop sensor",
    sensor_hint: "Stop sensor created by the integration.",
    custom_name: "Custom stop name", custom_name_ph: "Leave empty = name from the integration",
    custom_name_hint: "Overrides the name shown in the card header.",
    sec_display: "Display", dep_count: "Number of departures", dep_count_hint: "Upcoming departures (1–10, default 3)",
    sec_colors: "Departure colors", home_stop: "Home stop",
    red_below: "🔴 Red below", yellow_below: "🟡 Yellow below",
    min_default: "minutes (default {0})", min_inherit: "minutes (empty = same as home)",
    leg_under: "under {0} min", leg_between: "{0}–{1} min", leg_over: "over {0} min",
    cc_desc: "Shows the next departures from a selected stop.",
  },
  de: {
    no_departures: "Keine bevorstehenden Abfahrten",
    now: "Jetzt!", in_min: "in {0} Min.",
    line_word: "Linie",
    dep_text: "{0} - Richtung {1} um {2}",
    popup_title: "{0} - Richtung {1}",
    departure_at: "Abfahrt um <strong>{0}</strong>",
    no_route: "Strecke nicht verfügbar.",
    ed_title: "Fahrpläne",
    sec_stop: "Haltestelle", sensor_label: "Haltestellen-Sensor",
    sensor_hint: "Von der Integration erstellter Haltestellen-Sensor.",
    custom_name: "Eigener Haltestellenname", custom_name_ph: "Leer lassen = Name aus der Integration",
    custom_name_hint: "Überschreibt den Namen in der Kartenüberschrift.",
    sec_display: "Anzeige", dep_count: "Anzahl der Abfahrten", dep_count_hint: "Nächste Abfahrten (1–10, Standard 3)",
    sec_colors: "Abfahrtsfarben", home_stop: "Heimathaltestelle",
    red_below: "🔴 Rot unter", yellow_below: "🟡 Gelb unter",
    min_default: "Minuten (Standard {0})", min_inherit: "Minuten (leer = wie Heimathaltestelle)",
    leg_under: "unter {0} Min.", leg_between: "{0}–{1} Min.", leg_over: "über {0} Min.",
    cc_desc: "Zeigt die nächsten Abfahrten einer gewählten Haltestelle.",
  },
  fr: {
    no_departures: "Aucun départ à venir",
    now: "Maintenant !", in_min: "dans {0} min",
    line_word: "Ligne",
    dep_text: "{0} - Direction {1} à {2}",
    popup_title: "{0} - Direction {1}",
    departure_at: "Départ à <strong>{0}</strong>",
    no_route: "Itinéraire non disponible.",
    ed_title: "Horaires",
    sec_stop: "Arrêt", sensor_label: "Capteur de l'arrêt",
    sensor_hint: "Capteur de l'arrêt créé par l'intégration.",
    custom_name: "Nom personnalisé de l'arrêt", custom_name_ph: "Laisser vide = nom de l'intégration",
    custom_name_hint: "Remplace le nom affiché dans l'en-tête de la carte.",
    sec_display: "Affichage", dep_count: "Nombre de départs", dep_count_hint: "Prochains départs (1–10, défaut 3)",
    sec_colors: "Couleurs des départs", home_stop: "Arrêt principal",
    red_below: "🔴 Rouge sous", yellow_below: "🟡 Jaune sous",
    min_default: "minutes (défaut {0})", min_inherit: "minutes (vide = comme l'arrêt principal)",
    leg_under: "moins de {0} min", leg_between: "{0}–{1} min", leg_over: "plus de {0} min",
    cc_desc: "Affiche les prochains départs d'un arrêt sélectionné.",
  },
  es: {
    no_departures: "Sin salidas próximas",
    now: "¡Ahora!", in_min: "en {0} min",
    line_word: "Línea",
    dep_text: "{0} - Dirección {1} a las {2}",
    popup_title: "{0} - Dirección {1}",
    departure_at: "Salida a las <strong>{0}</strong>",
    no_route: "Recorrido no disponible.",
    ed_title: "Horarios",
    sec_stop: "Parada", sensor_label: "Sensor de la parada",
    sensor_hint: "Sensor de la parada creado por la integración.",
    custom_name: "Nombre personalizado de la parada", custom_name_ph: "Dejar vacío = nombre de la integración",
    custom_name_hint: "Sustituye el nombre mostrado en la cabecera de la tarjeta.",
    sec_display: "Visualización", dep_count: "Número de salidas", dep_count_hint: "Próximas salidas (1–10, predeterminado 3)",
    sec_colors: "Colores de salidas", home_stop: "Parada principal",
    red_below: "🔴 Rojo por debajo de", yellow_below: "🟡 Amarillo por debajo de",
    min_default: "minutos (predeterminado {0})", min_inherit: "minutos (vacío = como la principal)",
    leg_under: "menos de {0} min", leg_between: "{0}–{1} min", leg_over: "más de {0} min",
    cc_desc: "Muestra las próximas salidas de una parada seleccionada.",
  },
};

function mhdLang(hass) {
  var l = ((hass && (hass.language || (hass.locale || {}).language)) || "en").toLowerCase().split("-")[0];
  return MHD_I18N[l] ? l : "en";
}

function mhdT(hass, key) {
  var lang = mhdLang(hass);
  var s = MHD_I18N[lang] ? MHD_I18N[lang][key] : undefined;
  if (s === undefined) s = MHD_I18N.en[key];
  if (s === undefined) s = key;
  for (var i = 2; i < arguments.length; i++) s = s.replace("{" + (i - 2) + "}", arguments[i]);
  return s;
}
class MHDTimetableCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._popup = null;
    this._displayDeps = [];
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

  _typeIcon(type) {
    var icons = { bus: "🚌", trolleybus: "🚎", trolejbus: "🚎", tram: "🚋", tramvaj: "🚋", train: "🚂", vlak: "🚂" };
    return icons[type] || "🚌";
  }

  _stopIcon(type) {
    var icons = { train: "🚉", vlak: "🚉", tram: "🚊", tramvaj: "🚊", trolleybus: "🚏", trolejbus: "🚏", bus: "🚏" };
    return icons[type] || "🚏";
  }

  _countdownClass(mins, stop) {
    var homeStop = this._hass && this._hass.states[this._config.entity]
      ? (this._hass.states[this._config.entity].attributes || {}).stop : "";
    var isOther = stop && homeStop && stop !== homeStop;
    var thresholds = isOther ? ((this._config.stop_thresholds || {})[stop] || {}) : {};
    var urgent  = isOther ? (thresholds.urgent_minutes  || this._cfg("urgent_minutes", 5))  : this._cfg("urgent_minutes", 5);
    var warning = isOther ? (thresholds.warning_minutes || this._cfg("warning_minutes", 10)) : this._cfg("warning_minutes", 10);
    return mins <= urgent ? "cnt-red" : mins <= warning ? "cnt-yellow" : "cnt-green";
  }

  _render() {
    if (!this._config || !this._hass) return;

    const state = this._hass.states[this._config.entity];
    const attr = state ? state.attributes : {};
    const count = parseInt(this._cfg("departures_count", 3), 10) || 3;
    const allDeps = (attr.next_departures || []).slice(0, count);
    const homeStop = attr.stop || this._config.entity;
    const stopName = this._cfg("header_text", null) || homeStop;

    // Split into home-stop departures and other-stop groups
    var homeDeps = allDeps.filter(function(d) { return !d.stop || d.stop === homeStop; });
    var otherDeps = allDeps.filter(function(d) { return d.stop && d.stop !== homeStop; });

    var otherGroups = {};
    otherDeps.forEach(function(d) {
      if (!otherGroups[d.stop]) otherGroups[d.stop] = [];
      otherGroups[d.stop].push(d);
    });

    // Build ordered list for popup lookup
    this._displayDeps = homeDeps.slice();
    Object.keys(otherGroups).forEach(function(s) {
      otherGroups[s].forEach(function(d) { this._displayDeps.push(d); }.bind(this));
    }.bind(this));

    // Build departures HTML
    var depsHtml = "";
    if (allDeps.length === 0) {
      depsHtml = `<div class="empty">${mhdT(this._hass, "no_departures")}</div>`;
    } else {
      var idx = 0;
      var self = this;
      homeDeps.forEach(function(d) { depsHtml += self._depHTML(d, idx++); });
      Object.keys(otherGroups).forEach(function(stop) {
        var stopIco = self._stopIcon(otherGroups[stop][0].transport_type);
        depsHtml += `<div class="other-stop-sep"><span>${stopIco} ${stop}</span></div>`;
        otherGroups[stop].forEach(function(d) { depsHtml += self._depHTML(d, idx++); });
      });
    }

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="card-header">
          <span class="header-home-icon">🏠</span>
          <span class="stop-name">${stopName}</span>
        </div>
        <div class="departures">
          ${depsHtml}
        </div>
      </ha-card>
      ${this._popup ? this._popupHTML(this._popup) : ""}
    `;

    this._bindCardEvents();
    if (this._popup) this._bindPopupEvents();
  }

  _depHTML(dep, idx) {
    const mins = dep.minutes_until;
    const countdownText = mins === 0 ? mhdT(this._hass, "now") : mhdT(this._hass, "in_min", mins);
    const colorClass = this._countdownClass(mins, dep.stop);
    const icon = this._typeIcon(dep.transport_type);
    const lineLabel = dep.transport_type === "train" ? dep.line : mhdT(this._hass, "line_word") + " " + dep.line;
    return `
      <div class="departure" data-idx="${idx}">
        <span class="dep-text"><span class="dep-type-icon">${icon}</span> ${mhdT(this._hass, "dep_text", lineLabel, dep.direction, dep.time)}</span>
        <span class="dep-countdown ${colorClass}">(${countdownText})</span>
      </div>`;
  }

  _popupHTML(dep) {
    const stops = dep.route ? dep.route.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];
    const mins = dep.minutes_until;
    const colorClass = this._countdownClass(mins, dep.stop);
    const lineLabel = dep.transport_type === "train" ? dep.line : mhdT(this._hass, "line_word") + " " + dep.line;
    return `
      <div class="popup-backdrop"></div>
      <div class="popup" role="dialog" aria-modal="true">
        <div class="popup-header">
          <button class="popup-close" aria-label="✕">✕</button>
          <span class="popup-title">${mhdT(this._hass, "popup_title", lineLabel, dep.direction)}</span>
        </div>
        <div class="popup-body">
          <div class="popup-time-row">
            <span class="popup-time-label">${mhdT(this._hass, "departure_at", dep.time)}</span>
            <span class="popup-badge ${colorClass}">${mhdT(this._hass, "in_min", mins)}</span>
          </div>
          ${stops.length > 0
            ? `<p class="popup-route">${stops.join(", ")}</p>`
            : `<p class="popup-no-route">${mhdT(this._hass, "no_route")}</p>`}
        </div>
      </div>`;
  }

  _bindCardEvents() {
    this.shadowRoot.querySelectorAll(".departure").forEach(function(el) {
      el.addEventListener("click", function(e) {
        e.stopPropagation();
        var idx = parseInt(el.dataset.idx, 10);
        this._popup = (this._displayDeps || [])[idx] || null;
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
      .header-home-icon { font-size: 1.1em; line-height: 1; }
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

      .dep-type-icon { font-size: 0.95em; }
      .dep-text { font-size: 1.05em; font-weight: 600; color: var(--primary-text-color); margin-right: 4px; }
      .dep-countdown { display: block; font-size: 0.95em; font-weight: 600; }

      .other-stop-sep {
        padding: 6px 16px 4px;
        display: flex; align-items: center; gap: 8px;
      }
      .other-stop-sep span {
        font-size: 0.8em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.05em; color: var(--secondary-text-color);
      }
      .other-stop-sep::before {
        content: ""; flex: 1; height: 1px;
        background: var(--divider-color, rgba(255,255,255,.12));
      }
      .other-stop-sep::after {
        content: ""; flex: 1; height: 1px;
        background: var(--divider-color, rgba(255,255,255,.12));
      }
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
    if (!this.querySelector(".ew")) {
      this._render();
    } else {
      this._syncInputs();
    }
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
    var self = this;
    var c = this._config || {};
    var entity     = c.entity || "";
    var headerText = c.header_text || "";
    var count      = c.departures_count !== undefined ? c.departures_count : 3;
    var urgent     = c.urgent_minutes !== undefined ? c.urgent_minutes : 5;
    var warning    = c.warning_minutes !== undefined ? c.warning_minutes : 10;

    // Discover other stops from sensor routes
    var sensorAttr = (this._hass && entity && this._hass.states[entity])
      ? (this._hass.states[entity].attributes || {}) : {};
    var homeStop = sensorAttr.stop || "";
    var routes = sensorAttr.routes || [];
    var otherStopsSet = {};
    routes.forEach(function(r) {
      if (r.stop && r.stop !== homeStop) otherStopsSet[r.stop] = r.transport_type || "bus";
    });
    var otherStops = Object.keys(otherStopsSet);
    var stopThresholds = c.stop_thresholds || {};
    var typeIcons = { bus: "🚌", trolleybus: "🚎", trolejbus: "🚎", tram: "🚋", tramvaj: "🚋", train: "🚂", vlak: "🚂" };

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

        .sth-label {
          font-size: 0.8em; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.05em; color: var(--secondary-text-color);
          margin: 10px 0 4px;
        }
        .sth-divider {
          height: 1px; background: var(--divider-color, rgba(0,0,0,.1));
          margin: 12px 0 8px;
        }
      </style>

      <div class="ew">
        <div class="ew-title">
          <span class="ew-title-name">${mhdT(this._hass, "ed_title")}</span>
          <span class="ew-version">${MHD_CARD_VERSION}</span>
        </div>

        <details open>
          <summary>${mhdT(this._hass, "sec_stop")}</summary>
          <div class="sb">
            <div class="row full">
              <div class="field">
                <label>${mhdT(this._hass, "sensor_label")}</label>
                <ha-entity-picker id="mhd-ep" allow-custom-entity></ha-entity-picker>
                <p class="hint">${mhdT(this._hass, "sensor_hint")}</p>
              </div>
            </div>
            <div class="row full" style="margin-top:10px">
              <div class="field">
                <label>${mhdT(this._hass, "custom_name")}</label>
                <input name="header_text" type="text" value="${headerText}" placeholder="${mhdT(this._hass, "custom_name_ph")}">
                <p class="hint">${mhdT(this._hass, "custom_name_hint")}</p>
              </div>
            </div>
          </div>
        </details>

        <details>
          <summary>${mhdT(this._hass, "sec_display")}</summary>
          <div class="sb">
            <div class="row full">
              <div class="field">
                <label>${mhdT(this._hass, "dep_count")}</label>
                <input name="departures_count" type="number" min="1" max="10" value="${count}">
                <p class="hint">${mhdT(this._hass, "dep_count_hint")}</p>
              </div>
            </div>
          </div>
        </details>

        <details>
          <summary>${mhdT(this._hass, "sec_colors")}</summary>
          <div class="sb">
            ${otherStops.length > 0 ? `<p class="sth-label">🏠 ${homeStop || mhdT(this._hass, "home_stop")}</p>` : ""}
            <div class="row">
              <div class="field">
                <label>${mhdT(this._hass, "red_below")}</label>
                <input name="urgent_minutes" type="number" min="1" max="60" value="${urgent}">
                <p class="hint">${mhdT(this._hass, "min_default", 5)}</p>
              </div>
              <div class="field">
                <label>${mhdT(this._hass, "yellow_below")}</label>
                <input name="warning_minutes" type="number" min="1" max="120" value="${warning}">
                <p class="hint">${mhdT(this._hass, "min_default", 10)}</p>
              </div>
            </div>
            <div class="legend" data-legend="">
              <div class="li"><div class="sw sw-r"></div><span class="leg-u">${mhdT(this._hass, "leg_under", urgent)}</span></div>
              <div class="li"><div class="sw sw-y"></div><span class="leg-w">${mhdT(this._hass, "leg_between", urgent, warning)}</span></div>
              <div class="li"><div class="sw sw-g"></div><span class="leg-o">${mhdT(this._hass, "leg_over", warning)}</span></div>
            </div>
            ${otherStops.map(function(stop) {
              var st = stopThresholds[stop] || {};
              var su = st.urgent_minutes !== undefined ? st.urgent_minutes : urgent;
              var sw = st.warning_minutes !== undefined ? st.warning_minutes : warning;
              var ticon = typeIcons[otherStopsSet[stop]] || "🚌";
              return `
            <div class="sth-divider"></div>
            <p class="sth-label">${ticon} ${stop}</p>
            <div class="row">
              <div class="field">
                <label>${mhdT(self._hass, "red_below")}</label>
                <input name="urgent_minutes" type="number" min="1" max="120" value="${su}" data-stop="${stop}">
                <p class="hint">${mhdT(self._hass, "min_inherit")}</p>
              </div>
              <div class="field">
                <label>${mhdT(self._hass, "yellow_below")}</label>
                <input name="warning_minutes" type="number" min="1" max="240" value="${sw}" data-stop="${stop}">
              </div>
            </div>
            <div class="legend" data-legend="${stop}">
              <div class="li"><div class="sw sw-r"></div><span class="leg-u">${mhdT(self._hass, "leg_under", su)}</span></div>
              <div class="li"><div class="sw sw-y"></div><span class="leg-w">${mhdT(self._hass, "leg_between", su, sw)}</span></div>
              <div class="li"><div class="sw sw-g"></div><span class="leg-o">${mhdT(self._hass, "leg_over", sw)}</span></div>
            </div>`;
            }).join("")}
          </div>
        </details>
      </div>
    `;

    this._bindInputs();
    this._setupEntityPicker(entity);
  }

  _syncInputs() {
    var c = this._config;
    var ep = this.querySelector("#mhd-ep");
    if (ep) ep.value = c.entity || "";
    // Sync home-stop fields (no data-stop attribute)
    var fields = {
      header_text:      c.header_text || "",
      departures_count: c.departures_count !== undefined ? c.departures_count : 3,
      urgent_minutes:   c.urgent_minutes !== undefined ? c.urgent_minutes : 5,
      warning_minutes:  c.warning_minutes !== undefined ? c.warning_minutes : 10,
    };
    var self = this;
    Object.keys(fields).forEach(function(name) {
      var el = self.querySelector("[name='" + name + "']:not([data-stop])");
      if (el) el.value = fields[name];
    });
    // Sync per-stop fields
    var stopThresholds = c.stop_thresholds || {};
    this.querySelectorAll("[data-stop]").forEach(function(inp) {
      var stop = inp.dataset.stop;
      var st = stopThresholds[stop] || {};
      if (inp.name === "urgent_minutes")  inp.value = st.urgent_minutes  !== undefined ? st.urgent_minutes  : fields.urgent_minutes;
      if (inp.name === "warning_minutes") inp.value = st.warning_minutes !== undefined ? st.warning_minutes : fields.warning_minutes;
    });
    this._updateLegend("");
    // Update all per-stop legends
    this.querySelectorAll("[data-legend]").forEach(function(leg) {
      var stop = leg.dataset.legend;
      if (stop) self._updateLegend(stop);
    });
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
        var stopName = e.target.dataset.stop || "";
        var value = e.target.value;
        if (e.target.type === "number") {
          value = parseInt(value, 10);
          if (isNaN(value) || value < 1) value = 1;
        }
        self._config = Object.assign({}, self._config);
        if (stopName && (name === "urgent_minutes" || name === "warning_minutes")) {
          var st = Object.assign({}, (self._config.stop_thresholds || {}));
          st[stopName] = Object.assign({}, st[stopName] || {});
          st[stopName][name] = value;
          self._config.stop_thresholds = st;
          self._fire();
          self._updateLegend(stopName);
        } else {
          self._config[name] = value;
          self._fire();
          if (name === "urgent_minutes" || name === "warning_minutes") {
            self._updateLegend("");
          }
        }
      });
    });
  }

  _updateLegend(stopName) {
    stopName = stopName === undefined ? "" : stopName;
    var urgent, warning;
    if (stopName) {
      var st = (this._config.stop_thresholds || {})[stopName] || {};
      urgent  = st.urgent_minutes  !== undefined ? st.urgent_minutes  : (this._config.urgent_minutes  || 5);
      warning = st.warning_minutes !== undefined ? st.warning_minutes : (this._config.warning_minutes || 10);
    } else {
      urgent  = this._config.urgent_minutes  || 5;
      warning = this._config.warning_minutes || 10;
    }
    var legend = this.querySelector('[data-legend="' + stopName + '"]');
    if (!legend) return;
    var u = legend.querySelector(".leg-u");
    var w = legend.querySelector(".leg-w");
    var o = legend.querySelector(".leg-o");
    if (u) u.textContent = mhdT(this._hass, "leg_under", urgent);
    if (w) w.textContent = mhdT(this._hass, "leg_between", urgent, warning);
    if (o) o.textContent = mhdT(this._hass, "leg_over", warning);
  }

}

if (!customElements.get("mhd-timetable-card")) {
  customElements.define("mhd-timetable-card", MHDTimetableCard);
}
if (!customElements.get("mhd-timetable-card-editor")) {
  customElements.define("mhd-timetable-card-editor", MHDTimetableCardEditor);
}

window.customCards = window.customCards || [];
var _mhdCcLang = (navigator.language || "en").toLowerCase().split("-")[0];
var _mhdCcDict = MHD_I18N[_mhdCcLang] || MHD_I18N.en;
window.customCards.push({
  type: "mhd-timetable-card",
  name: _mhdCcDict.ed_title,
  description: _mhdCcDict.cc_desc,
  preview: true,
  documentationURL: "https://github.com/smarthome4u/ha-mhd-timetable",
});
