/**
 * MHD Timetable Card – departure display + timetable editor
 * Compatible with Home Assistant Lovelace dashboards
 */

const SCHEDULE_LABELS = {
  workday: "Pracovní den",
  saturday: "Sobota",
  sunday: "Neděle",
  holiday: "Státní svátek",
  school_vacation: "Školní prázdniny",
};

const ALL_TYPES = Object.keys(SCHEDULE_LABELS);

// ---------------------------------------------------------------------------
// Card element
// ---------------------------------------------------------------------------
class MHDTimetableCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._popup = null;
    this._editorOpen = false;
    this._editorData = null;
    this._editorLoading = false;
    this._editorLine = null; // null = list view, string = editing that line
    this._editorTab = "workday";
    this._expandedHours = {};
    this._vacationView = false;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("entity is required");
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._editorOpen) this._render();
  }

  // -------------------------------------------------------------------------
  // Main render dispatcher
  // -------------------------------------------------------------------------
  _render() {
    if (!this._config || !this._hass) return;

    const state = this._hass.states[this._config.entity];
    const attr = state ? state.attributes : {};
    const departures = attr.next_departures || [];
    const stopName = attr.stop || this._config.entity;
    const entryId = attr.entry_id || null;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="card-header">
          <span class="stop-name">${stopName}</span>
          ${entryId ? `<button class="edit-btn" title="Upravit jízdní řád">✏️</button>` : ""}
        </div>
        <div class="departures">
          ${departures.length === 0
            ? `<div class="empty">Žádné nadcházející spoje</div>`
            : departures.map((d, i) => this._depHTML(d, i)).join("")}
        </div>
      </ha-card>
      ${this._popup ? this._popupHTML(this._popup) : ""}
      ${this._editorOpen ? this._editorHTML() : ""}
    `;

    this._bindCardEvents(entryId);
    if (this._popup) this._bindPopupEvents();
    if (this._editorOpen) this._bindEditorEvents(entryId);
  }

  _depHTML(dep, idx) {
    const mins = dep.minutes_until;
    const badge = mins === 0 ? "Teď" : mins <= 1 ? "1 min" : `${mins} min`;
    const urgent = mins <= 5 ? " urgent" : "";
    return `
      <div class="departure${urgent}" data-idx="${idx}">
        <div class="line-badge">${dep.line}</div>
        <div class="dep-info">
          <span class="direction">${dep.direction}</span>
          <span class="dep-time">${dep.time}</span>
        </div>
        <div class="countdown${urgent}">${badge}</div>
      </div>`;
  }

  // -------------------------------------------------------------------------
  // Route popup
  // -------------------------------------------------------------------------
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

  _bindCardEvents(entryId) {
    this.shadowRoot.querySelectorAll(".departure").forEach(el => {
      el.addEventListener("click", () => {
        const state = this._hass.states[this._config.entity];
        const deps = (state?.attributes?.next_departures) || [];
        const idx = parseInt(el.dataset.idx, 10);
        this._popup = deps[idx] || null;
        this._render();
      });
    });
    const editBtn = this.shadowRoot.querySelector(".edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => this._openEditor(entryId));
    }
  }

  _bindPopupEvents() {
    const close = () => { this._popup = null; this._render(); };
    this.shadowRoot.querySelector(".popup-backdrop")?.addEventListener("click", close);
    this.shadowRoot.querySelector(".popup-close")?.addEventListener("click", close);
  }

  // -------------------------------------------------------------------------
  // Timetable editor
  // -------------------------------------------------------------------------
  async _openEditor(entryId) {
    this._editorOpen = true;
    this._editorLoading = true;
    this._editorData = null;
    this._editorLine = null;
    this._vacationView = false;
    this._render();
    try {
      this._editorData = await this._hass.callWS({
        type: "mhd_timetable/get_data",
        entry_id: entryId,
      });
    } catch (e) {
      this._editorData = null;
    }
    this._editorLoading = false;
    this._render();
  }

  _editorHTML() {
    if (this._editorLoading) {
      return `<div class="editor-overlay"><div class="editor-modal">
        <div class="editor-header"><span>Jízdní řád</span></div>
        <div class="editor-body loading">Načítání dat...</div>
      </div></div>`;
    }
    if (!this._editorData) {
      return `<div class="editor-overlay"><div class="editor-modal">
        <div class="editor-header"><span>Chyba</span>
          <button class="editor-close">✕</button></div>
        <div class="editor-body">Nepodařilo se načíst data.</div>
      </div></div>`;
    }
    const view = this._editorLine !== null
      ? this._lineEditorHTML()
      : this._vacationView
        ? this._vacationEditorHTML()
        : this._linesListHTML();
    return `<div class="editor-overlay"><div class="editor-modal">${view}</div></div>`;
  }

  // --- Lines list view ---
  _linesListHTML() {
    const lines = this._editorData.lines || {};
    const keys = Object.keys(lines);
    return `
      <div class="editor-header">
        <span>Jízdní řád – ${this._editorData.stop}</span>
        <button class="editor-close">✕</button>
      </div>
      <div class="editor-tabs">
        <button class="etab active" data-view="lines">Linky</button>
        <button class="etab" data-view="vacation">Prázdniny</button>
      </div>
      <div class="editor-body">
        ${keys.length === 0
          ? `<p class="empty-hint">Zatím žádné linky. Přidejte první linku níže.</p>`
          : keys.map(k => this._lineRowHTML(k, lines[k])).join("")}
        <button class="add-line-btn">+ Přidat linku</button>
      </div>
      <div class="editor-footer">
        <button class="save-btn">Uložit</button>
      </div>`;
  }

  _lineRowHTML(num, data) {
    return `
      <div class="line-row">
        <div class="line-row-info">
          <span class="lr-num">${num}</span>
          <span class="lr-dir">${data.direction || ""}</span>
        </div>
        <div class="line-row-actions">
          <button class="line-edit-btn" data-line="${num}">Upravit</button>
          <button class="line-del-btn" data-line="${num}">✕</button>
        </div>
      </div>`;
  }

  // --- Vacation periods view ---
  _vacationEditorHTML() {
    const periods = this._editorData.vacation_periods || [];
    return `
      <div class="editor-header">
        <span>Jízdní řád – ${this._editorData.stop}</span>
        <button class="editor-close">✕</button>
      </div>
      <div class="editor-tabs">
        <button class="etab" data-view="lines">Linky</button>
        <button class="etab active" data-view="vacation">Prázdniny</button>
      </div>
      <div class="editor-body">
        <p class="hint">Definujte období, kdy platí jízdní řád pro <em>Školní prázdniny</em> (pracovní dny).</p>
        ${periods.map((p, i) => this._vacationRowHTML(p, i)).join("")}
        <div class="vac-add-row">
          <input class="vac-label" placeholder="Název (např. Letní prázdniny)">
          <input class="vac-start" type="date">
          <span>–</span>
          <input class="vac-end" type="date">
          <button class="vac-add-btn">+ Přidat</button>
        </div>
      </div>
      <div class="editor-footer">
        <button class="save-btn">Uložit</button>
      </div>`;
  }

  _vacationRowHTML(p, idx) {
    return `
      <div class="vac-row" data-idx="${idx}">
        <span class="vac-label-text">${p.label || "Prázdniny"}</span>
        <span class="vac-dates">${p.start} – ${p.end}</span>
        <button class="vac-del-btn" data-idx="${idx}">✕</button>
      </div>`;
  }

  // --- Single line editor ---
  _lineEditorHTML() {
    const isNew = this._editorLine === "__new__";
    const lineData = isNew ? this._newLineTemplate() : (this._editorData.lines[this._editorLine] || {});
    const schedTypes = lineData.schedule_types || ["workday", "saturday", "sunday"];
    const tab = this._editorTab;

    return `
      <div class="editor-header">
        <button class="back-btn">← Zpět</button>
        <span>${isNew ? "Nová linka" : `Linka ${this._editorLine}`}</span>
        <button class="editor-close">✕</button>
      </div>
      <div class="editor-body line-editor-body">
        <div class="field-row">
          <label>Číslo linky</label>
          <input id="le-num" value="${isNew ? "" : this._editorLine}" ${isNew ? "" : 'readonly style="opacity:0.6"'}>
        </div>
        <div class="field-row">
          <label>Směr (cílová zastávka)</label>
          <input id="le-dir" value="${lineData.direction || ""}">
        </div>
        <div class="field-row">
          <label>Trasa (zastávky oddělené čárkou)</label>
          <textarea id="le-route" rows="2">${lineData.route || ""}</textarea>
        </div>
        <div class="field-row">
          <label>Typy jízdního řádu</label>
          <div class="stype-checks">
            ${ALL_TYPES.map(t => `
              <label class="stype-label">
                <input type="checkbox" class="stype-cb" value="${t}" ${schedTypes.includes(t) ? "checked" : ""}>
                ${SCHEDULE_LABELS[t]}
              </label>`).join("")}
          </div>
        </div>
        <div class="sched-tabs">
          ${schedTypes.map(t => `
            <button class="stab${t === tab ? " active" : ""}" data-type="${t}">${SCHEDULE_LABELS[t]}</button>
          `).join("")}
        </div>
        <div class="time-grid">
          <p class="tg-hint">Kliknutím na hodinu rozbalíte minutový výběr. Kliknutím na minutu ji přidáte/odeberete.</p>
          ${this._timeGridHTML(lineData[tab] || {}, tab)}
        </div>
      </div>
      <div class="editor-footer">
        <button class="line-save-btn">${isNew ? "Přidat linku" : "Uložit linku"}</button>
      </div>`;
  }

  _newLineTemplate() {
    return {
      direction: "",
      route: "",
      valid_from: new Date().toISOString().slice(0, 10),
      schedule_types: ["workday", "saturday", "sunday"],
      workday: {},
      saturday: {},
      sunday: {},
      holiday: {},
      school_vacation: {},
    };
  }

  // --- Time grid for one schedule type ---
  _timeGridHTML(schedule, type) {
    const rows = [];
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, "0");
      const mins = (schedule[String(h)] || schedule[hStr] || []).slice().sort((a, b) => a - b);
      const expanded = this._expandedHours[`${type}_${h}`];
      rows.push(`
        <div class="hour-row">
          <div class="hour-header${expanded ? " open" : ""}" data-hour="${h}" data-type="${type}">
            <span class="hour-label">${hStr}:xx</span>
            <div class="hour-chips">
              ${mins.map(m => `<span class="min-chip" data-h="${h}" data-m="${m}" data-type="${type}">${String(m).padStart(2,"0")}</span>`).join("")}
            </div>
            <span class="hour-toggle">${expanded ? "▲" : "▼"}</span>
          </div>
          ${expanded ? `
            <div class="minute-grid">
              ${Array.from({length: 60}, (_, m) => `
                <button class="min-cell${mins.includes(m) ? " on" : ""}" data-h="${h}" data-m="${m}" data-type="${type}">
                  ${String(m).padStart(2,"0")}
                </button>`).join("")}
            </div>` : ""}
        </div>`);
    }
    return rows.join("");
  }

  // -------------------------------------------------------------------------
  // Editor event binding
  // -------------------------------------------------------------------------
  _bindEditorEvents(entryId) {
    const root = this.shadowRoot;

    // Close editor
    root.querySelector(".editor-close")?.addEventListener("click", () => {
      this._editorOpen = false;
      this._editorData = null;
      this._render();
    });

    if (this._editorLine !== null) {
      this._bindLineEditorEvents(entryId);
      return;
    }

    // Tab switching (lines / vacation)
    root.querySelectorAll(".etab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._vacationView = btn.dataset.view === "vacation";
        this._render();
      });
    });

    // Lines list view
    if (!this._vacationView) {
      root.querySelectorAll(".line-edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          this._editorLine = btn.dataset.line;
          this._editorTab = "workday";
          this._expandedHours = {};
          this._render();
        });
      });

      root.querySelectorAll(".line-del-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (!confirm(`Smazat linku ${btn.dataset.line}?`)) return;
          delete this._editorData.lines[btn.dataset.line];
          this._render();
        });
      });

      root.querySelector(".add-line-btn")?.addEventListener("click", () => {
        this._editorLine = "__new__";
        this._editorTab = "workday";
        this._expandedHours = {};
        this._render();
      });

      root.querySelector(".save-btn")?.addEventListener("click", () => this._saveData(entryId));
    }

    // Vacation view
    if (this._vacationView) {
      root.querySelectorAll(".vac-del-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx, 10);
          this._editorData.vacation_periods.splice(idx, 1);
          this._render();
        });
      });

      root.querySelector(".vac-add-btn")?.addEventListener("click", () => {
        const label = root.querySelector(".vac-label").value.trim();
        const start = root.querySelector(".vac-start").value;
        const end = root.querySelector(".vac-end").value;
        if (!start || !end) { alert("Zadejte datum začátku a konce."); return; }
        if (!this._editorData.vacation_periods) this._editorData.vacation_periods = [];
        this._editorData.vacation_periods.push({ label: label || "Prázdniny", start, end });
        this._render();
      });

      root.querySelector(".save-btn")?.addEventListener("click", () => this._saveData(entryId));
    }
  }

  _bindLineEditorEvents(entryId) {
    const root = this.shadowRoot;
    const isNew = this._editorLine === "__new__";

    // Back button
    root.querySelector(".back-btn")?.addEventListener("click", () => {
      this._editorLine = null;
      this._render();
    });

    // Schedule type tabs
    root.querySelectorAll(".stab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editorTab = btn.dataset.type;
        this._expandedHours = {};
        this._render();
      });
    });

    // Hour row toggle
    root.querySelectorAll(".hour-header").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".min-chip")) return;
        const h = parseInt(el.dataset.hour);
        const type = el.dataset.type;
        const key = `${type}_${h}`;
        this._expandedHours[key] = !this._expandedHours[key];
        this._syncLineEditorFields();
        this._render();
      });
    });

    // Minute cell toggle
    root.querySelectorAll(".min-cell").forEach(btn => {
      btn.addEventListener("click", () => {
        this._syncLineEditorFields();
        const h = parseInt(btn.dataset.h);
        const m = parseInt(btn.dataset.m);
        const type = btn.dataset.type;
        this._toggleMinute(type, h, m);
        this._render();
      });
    });

    // Min chip remove
    root.querySelectorAll(".min-chip").forEach(chip => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        this._syncLineEditorFields();
        const h = parseInt(chip.dataset.h);
        const m = parseInt(chip.dataset.m);
        const type = chip.dataset.type;
        this._toggleMinute(type, h, m);
        this._render();
      });
    });

    // Schedule type checkboxes
    root.querySelectorAll(".stype-cb").forEach(cb => {
      cb.addEventListener("change", () => {
        this._syncLineEditorFields();
        const checked = [...root.querySelectorAll(".stype-cb:checked")].map(c => c.value);
        this._getEditingLineData().schedule_types = checked;
        if (!checked.includes(this._editorTab) && checked.length > 0) {
          this._editorTab = checked[0];
        }
        this._render();
      });
    });

    // Save line
    root.querySelector(".line-save-btn")?.addEventListener("click", () => {
      this._syncLineEditorFields();
      const lineNum = root.querySelector("#le-num")?.value?.trim();
      if (!lineNum) { alert("Zadejte číslo linky."); return; }
      const lineData = this._getEditingLineData();
      if (!this._editorData.lines) this._editorData.lines = {};
      this._editorData.lines[lineNum] = lineData;
      if (isNew && this._editorLine === "__new__") {
        // done
      }
      this._editorLine = null;
      this._render();
    });
  }

  _syncLineEditorFields() {
    const root = this.shadowRoot;
    const ld = this._getEditingLineData();
    const dir = root.querySelector("#le-dir");
    const route = root.querySelector("#le-route");
    if (dir) ld.direction = dir.value;
    if (route) ld.route = route.value;
  }

  _getEditingLineData() {
    if (this._editorLine === "__new__") {
      if (!this._editorData._newLine) this._editorData._newLine = this._newLineTemplate();
      return this._editorData._newLine;
    }
    if (!this._editorData.lines[this._editorLine]) {
      this._editorData.lines[this._editorLine] = this._newLineTemplate();
    }
    return this._editorData.lines[this._editorLine];
  }

  _toggleMinute(type, hour, minute) {
    const lineData = this._getEditingLineData();
    if (!lineData[type]) lineData[type] = {};
    const key = String(hour);
    if (!lineData[type][key]) lineData[type][key] = [];
    const arr = lineData[type][key];
    const idx = arr.indexOf(minute);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(minute);
    arr.sort((a, b) => a - b);
    if (arr.length === 0) delete lineData[type][key];
  }

  async _saveData(entryId) {
    // Clean up temp new-line buffer
    if (this._editorData._newLine) delete this._editorData._newLine;
    try {
      await this._hass.callWS({
        type: "mhd_timetable/save_data",
        entry_id: entryId,
        data: this._editorData,
      });
      this._editorOpen = false;
      this._editorData = null;
      this._render();
    } catch (e) {
      alert("Chyba při ukládání: " + (e.message || e));
    }
  }

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------
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
        justify-content: space-between;
        padding: 14px 16px 10px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12));
      }

      .stop-name {
        font-size: 1.1em;
        font-weight: 600;
        color: var(--primary-text-color);
      }

      .edit-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.1em;
        padding: 4px 8px;
        border-radius: 6px;
        opacity: 0.7;
        transition: opacity 0.2s, background 0.2s;
      }
      .edit-btn:hover { opacity: 1; background: var(--secondary-background-color); }

      .departures { padding: 8px 0; }

      .empty { padding: 16px; text-align: center; color: var(--secondary-text-color); }

      .departure {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.15s;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.06));
      }
      .departure:last-child { border-bottom: none; }
      .departure:hover { background: var(--secondary-background-color); }

      .line-badge {
        min-width: 38px;
        text-align: center;
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        font-weight: 700;
        font-size: 1em;
        padding: 4px 6px;
        border-radius: 6px;
      }

      .dep-info { flex: 1; min-width: 0; }
      .direction {
        display: block;
        font-size: 0.95em;
        color: var(--primary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dep-time {
        font-size: 0.8em;
        color: var(--secondary-text-color);
      }

      .countdown {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--secondary-text-color);
        white-space: nowrap;
      }
      .countdown.urgent { color: var(--error-color, #e53935); }

      /* Popup */
      .popup-backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.45);
        z-index: 999;
      }
      .popup {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        background: var(--card-background-color, #fff);
        border-radius: 16px 16px 0 0;
        z-index: 1000;
        max-height: 70vh;
        overflow-y: auto;
        padding-bottom: env(safe-area-inset-bottom, 0);
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
      .route-list { display: flex; flex-direction: column; gap: 0; }
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

      /* Editor overlay */
      .editor-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.5);
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .editor-modal {
        background: var(--card-background-color, #fff);
        border-radius: 14px;
        width: 100%; max-width: 560px;
        max-height: 90vh;
        display: flex; flex-direction: column;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,.25);
      }
      .editor-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12));
        background: var(--primary-color);
        color: #fff;
        font-weight: 600;
        gap: 10px;
        flex-shrink: 0;
      }
      .editor-close, .back-btn {
        background: none; border: none; color: #fff;
        font-size: 1.2em; cursor: pointer; padding: 4px 8px;
        border-radius: 6px;
        opacity: 0.85;
      }
      .editor-close:hover, .back-btn:hover { opacity: 1; background: rgba(255,255,255,.15); }
      .back-btn { font-size: 0.95em; }

      .editor-tabs {
        display: flex; gap: 0;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12));
        flex-shrink: 0;
      }
      .etab {
        flex: 1; padding: 10px; border: none; background: none;
        cursor: pointer; font-size: 0.9em;
        color: var(--secondary-text-color);
        border-bottom: 3px solid transparent;
        transition: all 0.2s;
      }
      .etab.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
        font-weight: 600;
      }

      .editor-body {
        flex: 1; overflow-y: auto; padding: 14px 16px;
      }
      .editor-body.loading { display: flex; align-items: center; justify-content: center; min-height: 120px; }

      .editor-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--divider-color, rgba(0,0,0,.12));
        display: flex; justify-content: flex-end;
        flex-shrink: 0;
      }
      .save-btn, .line-save-btn {
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        border: none; border-radius: 8px;
        padding: 10px 24px; cursor: pointer;
        font-size: 0.95em; font-weight: 600;
        transition: opacity 0.2s;
      }
      .save-btn:hover, .line-save-btn:hover { opacity: 0.85; }

      /* Line row */
      .line-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.07));
      }
      .lr-num {
        font-weight: 700; font-size: 1.05em;
        color: var(--primary-color);
        margin-right: 10px;
      }
      .lr-dir { font-size: 0.9em; color: var(--secondary-text-color); }
      .line-row-actions { display: flex; gap: 6px; }
      .line-edit-btn {
        background: var(--secondary-background-color);
        border: none; border-radius: 6px;
        padding: 5px 10px; cursor: pointer; font-size: 0.85em;
      }
      .line-del-btn {
        background: none; border: 1px solid var(--error-color, #e53935);
        color: var(--error-color, #e53935);
        border-radius: 6px; padding: 5px 8px; cursor: pointer; font-size: 0.85em;
      }
      .add-line-btn {
        display: block; width: 100%; margin-top: 12px;
        padding: 10px; border: 2px dashed var(--primary-color);
        background: none; border-radius: 8px;
        color: var(--primary-color); cursor: pointer;
        font-size: 0.95em; font-weight: 600;
        transition: background 0.2s;
      }
      .add-line-btn:hover { background: var(--secondary-background-color); }
      .empty-hint { color: var(--secondary-text-color); text-align: center; padding: 20px 0; }

      /* Line editor */
      .line-editor-body { padding-bottom: 0; }
      .field-row { margin-bottom: 12px; }
      .field-row label {
        display: block; font-size: 0.8em; font-weight: 600;
        color: var(--secondary-text-color); margin-bottom: 4px;
        text-transform: uppercase; letter-spacing: 0.03em;
      }
      .field-row input, .field-row textarea {
        width: 100%; box-sizing: border-box;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 0.95em;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        font-family: inherit;
        resize: vertical;
      }
      .field-row input:focus, .field-row textarea:focus {
        outline: none; border-color: var(--primary-color);
      }

      .stype-checks { display: flex; flex-wrap: wrap; gap: 8px; }
      .stype-label {
        display: flex; align-items: center; gap: 6px;
        font-size: 0.9em; cursor: pointer;
        padding: 4px 10px;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 20px;
        transition: all 0.2s;
      }
      .stype-label:has(.stype-cb:checked) {
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        border-color: var(--primary-color);
      }

      .sched-tabs {
        display: flex; flex-wrap: wrap; gap: 4px;
        margin: 14px 0 8px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.1));
      }
      .stab {
        padding: 5px 12px;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 16px;
        background: none; cursor: pointer;
        font-size: 0.85em;
        color: var(--secondary-text-color);
        transition: all 0.2s;
      }
      .stab.active {
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        border-color: var(--primary-color);
      }

      .tg-hint {
        font-size: 0.78em; color: var(--secondary-text-color);
        margin: 0 0 10px; line-height: 1.4;
      }

      .hour-row { margin-bottom: 2px; }
      .hour-header {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 8px; cursor: pointer;
        border-radius: 6px;
        transition: background 0.15s;
      }
      .hour-header:hover { background: var(--secondary-background-color); }
      .hour-header.open { background: var(--secondary-background-color); }
      .hour-label {
        font-size: 0.85em; font-weight: 700;
        color: var(--secondary-text-color);
        min-width: 40px;
      }
      .hour-chips { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
      .min-chip {
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.78em;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .min-chip:hover { opacity: 0.75; }
      .hour-toggle { font-size: 0.7em; color: var(--secondary-text-color); margin-left: auto; }

      .minute-grid {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 3px;
        padding: 8px;
        background: var(--secondary-background-color);
        border-radius: 0 0 8px 8px;
        margin-bottom: 4px;
      }
      .min-cell {
        border: none; border-radius: 4px;
        padding: 5px 2px;
        font-size: 0.75em;
        cursor: pointer;
        background: var(--card-background-color, #fff);
        color: var(--secondary-text-color);
        transition: all 0.1s;
        border: 1px solid var(--divider-color, rgba(0,0,0,.1));
      }
      .min-cell:hover { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .min-cell.on {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border-color: var(--primary-color);
        font-weight: 700;
      }

      /* Vacation */
      .hint { font-size: 0.85em; color: var(--secondary-text-color); margin: 0 0 12px; }
      .vac-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.07));
      }
      .vac-label-text { font-size: 0.9em; flex: 1; }
      .vac-dates { font-size: 0.8em; color: var(--secondary-text-color); white-space: nowrap; }
      .vac-del-btn {
        background: none; border: none; cursor: pointer;
        color: var(--error-color, #e53935); font-size: 1em; padding: 2px 6px;
      }
      .vac-add-row {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        margin-top: 14px; padding-top: 14px;
        border-top: 1px dashed var(--divider-color, rgba(0,0,0,.15));
      }
      .vac-add-row input {
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 6px 10px;
        font-size: 0.9em;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
      }
      .vac-label { flex: 1; min-width: 120px; }
      .vac-add-btn {
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        border: none; border-radius: 6px;
        padding: 7px 14px; cursor: pointer;
        font-size: 0.9em; white-space: nowrap;
      }
    `;
  }

  // -------------------------------------------------------------------------
  // Lovelace card config (shows in sidebar editor)
  // -------------------------------------------------------------------------
  static getConfigElement() {
    return document.createElement("mhd-timetable-card-editor");
  }

  static getStubConfig() {
    return { entity: "sensor.mhd_next" };
  }
}

// ---------------------------------------------------------------------------
// Card editor element (sidebar config panel in Lovelace edit mode)
// ---------------------------------------------------------------------------
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
  description: "Zobrazí příští odjezdy z vybrané zastávky a umožní editaci jízdního řádu.",
  preview: true,
  documentationURL: "https://github.com/smarthome4u/ha-mhd-timetable",
});
