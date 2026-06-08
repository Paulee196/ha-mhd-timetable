/**
 * MHD Timetable Panel – standalone sidebar editor
 * Accessible from HA sidebar without needing a Lovelace card
 */

const SCHEDULE_LABELS = {
  workday: "Pracovní den",
  saturday: "Sobota",
  sunday: "Neděle",
  holiday: "Státní svátek",
};
const BASE_TYPES = Object.keys(SCHEDULE_LABELS);

const TRANSPORT_TYPES = [
  { key: "bus",        label: "Autobus",   icon: "🚌", color: "#1976d2" },
  { key: "trolleybus", label: "Trolejbus", icon: "🚎", color: "#0097a7" },
  { key: "tram",       label: "Tramvaj",   icon: "🚋", color: "#f57c00" },
  { key: "train",      label: "Vlak",      icon: "🚂", color: "#388e3c" },
];

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
    this._editingVacIdx = null;
    this._editingGroupIdx = null;
    this._helpVisible = false;
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
      this._ensureIds();
    } catch (e) {
      this._data = null;
    }
  }

  _ensureIds() {
    if (!this._data) return;
    if (!this._data.vacation_groups) this._data.vacation_groups = [];
    if (!this._data.vacation_periods) this._data.vacation_periods = [];
    this._data.vacation_periods.forEach(p => {
      if (!p.id) p.id = this._genId();
    });
    this._data.vacation_groups.forEach(g => {
      if (!g.id) g.id = this._genId();
    });
  }

  _genId() {
    return "vp_" + Math.random().toString(36).slice(2, 7);
  }

  _schedColor(key) {
    if (key === "workday") return "blue";
    if (key === "saturday" || key === "sunday") return "yellow";
    if (key === "holiday") return "green";
    return "purple";
  }

  _cardYaml() {
    const slug = (this._data?.stop || "název_zastávky")
      .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    return `type: custom:mhd-timetable-card\nentity: sensor.mhd_${slug}`;
  }

  _vacationPeriods() { return this._data?.vacation_periods || []; }
  _vacationGroups()  { return this._data?.vacation_groups  || []; }

  // Returns the list of unique schedule tabs for the line editor vacation section.
  // Each entry: { key: "vacation_<id>", label: "..." }
  _vacationTabs() {
    const groups  = this._vacationGroups();
    const periods = this._vacationPeriods();
    const seen = new Set();
    const tabs = [];
    // Groups first
    groups.forEach(g => {
      seen.add(g.id);
      tabs.push({ key: `vacation_${g.id}`, label: g.label || "Skupina" });
    });
    // Ungrouped periods
    periods.forEach(p => {
      if (!p.group_id && !seen.has(p.id)) {
        seen.add(p.id);
        tabs.push({ key: `vacation_${p.id}`, label: p.label || "Prázdniny" });
      }
    });
    return tabs;
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
        <div class="toolbar"><h1>Jízdní řády</h1></div>
        <div class="empty">
          <p>Žádné zastávky nejsou nakonfigurovány.</p>
          <p>Přidejte zastávku v <strong>Nastavení → Integrace → Jízdní řády</strong>.</p>
        </div>
      </div>`;

    return `
      <div class="page">
        <div class="toolbar">
          <h1>Jízdní řády</h1>
          ${this._entries.length > 1 ? `
            <select class="stop-select">
              ${this._entries.map(e => `
                <option value="${e.entry_id}" ${e.entry_id === this._selectedId ? "selected" : ""}>
                  ${e.stop}
                </option>`).join("")}
            </select>` : `<span class="stop-title">${this._data?.stop || ""}</span>`}
          <button class="help-btn" title="Nápověda">?</button>
        </div>
        ${this._helpVisible ? this._helpHTML() : ""}
        ${this._editorLine !== null ? this._lineEditorHTML() : this._mainEditorHTML()}
      </div>`;
  }

  _helpHTML() {
    return `
      <div class="help-box">
        <div class="help-title">Jak to funguje</div>

        <div class="help-section">
          <div class="help-step">1</div>
          <div>
            <strong>Státní svátky</strong> jsou rozpoznány automaticky
            podle nastavení země v Home Assistant. Nemusíte je nikde vypisovat.
            V editoru linky stačí nastavit záložku <em>Státní svátek</em>.
          </div>
        </div>

        <div class="help-section">
          <div class="help-step">2</div>
          <div>
            <strong>Prázdninová období</strong> si definujete ručně v záložce
            <em>Prázdniny</em>. Zadáte název (např. Letní prázdniny) a datum od–do.
          </div>
        </div>

        <div class="help-section">
          <div class="help-step">3</div>
          <div>
            <strong>Skupiny rozvrhu</strong> slouží ke sdílení jednoho jízdního řádu
            pro více období. Pokud např. Letní prázdniny i Vánoce jedou stejně,
            vytvořte skupinu <em>Prázdninový provoz</em> a obě období do ní přiřaďte.
            V editoru linky pak nastavíte časy jen jednou.
            Pokud každé období jede jinak, skupiny nepotřebujete.
          </div>
        </div>

        <div class="help-section">
          <div class="help-step">4</div>
          <div>
            <strong>Linky</strong> přidáte v záložce <em>Linky</em>. U každé linky
            nastavíte časy pro jednotlivé typy dnů pomocí záložek:
            Pracovní den, Sobota, Neděle, Státní svátek
            a záložku pro každou skupinu nebo samostatné období.
            Kliknutím na hodinu rozbalíte minuty a kliknutím na minutu ji přidáte nebo odeberete.
          </div>
        </div>

        <div class="help-section">
          <div class="help-step">5</div>
          <div>
            <strong>Priorita</strong> při výběru jízdního řádu:
            Státní svátek → aktuální prázdninové období → Sobota/Neděle → Pracovní den.
            Pokud pro dané prázdniny časy nevyplníte, použije se automaticky pracovní den.
          </div>
        </div>

        <div class="help-section">
          <div class="help-step">6</div>
          <div>
            <strong>Uložení</strong> — po všech změnách klikněte na
            <em>Uložit změny</em> dole. Senzor se aktualizuje okamžitě.
          </div>
        </div>

        <div class="help-divider"></div>

        <div class="help-card-title">Přidání karty na dashboard</div>
        <p style="font-size:0.88em;color:var(--secondary-text-color);margin:0 0 8px">
          Dashboard → upravit → Přidat kartu → Manuální → vložit:
        </p>
        <div class="help-code" id="help-card-yaml">${this._cardYaml()}</div>
        <button class="help-copy-btn">Kopírovat</button>
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
    const types = (data.schedule_types || [])
      .filter(t => BASE_TYPES.includes(t))
      .map(t => SCHEDULE_LABELS[t] || t).join(", ");
    const vtabs = this._vacationTabs();
    const vacCount = vtabs.filter(vt => data[vt.key] && Object.keys(data[vt.key]).length > 0).length;
    const vacLabel = vacCount > 0 ? ` + ${vacCount} prázdnin.` : "";
    return `
      <div class="line-row">
        <div class="lr-left">
          <span class="lr-num">${num}</span>
          <div class="lr-meta">
            <span class="lr-dir">${data.direction || ""}</span>
            <span class="lr-types">${types}${vacLabel}</span>
          </div>
        </div>
        <div class="lr-actions">
          <button class="btn-edit" data-line="${num}">Upravit</button>
          <button class="btn-del" data-line="${num}">✕</button>
        </div>
      </div>`;
  }

  // -------------------------------------------------------------------------
  // Vacation HTML
  // -------------------------------------------------------------------------
  _vacationHTML() {
    return `
      <p class="hint">
        <strong>Státní svátky</strong> jsou rozpoznány automaticky podle nastavení vaší země v Home Assistant.
        Zde definujte školní a jiná prázdninová období.
      </p>
      ${this._groupsSectionHTML()}
      <div class="vac-divider"></div>
      ${this._periodsSectionHTML()}`;
  }

  _groupsSectionHTML() {
    const groups = this._vacationGroups();
    const editIdx = this._editingGroupIdx;
    return `
      <div class="vac-section-title">Skupiny rozvrhu</div>
      <p class="hint">Seskupte více období pod jeden jízdní řád. Např. "Prázdninový provoz" pro letní i vánoční prázdniny.</p>
      ${groups.length === 0
        ? `<p class="hint" style="font-style:italic">Žádné skupiny. Přidejte níže nebo nechte prázdné, pokud každé období má jiný rozvrh.</p>`
        : groups.map((g, i) => editIdx === i ? `
          <div class="vac-edit-row">
            <input class="grp-edit-label" value="${g.label || ""}">
            <button class="grp-edit-save" data-idx="${i}">Uložit</button>
            <button class="grp-edit-cancel">✕</button>
          </div>` : `
          <div class="vac-row">
            <span class="grp-icon">🗂</span>
            <span class="vac-name">${g.label || "Skupina"}</span>
            <span class="vac-dates">${this._periodsInGroup(g.id).join(", ") || "—"}</span>
            <button class="grp-edit-btn" data-idx="${i}">Upravit</button>
            <button class="grp-del" data-idx="${i}">✕</button>
          </div>`).join("")}
      <div class="vac-form">
        <input class="grp-label" placeholder="Název skupiny (např. Prázdninový provoz)">
        <button class="grp-add">+ Přidat skupinu</button>
      </div>`;
  }

  _periodsInGroup(groupId) {
    return this._vacationPeriods()
      .filter(p => p.group_id === groupId)
      .map(p => p.label || "Prázdniny");
  }

  _periodsSectionHTML() {
    const periods = this._vacationPeriods();
    const groups  = this._vacationGroups();
    const editIdx = this._editingVacIdx;

    const groupOptions = (selected) => [
      `<option value="" ${!selected ? "selected" : ""}>— bez skupiny —</option>`,
      ...groups.map(g => `<option value="${g.id}" ${selected === g.id ? "selected" : ""}>${g.label || "Skupina"}</option>`),
    ].join("");

    return `
      <div class="vac-section-title">Prázdninová období</div>
      ${periods.length === 0
        ? `<p class="hint" style="font-style:italic">Žádná období. Přidejte první níže.</p>`
        : periods.map((p, i) => {
            const groupLabel = groups.find(g => g.id === p.group_id)?.label || "";
            return editIdx === i ? `
              <div class="vac-edit-row">
                <input class="vac-edit-label" value="${p.label || ""}">
                <input class="vac-edit-start" type="date" value="${p.start}">
                <span>–</span>
                <input class="vac-edit-end" type="date" value="${p.end}">
                <select class="vac-edit-group">${groupOptions(p.group_id)}</select>
                <button class="vac-edit-save" data-idx="${i}">Uložit</button>
                <button class="vac-edit-cancel">✕</button>
              </div>` : `
              <div class="vac-row">
                <span class="vac-name">${p.label || "Prázdniny"}</span>
                <span class="vac-dates">${p.start} – ${p.end}</span>
                ${groupLabel ? `<span class="vac-group-badge">${groupLabel}</span>` : ""}
                <button class="vac-edit-btn" data-idx="${i}">Upravit</button>
                <button class="vac-del" data-idx="${i}">✕</button>
              </div>`;
          }).join("")}
      <div class="vac-form">
        <input class="vac-label" placeholder="Název (např. Letní prázdniny)">
        <input class="vac-start" type="date">
        <span>–</span>
        <input class="vac-end" type="date">
        ${groups.length > 0 ? `<select class="vac-new-group">${groupOptions("")}</select>` : ""}
        <button class="vac-add">+ Přidat</button>
      </div>`;
  }

  // -------------------------------------------------------------------------
  // Line editor
  // -------------------------------------------------------------------------
  _lineEditorHTML() {
    const isNew = this._editorLine === "__new__";
    const ld = this._getLineData();
    const types = (ld.schedule_types || ["workday", "saturday", "sunday"]).filter(t => BASE_TYPES.includes(t));
    const tab = this._editorTab;
    const vacTabs = this._vacationTabs();

    const allTabs = [
      ...types.map(t => ({ key: t, label: SCHEDULE_LABELS[t], vacation: false })),
      ...vacTabs.map(t => ({ ...t, vacation: true })),
    ];

    const currentTabLabel = allTabs.find(t => t.key === tab)?.label || tab;

    const ttype = ld.transport_type || "bus";
    const customStop = ld.custom_stop || "";

    return `
      <div class="le-header">
        <button class="back-btn">← Zpět</button>
        <h2>${isNew ? "Nová linka" : `Linka ${this._editorLine}`}</h2>
      </div>
      <div class="le-fields">
        <div class="field">
          <label>Typ dopravy</label>
          <div class="ttype-chips">
            ${TRANSPORT_TYPES.map(t => `
              <button class="ttype-chip ${t.key === ttype ? "active" : ""}" data-type="${t.key}"
                      style="--tc:${t.color}">
                ${t.icon} ${t.label}
              </button>`).join("")}
          </div>
        </div>
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
          <label class="type-chip ${customStop ? "on" : ""}" id="le-cs-label">
            <input type="checkbox" id="le-cs-cb" ${customStop ? "checked" : ""}>
            Jede z jiné zastávky
          </label>
          <input id="le-cs-inp" type="text" value="${customStop}"
                 placeholder="Název zastávky (např. Hlavní nádraží)"
                 style="${customStop ? "" : "display:none"}; margin-top:6px">
        </div>
        <div class="field">
          <label>Aktivní rozvrhy</label>
          <div class="type-checks">
            ${BASE_TYPES.map(t => `
              <label class="type-chip ${types.includes(t) ? "on" : ""}">
                <input type="checkbox" class="type-cb" value="${t}" ${types.includes(t) ? "checked" : ""}>
                ${SCHEDULE_LABELS[t]}
              </label>`).join("")}
          </div>
          ${vacTabs.length > 0
            ? `<p class="hint" style="margin-top:8px">Prázdninové záložky: <strong>${vacTabs.map(t => t.label).join(", ")}</strong></p>`
            : `<p class="hint" style="margin-top:8px">Prázdninová období definujte v záložce <em>Prázdniny</em>.</p>`}
        </div>
      </div>
      <div class="sched-tabs">
        ${allTabs.map(t => `
          <button class="stab stab-${this._schedColor(t.key)} ${t.vacation ? "vac-stab" : ""} ${t.key === tab ? "active" : ""}" data-type="${t.key}">
            ${t.label}
          </button>`).join("")}
      </div>
      <div class="time-grid-wrap">
        <p class="hint">
          ${tab.startsWith("vacation_")
            ? `Jízdní řád pro <strong>${currentTabLabel}</strong>. Prázdné = použije se pracovní den.`
            : "Kliknutím na hodinu rozbalíte minuty. Kliknutím na minutu ji přidáte nebo odeberete."}
        </p>
        <div class="time-grid">${this._timeGridHTML(ld, tab, allTabs.map(t => t.key))}</div>
      </div>
      <div class="footer">
        <button class="line-save-btn">${isNew ? "Přidat linku" : "Uložit linku"}</button>
      </div>`;
  }

  _timeGridHTML(lineData, activeType, allTypes) {
    const types = allTypes || [activeType];
    let html = "";
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, "0");

      // Collect chips from ALL schedule types for this hour
      const allChips = [];
      types.forEach(type => {
        const sched = lineData[type] || {};
        const mins = (sched[String(h)] || sched[hStr] || []).slice();
        mins.sort((a, b) => a - b).forEach(m => allChips.push({ m, type }));
      });
      allChips.sort((a, b) => a.m - b.m);

      // Active type mins for the editable minute grid
      const activeSched = lineData[activeType] || {};
      const activeMins = (activeSched[String(h)] || activeSched[hStr] || []).slice();

      const expanded = this._expandedHours[`${activeType}_${h}`];
      html += `
        <div class="hour-row">
          <div class="hour-hdr ${expanded ? "open" : ""}" data-hour="${h}" data-type="${activeType}">
            <span class="hour-lbl">${hStr}</span>
            <div class="chips">
              ${allChips.map(({m, type}) =>
                `<span class="chip chip-${this._schedColor(type)}" data-h="${h}" data-m="${m}" data-type="${type}">${String(m).padStart(2,"0")}</span>`
              ).join("")}
            </div>
            <span class="toggle">${expanded ? "▲" : "▼"}</span>
          </div>
          ${expanded ? `
            <div class="min-grid">
              ${Array.from({length:60}, (_, m) => `
                <button class="mcell mcell-${this._schedColor(activeType)} ${activeMins.includes(m) ? "on" : ""}" data-h="${h}" data-m="${m}" data-type="${activeType}">
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

    root.querySelector(".help-btn")?.addEventListener("click", () => {
      this._helpVisible = !this._helpVisible;
      this._render();
    });

    root.querySelector(".help-copy-btn")?.addEventListener("click", e => {
      const text = root.querySelector("#help-card-yaml")?.textContent?.trim();
      if (!text) return;
      const btn = e.currentTarget;
      const _fallback = () => {
        const ta = document.createElement("textarea");
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
        ta.value = text;
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
          document.execCommand("copy");
          btn.textContent = "Zkopírováno ✓";
          setTimeout(() => { btn.textContent = "Kopírovat"; }, 2000);
        } catch (_) {
          btn.textContent = "Nepodařilo se kopírovat";
          setTimeout(() => { btn.textContent = "Kopírovat"; }, 2000);
        }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = "Zkopírováno ✓";
          setTimeout(() => { btn.textContent = "Kopírovat"; }, 2000);
        }).catch(_fallback);
      } else {
        _fallback();
      }
    });

    root.querySelector(".stop-select")?.addEventListener("change", async e => {
      this._selectedId = e.target.value;
      this._editorLine = null;
      this._vacationView = false;
      await this._loadData();
      this._render();
    });

    root.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._vacationView = btn.dataset.view === "vacation";
        this._editingVacIdx = null;
        this._editingGroupIdx = null;
        this._render();
      });
    });

    root.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editorLine = btn.dataset.line;
        const ld = this._data.lines[btn.dataset.line];
        const types = (ld?.schedule_types || ["workday"]).filter(t => BASE_TYPES.includes(t));
        this._editorTab = types[0] || "workday";
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

    root.querySelector(".save-btn")?.addEventListener("click", () => this._saveData());

    // ---- Group handlers ----
    root.querySelectorAll(".grp-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editingGroupIdx = parseInt(btn.dataset.idx);
        this._render();
      });
    });
    root.querySelector(".grp-edit-cancel")?.addEventListener("click", () => {
      this._editingGroupIdx = null;
      this._render();
    });
    root.querySelector(".grp-edit-save")?.addEventListener("click", () => {
      const idx = this._editingGroupIdx;
      const label = root.querySelector(".grp-edit-label")?.value.trim();
      if (!label) { alert("Zadejte název skupiny."); return; }
      this._data.vacation_groups[idx].label = label;
      this._editingGroupIdx = null;
      this._render();
    });
    root.querySelectorAll(".grp-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const removed = this._data.vacation_groups[idx];
        if (!confirm(`Smazat skupinu "${removed.label}"? Všechna nastavení rozvrhu pro tuto skupinu budou ztracena.`)) return;
        this._data.vacation_groups.splice(idx, 1);
        // Clear group assignment from periods
        this._data.vacation_periods.forEach(p => {
          if (p.group_id === removed.id) delete p.group_id;
        });
        // Remove schedule keys from lines
        const key = `vacation_${removed.id}`;
        Object.values(this._data.lines || {}).forEach(line => { delete line[key]; });
        this._render();
      });
    });
    root.querySelector(".grp-add")?.addEventListener("click", () => {
      const label = root.querySelector(".grp-label")?.value.trim();
      if (!label) { alert("Zadejte název skupiny."); return; }
      if (!this._data.vacation_groups) this._data.vacation_groups = [];
      this._data.vacation_groups.push({ id: this._genId(), label });
      root.querySelector(".grp-label").value = "";
      this._render();
    });

    // ---- Period handlers ----
    root.querySelectorAll(".vac-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editingVacIdx = parseInt(btn.dataset.idx);
        this._render();
      });
    });
    root.querySelector(".vac-edit-cancel")?.addEventListener("click", () => {
      this._editingVacIdx = null;
      this._render();
    });
    root.querySelector(".vac-edit-save")?.addEventListener("click", () => {
      const idx = this._editingVacIdx;
      const label    = root.querySelector(".vac-edit-label")?.value.trim();
      const start    = root.querySelector(".vac-edit-start")?.value;
      const end      = root.querySelector(".vac-edit-end")?.value;
      const groupId  = root.querySelector(".vac-edit-group")?.value || "";
      if (!start || !end) { alert("Zadejte datum začátku a konce."); return; }
      const p = this._data.vacation_periods[idx];
      p.label = label || "Prázdniny";
      p.start = start;
      p.end   = end;
      if (groupId) p.group_id = groupId; else delete p.group_id;
      this._editingVacIdx = null;
      this._render();
    });
    root.querySelectorAll(".vac-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const removed = this._data.vacation_periods[idx];
        this._data.vacation_periods.splice(idx, 1);
        // Remove orphaned standalone schedule key (only if no group)
        if (removed?.id && !removed.group_id) {
          const key = `vacation_${removed.id}`;
          Object.values(this._data.lines || {}).forEach(line => { delete line[key]; });
        }
        this._render();
      });
    });
    root.querySelector(".vac-add")?.addEventListener("click", () => {
      const label   = root.querySelector(".vac-label")?.value.trim();
      const start   = root.querySelector(".vac-start")?.value;
      const end     = root.querySelector(".vac-end")?.value;
      const groupId = root.querySelector(".vac-new-group")?.value || "";
      if (!start || !end) { alert("Zadejte datum začátku a konce."); return; }
      if (!this._data.vacation_periods) this._data.vacation_periods = [];
      const entry = { id: this._genId(), label: label || "Prázdniny", start, end };
      if (groupId) entry.group_id = groupId;
      this._data.vacation_periods.push(entry);
      this._render();
    });

    if (this._editorLine !== null) this._bindLineEditor();
  }

  _bindLineEditor() {
    const root = this.shadowRoot;

    root.querySelector(".back-btn")?.addEventListener("click", () => {
      this._editorLine = null;
      this._render();
    });

    // Transport type chips
    root.querySelectorAll(".ttype-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        this._syncFields();
        this._getLineData().transport_type = chip.dataset.type;
        this._render();
      });
    });

    // Custom stop checkbox
    root.querySelector("#le-cs-cb")?.addEventListener("change", e => {
      const inp   = root.querySelector("#le-cs-inp");
      const label = root.querySelector("#le-cs-label");
      if (inp)   inp.style.display   = e.target.checked ? "" : "none";
      if (label) label.classList.toggle("on", e.target.checked);
      if (!e.target.checked) this._getLineData().custom_stop = "";
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
        if (!checked.includes(this._editorTab) && !this._editorTab.startsWith("vacation_")) {
          const vtabs = this._vacationTabs();
          this._editorTab = checked[0] || (vtabs[0]?.key ?? "workday");
        }
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
    const num   = root.querySelector("#le-num");
    const dir   = root.querySelector("#le-dir");
    const route = root.querySelector("#le-route");
    const csCb  = root.querySelector("#le-cs-cb");
    const csInp = root.querySelector("#le-cs-inp");
    if (num && this._editorLine === "__new__") this._newLineNum = num.value;
    if (dir)   ld.direction = dir.value;
    if (route) ld.route = route.value;
    if (csCb && csInp) ld.custom_stop = csCb.checked ? csInp.value.trim() : "";
  }

  _getLineData() {
    if (this._editorLine === "__new__") {
      if (!this._data._newLine) this._data._newLine = {
        transport_type: "bus", custom_stop: "",
        direction: "", route: "", valid_from: new Date().toISOString().slice(0, 10),
        schedule_types: ["workday", "saturday", "sunday"],
        workday: {}, saturday: {}, sunday: {}, holiday: {},
      };
      return this._data._newLine;
    }
    const ld = this._data.lines[this._editorLine];
    if (!ld) {
      this._data.lines[this._editorLine] = {
        transport_type: "bus", custom_stop: "",
        direction: "", route: "", schedule_types: ["workday"], workday: {},
      };
    } else {
      if (!ld.transport_type) ld.transport_type = "bus";
      if (ld.custom_stop === undefined) ld.custom_stop = "";
    }
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

      .help-btn {
        margin-left: auto; width: 30px; height: 30px; border-radius: 50%;
        border: 2px solid var(--primary-color); background: none;
        color: var(--primary-color); font-size: 1em; font-weight: 700;
        cursor: pointer; line-height: 1; flex-shrink: 0;
      }
      .help-btn:hover { background: var(--primary-color); color: var(--primary-color-text, #fff); }

      .help-box {
        background: var(--card-background-color, #fff);
        border: 1px solid var(--primary-color);
        border-radius: 12px; padding: 18px 20px;
        margin-bottom: 20px;
      }
      .help-title {
        font-size: 0.85em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--primary-color);
        margin-bottom: 14px;
      }
      .help-section {
        display: flex; gap: 12px; align-items: flex-start;
        margin-bottom: 12px; font-size: 0.9em; line-height: 1.5;
        color: var(--primary-text-color);
      }
      .help-section:last-child { margin-bottom: 0; }
      .help-divider {
        border: none; border-top: 1px solid var(--divider-color, rgba(0,0,0,.1));
        margin: 14px 0;
      }
      .help-card-title {
        font-size: 0.82em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.05em; color: var(--secondary-text-color);
        margin-bottom: 8px;
      }
      .help-code {
        font-family: monospace; font-size: 0.88em;
        background: var(--secondary-background-color);
        border-radius: 6px; padding: 10px 12px;
        white-space: pre; color: var(--primary-text-color);
        margin-bottom: 8px;
      }
      .help-copy-btn {
        padding: 5px 14px; border-radius: 6px; font-size: 0.82em;
        background: none; border: 1px solid var(--primary-color);
        color: var(--primary-color); cursor: pointer;
      }
      .help-copy-btn:hover { background: var(--primary-color); color: var(--primary-color-text, #fff); }

      .help-step {
        min-width: 24px; height: 24px; border-radius: 50%;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        font-size: 0.78em; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; margin-top: 1px;
      }

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

      /* Vacation section */
      .vac-section-title {
        font-size: 0.78em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--secondary-text-color);
        margin: 16px 0 8px;
      }
      .vac-divider {
        border: none; border-top: 1px solid var(--divider-color, rgba(0,0,0,.1));
        margin: 20px 0;
      }

      .vac-row {
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        padding: 10px 14px;
        background: var(--card-background-color, #fff);
        border-radius: 8px; margin-bottom: 6px;
      }
      .grp-icon { font-size: 1em; }
      .vac-name { flex: 1; font-size: 0.95em; font-weight: 600; min-width: 120px; }
      .vac-dates { font-size: 0.82em; color: var(--secondary-text-color); }
      .vac-group-badge {
        font-size: 0.78em; padding: 2px 8px; border-radius: 10px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        opacity: 0.8;
      }
      .vac-edit-btn, .grp-edit-btn {
        padding: 4px 10px; border-radius: 6px; font-size: 0.82em;
        background: none; border: 1px solid var(--primary-color);
        color: var(--primary-color); cursor: pointer; margin-left: auto;
      }
      .vac-del, .grp-del {
        background: none; border: none;
        color: var(--error-color, #e53935); cursor: pointer; font-size: 1em;
      }

      .vac-edit-row {
        display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        padding: 10px 14px;
        background: var(--secondary-background-color);
        border-radius: 8px; margin-bottom: 6px;
        border: 1px solid var(--primary-color);
      }
      .vac-edit-row input, .vac-edit-row select {
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 6px 9px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.9em;
      }
      .vac-edit-label, .grp-edit-label { flex: 1; min-width: 130px; }
      .vac-edit-save, .grp-edit-save {
        padding: 6px 12px; border-radius: 6px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; cursor: pointer; font-size: 0.88em; font-weight: 600;
      }
      .vac-edit-cancel, .grp-edit-cancel {
        background: none; border: none;
        color: var(--error-color, #e53935); cursor: pointer; font-size: 1em;
      }

      .vac-form {
        display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        margin-top: 10px; padding-top: 12px;
        border-top: 1px dashed var(--divider-color, rgba(0,0,0,.15));
      }
      .vac-form input, .vac-form select {
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 7px 10px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.9em;
      }
      .vac-label, .grp-label { flex: 1; min-width: 140px; }
      .vac-add, .grp-add {
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
      .le-header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
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

      .ttype-chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .ttype-chip {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 14px; border-radius: 20px; cursor: pointer;
        border: 2px solid var(--tc, #999);
        background: transparent; color: var(--tc, #999);
        font-size: 0.9em; font-weight: 600; transition: all 0.2s;
      }
      .ttype-chip.active {
        background: var(--tc, #999);
        color: #fff;
      }
      .ttype-chip:hover:not(.active) { opacity: 0.75; }

      .sched-tabs {
        display: flex; flex-wrap: wrap; gap: 6px;
        margin: 14px 0 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.1));
      }
      .stab {
        padding: 6px 14px; border-radius: 18px;
        border: 1.5px solid; background: none;
        cursor: pointer; font-size: 0.88em;
        font-weight: 600; transition: all 0.18s;
      }
      .stab.vac-stab { border-style: dashed; }
      .stab.vac-stab.active { border-style: solid; }

      .stab-blue   { color: #1e88e5; border-color: #1e88e5; }
      .stab-yellow { color: #f9a825; border-color: #f9a825; }
      .stab-green  { color: #43a047; border-color: #43a047; }
      .stab-purple { color: #8e24aa; border-color: #8e24aa; }

      .stab-blue.active   { background: #1e88e5; color: #fff; }
      .stab-yellow.active { background: #f9a825; color: #fff; }
      .stab-green.active  { background: #43a047; color: #fff; }
      .stab-purple.active { background: #8e24aa; color: #fff; }

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
        border-radius: 4px; padding: 2px 6px;
        font-size: 0.78em; font-weight: 700; cursor: pointer;
        color: #fff; transition: opacity 0.15s;
      }
      .chip:hover { opacity: 0.7; }
      .chip-blue   { background: #1e88e5; }
      .chip-yellow { background: #f9a825; }
      .chip-green  { background: #43a047; }
      .chip-purple { background: #8e24aa; }
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
      .mcell.on { font-weight: 700; color: #fff; }
      .mcell-blue.on    { background: #1e88e5; border-color: #1e88e5; }
      .mcell-yellow.on  { background: #f9a825; border-color: #f9a825; }
      .mcell-green.on   { background: #43a047; border-color: #43a047; }
      .mcell-purple.on  { background: #8e24aa; border-color: #8e24aa; }

      .line-save-btn {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; border-radius: 8px; padding: 12px 32px;
        font-size: 1em; font-weight: 600; cursor: pointer;
      }
    `;
  }
}

customElements.define("mhd-timetable-panel", MHDTimetablePanel);
