/**
 * MHD Timetable Panel – standalone sidebar editor
 * Accessible from HA sidebar without needing a Lovelace card
 */

const SCHEDULE_LABELS = {
  workday: "Pracovní den",
  saturday: "Sobota",
  sunday: "Neděle",
  holiday: "Státní svátek",
  school_vacation: "Školní prázdniny",
};
const ALL_TYPES = Object.keys(SCHEDULE_LABELS);

class MHDTimetablePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._entries = [];
    this._selectedId = null;
    this._data = null;
    this._loading = true;
    this._saving = false;
    this._editorLine = null;
    this._newLineNum = "";
    this._editorTab = "workday";
    this._expandedHours = {};
    this._vacationView = false;
  }

  connectedCallback() {
    if (this._hass) this._init();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.isConnected && this._loading) this._init();
  }

  async _init() {
    try {
      this._entries = await this._hass.callWS({ type: "mhd_timetable/list_entries" });
      if (this._entries.length > 0) {
        this._selectedId = this._entries[0].entry_id;
        await this._loadData();
      }
    } catch (e) {
      console.error("MHD Panel init error:", e);
    }
    this._loading = false;
    this._render();
  }

  async _loadData() {
    if (!this._selectedId) return;
    try {
      this._data = await this._hass.callWS({
        type: "mhd_timetable/get_data",
        entry_id: this._selectedId,
      });
    } catch (e) {
      this._data = null;
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  _render() {
    this.shadowRoot.innerHTML = `<style>${this._styles()}</style>${this._html()}`;
    this._bind();
  }

  _html() {
    if (this._loading) return `<div class="page"><div class="loading">Načítání…</div></div>`;
    if (this._entries.length === 0) return `
      <div class="page">
        <div class="toolbar"><h1>MHD Jízdní řády</h1></div>
        <div class="empty">
          <p>Žádné zastávky nejsou nakonfigurovány.</p>
          <p>Přidejte zastávku v <strong>Nastavení → Integrace → MHD Jízdní řády</strong>.</p>
        </div>
      </div>`;

    return `
      <div class="page">
        <div class="toolbar">
          <h1>MHD Jízdní řády</h1>
          ${this._entries.length > 1 ? `
            <select class="stop-select">
              ${this._entries.map(e => `
                <option value="${e.entry_id}" ${e.entry_id === this._selectedId ? "selected" : ""}>
                  ${e.stop}
                </option>`).join("")}
            </select>` : `<span class="stop-title">${this._data?.stop || ""}</span>`}
        </div>
        ${this._editorLine !== null ? this._lineEditorHTML() : this._mainEditorHTML()}
      </div>`;
  }

  _mainEditorHTML() {
    if (!this._data) return `<div class="empty">Nepodařilo se načíst data zastávky.</div>`;
    const lines = this._data.lines || {};
    const keys = Object.keys(lines);
    return `
      <div class="tabs">
        <button class="tab ${!this._vacationView ? "active" : ""}" data-view="lines">Linky</button>
        <button class="tab ${this._vacationView ? "active" : ""}" data-view="vacation">Prázdniny</button>
      </div>
      <div class="content">
        ${!this._vacationView ? `
          ${keys.length === 0
            ? `<p class="hint">Zatím žádné linky. Přidejte první linku tlačítkem níže.</p>`
            : keys.map(k => this._lineRowHTML(k, lines[k])).join("")}
          <button class="add-btn">+ Přidat linku</button>
        ` : this._vacationHTML()}
      </div>
      <div class="footer">
        <button class="save-btn ${this._saving ? "saving" : ""}">
          ${this._saving ? "Ukládání…" : "Uložit změny"}
        </button>
      </div>`;
  }

  _lineRowHTML(num, data) {
    const types = (data.schedule_types || []).map(t => SCHEDULE_LABELS[t] || t).join(", ");
    return `
      <div class="line-row">
        <div class="lr-left">
          <span class="lr-num">${num}</span>
          <div class="lr-meta">
            <span class="lr-dir">${data.direction || ""}</span>
            <span class="lr-types">${types}</span>
          </div>
        </div>
        <div class="lr-actions">
          <button class="btn-edit" data-line="${num}">Upravit</button>
          <button class="btn-del" data-line="${num}">✕</button>
        </div>
      </div>`;
  }

  _vacationHTML() {
    const periods = this._data?.vacation_periods || [];
    return `
      <p class="hint">Období kdy platí rozvrh <em>Školní prázdniny</em> místo pracovního dne.</p>
      ${periods.map((p, i) => `
        <div class="vac-row">
          <span class="vac-name">${p.label || "Prázdniny"}</span>
          <span class="vac-dates">${p.start} – ${p.end}</span>
          <button class="vac-del" data-idx="${i}">✕</button>
        </div>`).join("")}
      <div class="vac-form">
        <input class="vac-label" placeholder="Název (např. Letní prázdniny)">
        <input class="vac-start" type="date">
        <span>–</span>
        <input class="vac-end" type="date">
        <button class="vac-add">+ Přidat</button>
      </div>`;
  }

  _lineEditorHTML() {
    const isNew = this._editorLine === "__new__";
    const ld = this._getLineData();
    const types = ld.schedule_types || ["workday", "saturday", "sunday"];
    const tab = this._editorTab;
    return `
      <div class="le-header">
        <button class="back-btn">← Zpět</button>
        <h2>${isNew ? "Nová linka" : `Linka ${this._editorLine}`}</h2>
      </div>
      <div class="le-fields">
        <div class="field">
          <label>Číslo linky</label>
          <input id="le-num" value="${isNew ? this._newLineNum : this._editorLine}" ${isNew ? "" : "readonly"}>
        </div>
        <div class="field">
          <label>Směr (cílová zastávka)</label>
          <input id="le-dir" value="${ld.direction || ""}">
        </div>
        <div class="field">
          <label>Trasa (zastávky oddělené čárkou)</label>
          <textarea id="le-route" rows="2">${ld.route || ""}</textarea>
        </div>
        <div class="field">
          <label>Platí pro</label>
          <div class="type-checks">
            ${ALL_TYPES.map(t => `
              <label class="type-chip ${types.includes(t) ? "on" : ""}">
                <input type="checkbox" class="type-cb" value="${t}" ${types.includes(t) ? "checked" : ""}>
                ${SCHEDULE_LABELS[t]}
              </label>`).join("")}
          </div>
        </div>
      </div>
      <div class="sched-tabs">
        ${types.map(t => `
          <button class="stab ${t === tab ? "active" : ""}" data-type="${t}">
            ${SCHEDULE_LABELS[t]}
          </button>`).join("")}
      </div>
      <div class="time-grid-wrap">
        <p class="hint">Kliknutím na hodinu rozbalíte minuty. Kliknutím na minutu ji přidáte nebo odeberete.</p>
        <div class="time-grid">${this._timeGridHTML(ld[tab] || {}, tab)}</div>
      </div>
      <div class="footer">
        <button class="line-save-btn">${isNew ? "Přidat linku" : "Uložit linku"}</button>
      </div>`;
  }

  _timeGridHTML(schedule, type) {
    let html = "";
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, "0");
      const mins = (schedule[String(h)] || schedule[hStr] || []).slice().sort((a, b) => a - b);
      const expanded = this._expandedHours[`${type}_${h}`];
      html += `
        <div class="hour-row">
          <div class="hour-hdr ${expanded ? "open" : ""}" data-hour="${h}" data-type="${type}">
            <span class="hour-lbl">${hStr}</span>
            <div class="chips">
              ${mins.map(m => `<span class="chip" data-h="${h}" data-m="${m}" data-type="${type}">${String(m).padStart(2,"0")}</span>`).join("")}
            </div>
            <span class="toggle">${expanded ? "▲" : "▼"}</span>
          </div>
          ${expanded ? `
            <div class="min-grid">
              ${Array.from({length:60},(_,m) => `
                <button class="mcell ${mins.includes(m) ? "on" : ""}" data-h="${h}" data-m="${m}" data-type="${type}">
                  ${String(m).padStart(2,"0")}
                </button>`).join("")}
            </div>` : ""}
        </div>`;
    }
    return html;
  }

  // -------------------------------------------------------------------------
  // Event binding
  // -------------------------------------------------------------------------
  _bind() {
    const root = this.shadowRoot;

    // Stop selector
    root.querySelector(".stop-select")?.addEventListener("change", async e => {
      this._selectedId = e.target.value;
      this._editorLine = null;
      this._vacationView = false;
      await this._loadData();
      this._render();
    });

    // Tabs
    root.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._vacationView = btn.dataset.view === "vacation";
        this._render();
      });
    });

    // Line actions
    root.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editorLine = btn.dataset.line;
        this._editorTab = (this._data.lines[btn.dataset.line]?.schedule_types || ["workday"])[0];
        this._expandedHours = {};
        this._render();
      });
    });
    root.querySelectorAll(".btn-del").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!confirm(`Smazat linku ${btn.dataset.line}?`)) return;
        delete this._data.lines[btn.dataset.line];
        this._render();
      });
    });
    root.querySelector(".add-btn")?.addEventListener("click", () => {
      this._editorLine = "__new__";
      this._newLineNum = "";
      this._editorTab = "workday";
      this._expandedHours = {};
      this._render();
    });

    // Vacation
    root.querySelectorAll(".vac-del").forEach(btn => {
      btn.addEventListener("click", () => {
        this._data.vacation_periods.splice(parseInt(btn.dataset.idx), 1);
        this._render();
      });
    });
    root.querySelector(".vac-add")?.addEventListener("click", () => {
      const label = root.querySelector(".vac-label").value.trim();
      const start = root.querySelector(".vac-start").value;
      const end = root.querySelector(".vac-end").value;
      if (!start || !end) { alert("Zadejte datum začátku a konce."); return; }
      if (!this._data.vacation_periods) this._data.vacation_periods = [];
      this._data.vacation_periods.push({ label: label || "Prázdniny", start, end });
      this._render();
    });

    // Save
    root.querySelector(".save-btn")?.addEventListener("click", () => this._saveData());

    // Line editor
    if (this._editorLine !== null) this._bindLineEditor();
  }

  _bindLineEditor() {
    const root = this.shadowRoot;

    root.querySelector(".back-btn")?.addEventListener("click", () => {
      this._editorLine = null;
      this._render();
    });

    root.querySelectorAll(".stab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._syncFields();
        this._editorTab = btn.dataset.type;
        this._expandedHours = {};
        this._render();
      });
    });

    root.querySelectorAll(".type-cb").forEach(cb => {
      cb.addEventListener("change", () => {
        this._syncFields();
        const checked = [...root.querySelectorAll(".type-cb:checked")].map(c => c.value);
        this._getLineData().schedule_types = checked;
        if (!checked.includes(this._editorTab) && checked.length > 0) this._editorTab = checked[0];
        this._render();
      });
    });

    root.querySelectorAll(".hour-hdr").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.closest(".chip")) return;
        const key = `${el.dataset.type}_${el.dataset.hour}`;
        this._expandedHours[key] = !this._expandedHours[key];
        this._syncFields();
        this._render();
      });
    });

    root.querySelectorAll(".mcell").forEach(btn => {
      btn.addEventListener("click", () => {
        this._syncFields();
        this._toggleMinute(btn.dataset.type, parseInt(btn.dataset.h), parseInt(btn.dataset.m));
        this._render();
      });
    });

    root.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", e => {
        e.stopPropagation();
        this._syncFields();
        this._toggleMinute(chip.dataset.type, parseInt(chip.dataset.h), parseInt(chip.dataset.m));
        this._render();
      });
    });

    root.querySelector(".line-save-btn")?.addEventListener("click", () => {
      this._syncFields();
      const num = root.querySelector("#le-num")?.value?.trim();
      if (!num) { alert("Zadejte číslo linky."); return; }
      const ld = this._getLineData();
      if (!this._data.lines) this._data.lines = {};
      this._data.lines[num] = ld;
      if (this._editorLine === "__new__") delete this._data._newLine;
      this._editorLine = null;
      this._render();
    });
  }

  _syncFields() {
    const root = this.shadowRoot;
    const ld = this._getLineData();
    const num = root.querySelector("#le-num");
    const dir = root.querySelector("#le-dir");
    const route = root.querySelector("#le-route");
    if (num && this._editorLine === "__new__") this._newLineNum = num.value;
    if (dir) ld.direction = dir.value;
    if (route) ld.route = route.value;
  }

  _getLineData() {
    if (this._editorLine === "__new__") {
      if (!this._data._newLine) this._data._newLine = {
        direction: "", route: "", valid_from: new Date().toISOString().slice(0, 10),
        schedule_types: ["workday", "saturday", "sunday"],
        workday: {}, saturday: {}, sunday: {}, holiday: {}, school_vacation: {},
      };
      return this._data._newLine;
    }
    if (!this._data.lines[this._editorLine]) this._data.lines[this._editorLine] = {
      direction: "", route: "", schedule_types: ["workday"], workday: {},
    };
    return this._data.lines[this._editorLine];
  }

  _toggleMinute(type, hour, minute) {
    const ld = this._getLineData();
    if (!ld[type]) ld[type] = {};
    const key = String(hour);
    if (!ld[type][key]) ld[type][key] = [];
    const arr = ld[type][key];
    const idx = arr.indexOf(minute);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(minute);
    arr.sort((a, b) => a - b);
    if (arr.length === 0) delete ld[type][key];
  }

  async _saveData() {
    if (!this._selectedId || !this._data) return;
    if (this._data._newLine) delete this._data._newLine;
    this._saving = true;
    this._render();
    try {
      await this._hass.callWS({
        type: "mhd_timetable/save_data",
        entry_id: this._selectedId,
        data: this._data,
      });
    } catch (e) {
      alert("Chyba při ukládání: " + (e.message || e));
    }
    this._saving = false;
    this._render();
  }

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------
  _styles() {
    return `
      :host { display: block; background: var(--primary-background-color); min-height: 100%; }

      .page { max-width: 720px; margin: 0 auto; padding: 16px; }

      .toolbar {
        display: flex; align-items: center; gap: 16px;
        margin-bottom: 20px; flex-wrap: wrap;
      }
      h1 { margin: 0; font-size: 1.4em; color: var(--primary-text-color); }
      .stop-title { font-size: 1em; color: var(--secondary-text-color); }
      .stop-select {
        padding: 6px 10px; border-radius: 8px;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.95em;
      }

      .loading, .empty { padding: 40px; text-align: center; color: var(--secondary-text-color); }

      .tabs {
        display: flex; border-bottom: 2px solid var(--divider-color, rgba(0,0,0,.1));
        margin-bottom: 16px;
      }
      .tab {
        padding: 10px 20px; border: none; background: none; cursor: pointer;
        font-size: 0.95em; color: var(--secondary-text-color);
        border-bottom: 3px solid transparent; margin-bottom: -2px;
        transition: all 0.2s;
      }
      .tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); font-weight: 600; }

      .content { min-height: 200px; }
      .hint { color: var(--secondary-text-color); font-size: 0.88em; margin: 0 0 12px; }

      .line-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px;
        background: var(--card-background-color, #fff);
        border-radius: 10px; margin-bottom: 8px;
        box-shadow: 0 1px 4px rgba(0,0,0,.06);
      }
      .lr-left { display: flex; align-items: center; gap: 14px; }
      .lr-num {
        font-size: 1.2em; font-weight: 800;
        color: var(--primary-color);
        min-width: 32px; text-align: center;
      }
      .lr-dir { font-size: 0.95em; color: var(--primary-text-color); }
      .lr-types { font-size: 0.78em; color: var(--secondary-text-color); margin-top: 2px; }
      .lr-actions { display: flex; gap: 8px; }
      .btn-edit {
        padding: 6px 14px; border-radius: 6px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; cursor: pointer; font-size: 0.88em;
      }
      .btn-del {
        padding: 6px 10px; border-radius: 6px;
        background: none; border: 1px solid var(--error-color, #e53935);
        color: var(--error-color, #e53935); cursor: pointer; font-size: 0.88em;
      }

      .add-btn {
        display: block; width: 100%; margin-top: 12px;
        padding: 12px; border: 2px dashed var(--primary-color);
        background: none; border-radius: 10px;
        color: var(--primary-color); cursor: pointer; font-size: 0.95em; font-weight: 600;
      }
      .add-btn:hover { background: var(--secondary-background-color); }

      .vac-row {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 16px;
        background: var(--card-background-color, #fff);
        border-radius: 8px; margin-bottom: 6px;
      }
      .vac-name { flex: 1; font-size: 0.95em; }
      .vac-dates { font-size: 0.82em; color: var(--secondary-text-color); }
      .vac-del { background: none; border: none; color: var(--error-color, #e53935); cursor: pointer; font-size: 1em; }
      .vac-form {
        display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        margin-top: 16px; padding-top: 14px;
        border-top: 1px dashed var(--divider-color, rgba(0,0,0,.15));
      }
      .vac-form input {
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 7px 10px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.9em;
      }
      .vac-label { flex: 1; min-width: 140px; }
      .vac-add {
        padding: 7px 14px; border-radius: 6px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; cursor: pointer; font-size: 0.9em;
      }

      .footer {
        position: sticky; bottom: 0;
        padding: 14px 0;
        background: var(--primary-background-color);
        border-top: 1px solid var(--divider-color, rgba(0,0,0,.1));
        margin-top: 16px;
      }
      .save-btn {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; border-radius: 8px; padding: 12px 32px;
        font-size: 1em; font-weight: 600; cursor: pointer;
        transition: opacity 0.2s;
      }
      .save-btn:hover { opacity: 0.85; }
      .save-btn.saving { opacity: 0.6; pointer-events: none; }

      /* Line editor */
      .le-header {
        display: flex; align-items: center; gap: 14px; margin-bottom: 18px;
      }
      .back-btn {
        background: none; border: none; color: var(--primary-color);
        font-size: 0.95em; cursor: pointer; padding: 6px 0;
      }
      .le-header h2 { margin: 0; font-size: 1.15em; }

      .le-fields { margin-bottom: 16px; }
      .field { margin-bottom: 14px; }
      .field label {
        display: block; font-size: 0.78em; font-weight: 700;
        color: var(--secondary-text-color); text-transform: uppercase;
        letter-spacing: 0.04em; margin-bottom: 5px;
      }
      .field input, .field textarea {
        width: 100%; box-sizing: border-box;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 7px; padding: 9px 11px;
        font-size: 0.95em;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-family: inherit; resize: vertical;
      }
      .field input[readonly] { opacity: 0.6; }

      .type-checks { display: flex; flex-wrap: wrap; gap: 8px; }
      .type-chip {
        display: flex; align-items: center; gap: 6px;
        padding: 5px 12px; border-radius: 20px; cursor: pointer;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        font-size: 0.88em; transition: all 0.2s;
      }
      .type-chip.on {
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        border-color: var(--primary-color);
      }
      .type-chip input { display: none; }

      .sched-tabs {
        display: flex; flex-wrap: wrap; gap: 6px;
        margin: 14px 0 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.1));
      }
      .stab {
        padding: 6px 14px; border-radius: 18px;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        background: none; cursor: pointer; font-size: 0.88em;
        color: var(--secondary-text-color); transition: all 0.2s;
      }
      .stab.active {
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        border-color: var(--primary-color);
      }

      .time-grid-wrap { margin-bottom: 80px; }

      .hour-row { margin-bottom: 3px; }
      .hour-hdr {
        display: flex; align-items: center; gap: 10px;
        padding: 7px 10px; border-radius: 7px; cursor: pointer;
        background: var(--card-background-color, #fff);
        transition: background 0.15s;
      }
      .hour-hdr:hover, .hour-hdr.open { background: var(--secondary-background-color); }
      .hour-lbl {
        font-size: 0.9em; font-weight: 700;
        color: var(--secondary-text-color); min-width: 28px;
      }
      .chips { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
      .chip {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border-radius: 4px; padding: 2px 6px;
        font-size: 0.78em; font-weight: 700; cursor: pointer;
      }
      .chip:hover { opacity: 0.75; }
      .toggle { font-size: 0.68em; color: var(--secondary-text-color); margin-left: auto; }

      .min-grid {
        display: grid; grid-template-columns: repeat(10, 1fr);
        gap: 3px; padding: 8px;
        background: var(--secondary-background-color);
        border-radius: 0 0 7px 7px; margin-bottom: 4px;
      }
      .mcell {
        border: 1px solid var(--divider-color, rgba(0,0,0,.1));
        border-radius: 4px; padding: 5px 2px; font-size: 0.75em;
        cursor: pointer; background: var(--card-background-color, #fff);
        color: var(--secondary-text-color); transition: all 0.1s;
      }
      .mcell:hover { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .mcell.on {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border-color: var(--primary-color); font-weight: 700;
      }

      .line-save-btn {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; border-radius: 8px; padding: 12px 32px;
        font-size: 1em; font-weight: 600; cursor: pointer;
      }
    `;
  }
}

customElements.define("mhd-timetable-panel", MHDTimetablePanel);
