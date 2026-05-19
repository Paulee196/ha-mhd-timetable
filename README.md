# MHD Jízdní řády pro Home Assistant

Custom integrace pro Home Assistant umožňující správu jízdních řádů MHD přímo z UI.

[![Přidat do HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Paulee196&repository=ha-mhd-timetable&category=integration)
[![Přidat integraci](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=mhd_timetable)

## Funkce

- Přidání zastávky přes průvodce (Settings → Integrations)
- Senzor s příštími odjezdy aktualizovaný každou minutu
- 5 typů jízdního řádu: pracovní den, sobota, neděle, státní svátek, školní prázdniny
- Automatická detekce českých státních svátků (včetně Velikonočního pondělí)
- Konfigurovatelná prázdninová období
- Zápisování JSON souboru pro zpětnou kompatibilitu
- Lovelace karta s editorem jízdního řádu

## Instalace přes HACS

1. HACS → Custom repositories → přidat `smarthome4u/ha-mhd-timetable` (kategorie Integration)
2. Stáhnout a restartovat HA
3. Settings → Integrations → Add Integration → **MHD Jízdní řády**

## Ruční instalace

1. Zkopírujte složku `custom_components/mhd_timetable` do `/config/custom_components/`
2. Restartujte Home Assistant (JS soubory se servírují přímo z integrace)

## Přidání karty

Nejprve přidejte resource do dashboardu (Settings → Dashboards → Resources):

```
/mhd_timetable_static/mhd-timetable-card.js
```

Pak přidejte Custom card:

```yaml
type: custom:mhd-timetable-card
entity: sensor.mhd_skola_snp
```

## Formát dat

Integrace ukládá a exportuje data ve stejném formátu jako původní manuální JSON:

```json
{
  "stop": "Škola SNP",
  "vacation_periods": [
    { "label": "Letní prázdniny", "start": "2025-07-01", "end": "2025-08-31" }
  ],
  "lines": {
    "27": {
      "direction": "Pod strání",
      "route": "Škola SNP, Alessandria, Pyrám, ...",
      "valid_from": "2023-04-01",
      "schedule_types": ["workday", "saturday", "sunday"],
      "workday": { "05": [15, 38, 49, 59], "06": [18, 33, 48] },
      "saturday": { "05": [41], "06": [8, 58] },
      "sunday":   { "05": [41], "06": [8, 58] }
    }
  }
}
```

## Priorita jízdních řádů

1. **Státní svátek** (automaticky z českého kalendáře) → sváteční jízdní řád, záloha: neděle
2. **Školní prázdniny** (konfigurované rozsahy) → prázdninový jízdní řád, záloha: pracovní den
3. **Sobota / Neděle** → dle dne
4. **Jinak** → pracovní den
