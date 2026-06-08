# Jízdní řády pro Home Assistant

Custom integrace pro Home Assistant umožňující správu jízdních řádů přímo z UI.

[![Přidat do HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Paulee196&repository=ha-mhd-timetable&category=integration)
[![Přidat integraci](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=mhd_timetable)

## Funkce

- Přidání zastávky přes průvodce (Settings → Integrations)
- Senzor s příštími odjezdy aktualizovaný každou minutu
- Podpora autobusů, trolejbusů, tramvají i vlaků
- Více zastávek – spoje z jiné zastávky zobrazeny odděleně
- 5 typů jízdního řádu: pracovní den, sobota, neděle, státní svátek, školní prázdniny
- Automatická detekce státních svátků (dle nastavené země v HA)
- Konfigurovatelná prázdninová období
- Lovelace karta s vizuálním editorem

## Instalace přes HACS

1. HACS → Custom repositories → přidat `Paulee196/ha-mhd-timetable` (kategorie Integration)
2. Stáhnout a restartovat HA
3. Settings → Integrations → Add Integration → **Jízdní řády**

## Ruční instalace

1. Zkopírujte složku `custom_components/mhd_timetable` do `/config/custom_components/`
2. Restartujte Home Assistant

## Přidání karty

Karta se registruje automaticky. Přidejte ji z galerie karet jako **Jízdní řády**.

## Formát dat

```json
{
  "stop": "Škola SNP",
  "vacation_periods": [
    { "label": "Letní prázdniny", "start": "2025-07-01", "end": "2025-08-31" }
  ],
  "lines": {
    "27": {
      "transport_type": "bus",
      "custom_stop": "",
      "direction": "Pod strání",
      "route": "Škola SNP, Alessandria, Pyrám, ...",
      "schedule_types": ["workday", "saturday", "sunday"],
      "workday": { "05": [15, 38, 49, 59], "06": [18, 33, 48] },
      "saturday": { "05": [41], "06": [8, 58] },
      "sunday":   { "05": [41], "06": [8, 58] }
    }
  }
}
```

## Priorita jízdních řádů

1. **Státní svátek** → sváteční jízdní řád, záloha: neděle
2. **Školní prázdniny** (konfigurované rozsahy) → prázdninový jízdní řád, záloha: pracovní den
3. **Sobota / Neděle** → dle dne
4. **Jinak** → pracovní den
