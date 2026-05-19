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
        self._attr_native_value = "Načítání..."
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
        now = datetime.now(self._tz)
        result = _compute_next_departures(data, now, country)

        departures = result["next_departures"]
        if not departures:
            self._attr_native_value = "Žádné spoje"
        else:
            first = departures[0]
            self._attr_native_value = (
                f"Linka {first['line']} - Směr {first['direction']} "
                f"v {first['time']} (za {first['minutes_until']} min)"
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
                f"{d['line']} - Směr {d['direction']} {d['time']} ({d['minutes_until']} min)"
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


def _compute_next_departures(data: dict, now: datetime, country: str = "CZ") -> dict:
    today = now.date()
    schedule_type = _get_schedule_type(data, today, country)

    # Fallback chain: holiday→sunday, vacation_*→workday
    fallback: dict[str, str] = {"holiday": "sunday"}
    if schedule_type.startswith("vacation_"):
        fallback[schedule_type] = "workday"

    next_buses: list[dict] = []
    routes: list[dict] = []

    for line_num, line_data in data.get("lines", {}).items():
        direction = line_data.get("direction", "")
        route = line_data.get("route", "")

        routes.append({"line": line_num, "direction": direction, "route": route})

        effective = schedule_type
        if effective not in line_data or not line_data.get(effective):
            effective = fallback.get(schedule_type, schedule_type)
        if effective not in line_data:
            continue

        for hour_str, minutes in line_data[effective].items():
            for minute in minutes:
                dt = now.replace(
                    hour=int(hour_str), minute=int(minute), second=0, microsecond=0
                )
                if dt < now:
                    dt += timedelta(days=1)
                diff = int((dt - now).total_seconds() / 60)
                next_buses.append(
                    {
                        "minutes_until": diff,
                        "line": line_num,
                        "time": dt.strftime("%H:%M"),
                        "direction": direction,
                        "route": route,
                    }
                )

    next_buses.sort(key=lambda x: x["minutes_until"])
    return {
        "next_departures": next_buses[:3],
        "routes": routes,
        "stop": data.get("stop", ""),
        "schedule_type": schedule_type,
    }
