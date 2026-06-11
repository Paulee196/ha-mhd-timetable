"""MHD sensor – next departures from a stop."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from zoneinfo import ZoneInfo

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_track_time_interval

from .const import DOMAIN

try:
    import holidays as _holidays_lib
    _HOLIDAYS_AVAILABLE = True
except ImportError:
    _HOLIDAYS_AVAILABLE = False


def _is_public_holiday(country: str, today: date) -> bool:
    if not _HOLIDAYS_AVAILABLE:
        return False
    try:
        return today in _holidays_lib.country_holidays(country, years=today.year)
    except Exception:
        return False


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    sensor = MHDNextDeparturesSensor(hass, entry)
    async_add_entities([sensor])


class MHDNextDeparturesSensor(SensorEntity):
    _attr_should_poll = False
    _attr_icon = "mdi:bus-clock"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self._hass = hass
        self._entry = entry
        self._entry_id = entry.entry_id
        self._attr_unique_id = f"mhd_timetable_{entry.entry_id}"
        self._attr_name = f"MHD {entry.data['stop_name']}"
        self._attr_native_value = _lang_strings(hass)["loading"]
        self._attr_extra_state_attributes = {}
        self._tz = ZoneInfo(hass.config.time_zone)

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_track_time_interval(self.hass, self._async_update, timedelta(minutes=1))
        )
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                f"{DOMAIN}_updated_{self._entry_id}",
                self._async_update,
            )
        )
        await self._async_update(None)

    async def _async_update(self, _now) -> None:
        data = self._hass.data[DOMAIN][self._entry_id]["data"]
        country = self._hass.config.country or "CZ"
        strings = _lang_strings(self._hass)
        now = datetime.now(self._tz)
        result = _compute_next_departures(data, now, country, strings)

        departures = result["next_departures"]
        if not departures:
            self._attr_native_value = strings["none"]
        else:
            first = departures[0]
            line_prefix = first["line"] if first.get("transport_type") == "train" else f"{strings['line']} {first['line']}"
            self._attr_native_value = strings["state"].format(
                line=line_prefix, direction=first["direction"],
                time=first["time"], min=first["minutes_until"],
            )

        self._attr_extra_state_attributes = {
            "stop": result["stop"],
            "entry_id": self._entry_id,
            "schedule_type": result["schedule_type"],
            "next_departures": departures,
            "routes": result["routes"],
            # Legacy compatibility with existing pyscript
            "line": departures[0]["line"] if departures else "",
            "time": departures[0]["time"] if departures else "",
            "direction": departures[0]["direction"] if departures else "",
            "next_list": ", ".join(
                strings["next"].format(
                    line=d["line"], direction=d["direction"],
                    time=d["time"], min=d["minutes_until"],
                )
                for d in departures[1:3]
            ),
        }
        self.async_write_ha_state()


def _get_schedule_type(data: dict, today: date, country: str) -> str:
    if _is_public_holiday(country, today):
        return "holiday"

    if today.weekday() < 5:
        for period in data.get("vacation_periods", []):
            try:
                start = date.fromisoformat(period["start"])
                end = date.fromisoformat(period["end"])
                if start <= today <= end and period.get("id"):
                    # Use group schedule if assigned, otherwise period's own schedule
                    key_id = period.get("group_id") or period["id"]
                    return f"vacation_{key_id}"
            except (KeyError, ValueError):
                pass

    if today.weekday() < 5:
        return "workday"
    if today.weekday() == 5:
        return "saturday"
    return "sunday"


# Legacy Czech keys stored by older versions → canonical keys
_TT_CANONICAL = {"vlak": "train", "tramvaj": "tram", "trolejbus": "trolleybus", "autobus": "bus"}

# Sensor state strings per HA language (fallback: en)
_STRINGS = {
    "cs": {
        "line": "Linka", "train": "Vlak",
        "state": "{line} - Směr {direction} v {time} (za {min} min)",
        "next": "{line} - Směr {direction} {time} ({min} min)",
        "none": "Žádné spoje", "loading": "Načítání...",
    },
    "sk": {
        "line": "Linka", "train": "Vlak",
        "state": "{line} - Smer {direction} o {time} (o {min} min)",
        "next": "{line} - Smer {direction} {time} ({min} min)",
        "none": "Žiadne spoje", "loading": "Načítavanie...",
    },
    "en": {
        "line": "Line", "train": "Train",
        "state": "{line} - To {direction} at {time} (in {min} min)",
        "next": "{line} - To {direction} {time} ({min} min)",
        "none": "No departures", "loading": "Loading...",
    },
    "de": {
        "line": "Linie", "train": "Zug",
        "state": "{line} - Richtung {direction} um {time} (in {min} Min.)",
        "next": "{line} - Richtung {direction} {time} ({min} Min.)",
        "none": "Keine Abfahrten", "loading": "Wird geladen...",
    },
    "fr": {
        "line": "Ligne", "train": "Train",
        "state": "{line} - Direction {direction} à {time} (dans {min} min)",
        "next": "{line} - Direction {direction} {time} ({min} min)",
        "none": "Aucun départ", "loading": "Chargement...",
    },
    "es": {
        "line": "Línea", "train": "Tren",
        "state": "{line} - Dirección {direction} a las {time} (en {min} min)",
        "next": "{line} - Dirección {direction} {time} ({min} min)",
        "none": "Sin salidas", "loading": "Cargando...",
    },
}


def _lang_strings(hass: HomeAssistant) -> dict:
    lang = (getattr(hass.config, "language", None) or "en").lower().split("-")[0]
    return _STRINGS.get(lang, _STRINGS["en"])


def _effective_schedule(line_data: dict, schedule_type: str) -> str | None:
    """Resolve schedule key for a line incl. fallback (holiday→sunday, vacation→workday)."""
    fallback: dict[str, str] = {"holiday": "sunday"}
    if schedule_type.startswith("vacation_"):
        fallback[schedule_type] = "workday"
    effective = schedule_type
    if effective not in line_data or not line_data.get(effective):
        effective = fallback.get(schedule_type, schedule_type)
    if effective not in line_data:
        return None
    return effective


def _compute_next_departures(data: dict, now: datetime, country: str = "CZ", strings: dict | None = None) -> dict:
    strings = strings or _STRINGS["en"]
    today = now.date()
    schedule_type = _get_schedule_type(data, today, country)
    # Departures after midnight must follow TOMORROW's schedule type
    # (Friday evening shows Saturday morning trips from the Saturday schedule).
    tomorrow_type = _get_schedule_type(data, today + timedelta(days=1), country)

    next_buses: list[dict] = []
    routes: list[dict] = []

    home_stop = data.get("stop", "")

    for line_num, line_data in data.get("lines", {}).items():
        direction = line_data.get("direction", "")
        route = line_data.get("route", "")
        transport_type = line_data.get("transport_type", "bus")
        transport_type = _TT_CANONICAL.get(transport_type, transport_type)
        custom_stop = (line_data.get("custom_stop") or "").strip()
        stop_name = custom_stop if custom_stop else home_stop
        if transport_type == "train":
            if line_num != "train" and not line_num.startswith(("train_", "vlak_")):
                # Explicit designation typed by the user (S3, RE5, C1…)
                line_display = line_num
            else:
                category = (line_data.get("train_category") or "").strip()
                line_display = f"{strings['train']} {category}".strip()
        else:
            line_display = line_num

        routes.append({"line": line_display, "direction": direction, "route": route, "transport_type": transport_type, "stop": stop_name})

        def _add_departure(dt: datetime) -> None:
            next_buses.append(
                {
                    "minutes_until": int((dt - now).total_seconds() / 60),
                    "line": line_display,
                    "time": dt.strftime("%H:%M"),
                    "direction": direction,
                    "route": route,
                    "transport_type": transport_type,
                    "stop": stop_name,
                }
            )

        effective = _effective_schedule(line_data, schedule_type)
        if effective:
            for hour_str, minutes in line_data[effective].items():
                for minute in minutes:
                    dt = now.replace(
                        hour=int(hour_str), minute=int(minute), second=0, microsecond=0
                    )
                    if dt >= now:
                        _add_departure(dt)

        effective_tomorrow = _effective_schedule(line_data, tomorrow_type)
        if effective_tomorrow:
            base = now + timedelta(days=1)
            for hour_str, minutes in line_data[effective_tomorrow].items():
                for minute in minutes:
                    _add_departure(base.replace(
                        hour=int(hour_str), minute=int(minute), second=0, microsecond=0
                    ))

    next_buses.sort(key=lambda x: x["minutes_until"])
    return {
        "next_departures": next_buses[:10],
        "routes": routes,
        "stop": data.get("stop", ""),
        "schedule_type": schedule_type,
    }
