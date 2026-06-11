# 🚌 Timetables (Jízdní řády) for Home Assistant

[![GitHub Release](https://img.shields.io/github/v/release/Paulee196/ha-mhd-timetable?style=flat-square)](https://github.com/Paulee196/ha-mhd-timetable/releases)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=flat-square)](https://github.com/hacs/integration)
[![Downloads](https://img.shields.io/github/downloads/Paulee196/ha-mhd-timetable/total?style=flat-square)](https://github.com/Paulee196/ha-mhd-timetable/releases)

Manage local public transport timetables entirely from the Home Assistant UI – built for stops and lines where **no realtime API is available**. Enter the departures once, and the integration takes care of workdays, weekends, public holidays and school vacations.

[![Open your Home Assistant instance and add this repository to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Paulee196&repository=ha-mhd-timetable&category=integration)
[![Open your Home Assistant instance and start setting up the integration](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=mhd_timetable)

## ✨ Features

- **Sidebar editor** – manage all lines and timetables visually, no YAML needed
- **Lovelace card** with a visual editor, registered automatically
- **Transport types**: 🚌 bus, 🚎 trolleybus, 🚋 tram, 🚂 train – each departure shows its icon
- **Trains without line numbers** – identified by direction, with optional country-specific categories (R/Sp/Ex, S/RB/RE/IRE, TER/RER, Cercanías…) or a line designation (S3, RE5, C1)
- **Multiple stops per card** – a line departing from a different stop (e.g. the railway station) is shown as a separate section with its own color thresholds
- **5 schedule types**: workday, Saturday, Sunday, public holiday, vacations
- **Public holidays detected automatically** from your Home Assistant country setting
- **Vacation periods & schedule groups** – share one timetable across several periods (e.g. summer + Christmas)
- **Correct after-midnight handling** – departures after midnight follow the next day's schedule
- **Localized UI**: Čeština, Slovenčina, English, Deutsch, Français, Español – follows your Home Assistant language

## 📦 Installation

### HACS (recommended)

1. HACS → ⋮ → **Custom repositories** → add `Paulee196/ha-mhd-timetable` (type: *Integration*)
2. Search for **Jízdní řády / Timetables** and download it
3. Restart Home Assistant
4. **Settings → Devices & Services → Add Integration** → search for the integration and add your stop

### Manual

1. Copy the `custom_components/mhd_timetable` folder into `/config/custom_components/`
2. Restart Home Assistant and add the integration as above

## 🚏 Setting up timetables

Click the **🚌 Timetables** icon in the left sidebar. For each line you pick the transport type, direction, route and the departure times per day type – click an hour to expand the minute grid. Public holidays work out of the box; school vacations are defined in the *Vacations* tab and can be grouped under a shared schedule.

## 🃏 Lovelace card

The card resource is registered automatically. On your dashboard choose **Edit → Add card** and search for **Timetables** – the stop sensor is pre-filled for you.

Manual YAML alternative:

```yaml
type: custom:mhd-timetable-card
entity: sensor.mhd_your_stop
```

### Card options

| Option | Default | Description |
|---|---|---|
| `entity` | – | Stop sensor created by the integration |
| `header_text` | stop name | Custom card title |
| `departures_count` | `3` | Number of upcoming departures (1–10) |
| `urgent_minutes` | `5` | Countdown turns red below this |
| `warning_minutes` | `10` | Countdown turns yellow below this |
| `stop_thresholds` | – | Per-stop color thresholds (managed by the visual editor) |

All options are available in the card's visual editor.

## 🚂 Trains

Trains usually have no line number a passenger would know – so they only need a **direction**. Trains heading the same direction belong to one line; faster services are distinguished by an optional **category**, offered according to your language:

| Language | Categories |
|---|---|
| Čeština | R – rychlík, Sp – spěšný vlak, Ex – expres |
| Slovenčina | R, Zr, REX |
| Deutsch | S, RB, RE, IRE |
| Français | TER, RER |
| Español | C – Cercanías, MD, R – Regional |
| English | – (destination-based) |

In countries where train lines carry a designation (S3, RE5, C1…), enter it into the optional **Line designation** field instead.

## 🗂 Data format

Timetables are stored via the HA Store and can optionally be exported to JSON:

```json
{
  "stop": "Škola SNP",
  "vacation_periods": [
    { "label": "Summer break", "start": "2026-07-01", "end": "2026-08-31" }
  ],
  "lines": {
    "27": {
      "transport_type": "bus",
      "direction": "Pod strání",
      "route": "Škola SNP, Alessandria, Pyrám",
      "schedule_types": ["workday", "saturday", "sunday"],
      "workday": { "5": [15, 38, 49, 59], "6": [18, 33, 48] },
      "saturday": { "5": [41], "6": [8, 58] },
      "sunday":   { "5": [41], "6": [8, 58] }
    },
    "train_trutnov_r": {
      "transport_type": "train",
      "train_category": "R",
      "direction": "Trutnov",
      "custom_stop": "Hlavní nádraží",
      "schedule_types": ["workday"],
      "workday": { "6": [12], "8": [12], "10": [12] }
    }
  }
}
```

## 📅 Schedule priority

1. **Public holiday** → holiday schedule (fallback: Sunday)
2. **Vacation period** → vacation schedule (fallback: workday)
3. **Saturday / Sunday** → weekend schedule
4. Otherwise → **workday**

---

<details>
<summary>🇨🇿 <strong>Rychlý start česky</strong></summary>

1. **HACS** → Custom repositories → přidejte `Paulee196/ha-mhd-timetable` (Integration), stáhněte a restartujte HA
2. **Nastavení → Zařízení a služby → Přidat integraci → Jízdní řády** – zadejte název zastávky
3. V levém menu klikněte na **🚌 Jízdní řády** a přidejte spoje – typ dopravy, směr a časy odjezdů
4. Na dashboardu zvolte **Upravit → Přidat kartu** a vyhledejte **Jízdní řády** – senzor se doplní sám

Vlaky nepotřebují číslo linky – stačí směr, volitelně kategorie (R/Sp/Ex). Spoj z jiné zastávky (např. vlakové nádraží) označte v editoru zaškrtnutím *Jede z jiné zastávky*. Státní svátky se rozpoznají automaticky, prázdniny definujete v záložce *Prázdniny*.

</details>
