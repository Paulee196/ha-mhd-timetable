"""Timetable sensor - next departures from a stop."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from zoneinfo import ZoneInfo

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import slugify

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


def _safe_date(year: int, month: int, day: int) -> date:
    import calendar

    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


def _matches_yearly_period(start: date, end: date, today: date) -> bool:
    for start_year in (today.year, today.year - 1):
        if start_year < start.year:
            continue
        occurrence_start = _safe_date(start_year, start.month, start.day)
        occurrence_end = _safe_date(
            start_year + (end.year - start.year),
            end.month,
            end.day,
        )
        if occurrence_start <= today <= occurrence_end:
            return True
    return False


def _minute_parts(entry) -> tuple[int, str, list[str]]:
    """A minute entry is either a plain int (normal departure) or
    {"m": int, "direction": str, "skip_dates": [...]} for a departure that:
      - ends/continues somewhere other than the line's usual direction
        (e.g. a short-turn trip - "direction"), and/or
      - does not run on specific calendar dates every year (e.g. a paper
        timetable's "N1 - nejede 1.1." footnote - "skip_dates", each a
        "MM-DD" string).
    Returns (minute, direction_override, skip_dates); direction_override is
    "" and skip_dates is [] when not set.
    """
    if isinstance(entry, dict):
        try:
            minute = int(entry.get("m", 0))
        except (TypeError, ValueError):
            minute = 0
        direction = str(entry.get("direction") or "").strip()
        skip_dates = [
            str(d).strip() for d in (entry.get("skip_dates") or []) if str(d).strip()
        ]
        return minute, direction, skip_dates
    try:
        return int(entry), "", []
    except (TypeError, ValueError):
        return 0, "", []


def _matches_vacation_period(period: dict, today: date) -> bool:
    try:
        start = date.fromisoformat(period["start"])
        end = date.fromisoformat(period["end"])
    except (KeyError, TypeError, ValueError):
        return False

    if end < start:
        return False

    repeat = str(period.get("repeat") or "none").lower()
    if repeat in ("", "none", "false"):
        return start <= today <= end

    if repeat == "yearly":
        return _matches_yearly_period(start, end, today)

    return start <= today <= end


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
        self._attr_name = _lang_strings(hass)["sensor_name"].format(stop=entry.data["stop_name"])
        self._attr_suggested_object_id = f"timetable_{slugify(entry.data['stop_name'])}"
        self._attr_native_value = _lang_strings(hass)["loading"]
        self._attr_extra_state_attributes = {}
        self._sent_notifications: dict[str, datetime] = {}
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
        await self._async_send_notifications(data, departures, now, strings)
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
            "timetable_domain": DOMAIN,
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

    async def _async_send_notifications(
        self,
        data: dict,
        departures: list[dict],
        now: datetime,
        strings: dict,
    ) -> None:
        rules = data.get("notifications") or []
        if not rules:
            return

        self._prune_sent_notifications(now)
        for rule in rules:
            if not _notification_rule_active(rule, now):
                continue
            for departure in departures:
                if not _notification_matches_departure(rule, departure):
                    continue
                sent_key = _notification_sent_key(rule, departure)
                if sent_key in self._sent_notifications:
                    continue
                if await _async_send_departure_notification(
                    self._hass,
                    rule,
                    departure,
                    data.get("stop", ""),
                    strings,
                ):
                    self._sent_notifications[sent_key] = now
                break

    def _prune_sent_notifications(self, now: datetime) -> None:
        cutoff = now - timedelta(hours=30)
        self._sent_notifications = {
            key: sent_at
            for key, sent_at in self._sent_notifications.items()
            if sent_at >= cutoff
        }


def _base_schedule_type(day: date) -> str:
    """The plain workday/saturday/sunday type for a date, ignoring holidays
    and vacation periods - used both directly and as the fallback target
    when a vacation-group schedule doesn't cover a given weekday."""
    if day.weekday() < 5:
        return "workday"
    if day.weekday() == 5:
        return "saturday"
    return "sunday"


def _get_schedule_type(data: dict, today: date, country: str) -> str:
    if _is_public_holiday(country, today):
        return "holiday"

    # Vacation periods apply on every day of the week, not just Mon-Fri -
    # a summer-break period commonly changes Saturday/Sunday service too
    # (e.g. some weekend trips simply don't run during it).
    for period in data.get("vacation_periods", []):
        if period.get("id") and _matches_vacation_period(period, today):
            # Use group schedule if assigned, otherwise period's own schedule
            key_id = period.get("group_id") or period["id"]
            return f"vacation_{key_id}"

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
        "sensor_name": "Jízdní řád {stop}",
        "line": "Linka", "train": "Vlak",
        "state": "{line} - Směr {direction} v {time} (za {min} min)",
        "next": "{line} - Směr {direction} {time} ({min} min)",
        "none": "Žádné spoje", "loading": "Načítání...",
        "notification_title": "Upozornění na odjezd",
    },
    "sk": {
        "sensor_name": "Cestovný poriadok {stop}",
        "line": "Linka", "train": "Vlak",
        "state": "{line} - Smer {direction} o {time} (o {min} min)",
        "next": "{line} - Smer {direction} {time} ({min} min)",
        "none": "Žiadne spoje", "loading": "Načítavanie...",
        "notification_title": "Upozornenie na odchod",
    },
    "en": {
        "sensor_name": "Timetable {stop}",
        "line": "Line", "train": "Train",
        "state": "{line} - To {direction} at {time} (in {min} min)",
        "next": "{line} - To {direction} {time} ({min} min)",
        "none": "No departures", "loading": "Loading...",
        "notification_title": "Timetable reminder",
    },
    "de": {
        "sensor_name": "Fahrplan {stop}",
        "line": "Linie", "train": "Zug",
        "state": "{line} - Richtung {direction} um {time} (in {min} Min.)",
        "next": "{line} - Richtung {direction} {time} ({min} Min.)",
        "none": "Keine Abfahrten", "loading": "Wird geladen...",
        "notification_title": "Abfahrtserinnerung",
    },
    "fr": {
        "sensor_name": "Horaires {stop}",
        "line": "Ligne", "train": "Train",
        "state": "{line} - Direction {direction} à {time} (dans {min} min)",
        "next": "{line} - Direction {direction} {time} ({min} min)",
        "none": "Aucun départ", "loading": "Chargement...",
        "notification_title": "Rappel de départ",
    },
    "es": {
        "sensor_name": "Horario {stop}",
        "line": "Línea", "train": "Tren",
        "state": "{line} - Dirección {direction} a las {time} (en {min} min)",
        "next": "{line} - Dirección {direction} {time} ({min} min)",
        "none": "Sin salidas", "loading": "Cargando...",
        "notification_title": "Recordatorio de salida",
    },
}


def _lang_strings(hass: HomeAssistant) -> dict:
    lang = (getattr(hass.config, "language", None) or "en").lower().split("-")[0]
    return _STRINGS.get(lang, _STRINGS["en"])


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    try:
        hour, minute = str(value).split(":", 1)
        return time(int(hour), int(minute))
    except (TypeError, ValueError):
        return None


def _time_in_range(now_time: time, start_value: str | None, end_value: str | None) -> bool:
    start = _parse_time(start_value)
    end = _parse_time(end_value)
    if start is None and end is None:
        return True
    if start is None:
        return now_time <= end
    if end is None:
        return now_time >= start
    if start <= end:
        return start <= now_time <= end
    return now_time >= start or now_time <= end


def _notification_days(rule: dict) -> set[int]:
    days = rule.get("days")
    if not isinstance(days, list) or not days:
        return set(range(7))
    result: set[int] = set()
    for day in days:
        try:
            parsed = int(day)
        except (TypeError, ValueError):
            continue
        if 0 <= parsed <= 6:
            result.add(parsed)
    return result or set(range(7))


def _notification_minutes_before(rule: dict) -> int:
    try:
        return max(1, min(240, int(rule.get("minutes_before", 10))))
    except (TypeError, ValueError):
        return 10


def _notification_rule_active(rule: dict, now: datetime) -> bool:
    if rule.get("enabled") is False:
        return False
    service = str(rule.get("notify_service") or "").strip()
    if not service:
        return False
    if now.weekday() not in _notification_days(rule):
        return False
    return _time_in_range(now.time(), rule.get("start_time"), rule.get("end_time"))


def _notification_matches_departure(rule: dict, departure: dict) -> bool:
    minutes_until = departure.get("minutes_until")
    if not isinstance(minutes_until, int):
        return False
    if minutes_until <= 0 or minutes_until > _notification_minutes_before(rule):
        return False

    line_id = str(rule.get("line_id") or "").strip()
    if line_id and line_id != str(departure.get("line_id") or ""):
        return False

    return True


def _notification_sent_key(rule: dict, departure: dict) -> str:
    rule_id = str(rule.get("id") or rule.get("label") or "rule")
    return "|".join([
        rule_id,
        str(departure.get("departure_at") or departure.get("time") or ""),
        str(departure.get("line_id") or ""),
        str(departure.get("stop") or ""),
    ])


def _notify_service_parts(value: str) -> tuple[str, str] | None:
    service = value.strip()
    if not service:
        return None
    if "." in service:
        domain, service_name = service.split(".", 1)
    else:
        domain, service_name = "notify", service
    if not domain or not service_name:
        return None
    return domain, service_name


async def _async_send_departure_notification(
    hass: HomeAssistant,
    rule: dict,
    departure: dict,
    home_stop: str,
    strings: dict,
) -> bool:
    service_parts = _notify_service_parts(str(rule.get("notify_service") or ""))
    if service_parts is None:
        return False

    domain, service = service_parts
    line_prefix = (
        departure["line"]
        if departure.get("transport_type") == "train"
        else f"{strings['line']} {departure['line']}"
    )
    stop = departure.get("stop") or home_stop
    title = str(rule.get("label") or strings["notification_title"])
    message = (
        f"{line_prefix} - {departure['direction']} "
        f"{departure['time']} ({departure['minutes_until']} min)"
    )
    if stop:
        message += f" - {stop}"

    try:
        await hass.services.async_call(
            domain,
            service,
            {"title": title, "message": message},
            blocking=False,
        )
        return True
    except Exception:
        return False


def _effective_schedule(line_data: dict, schedule_type: str, base_type: str) -> str | None:
    """Resolve schedule key for a line incl. fallback (holiday->sunday,
    vacation->base_type). base_type is the plain workday/saturday/sunday
    for the actual date in question, since a vacation-group schedule that
    doesn't cover a given weekday must fall back to what that weekday
    would normally run - not unconditionally to "workday"."""
    fallback: dict[str, str] = {"holiday": "sunday"}
    if schedule_type.startswith("vacation_"):
        fallback[schedule_type] = base_type
    effective = schedule_type
    if effective not in line_data or not line_data.get(effective):
        effective = fallback.get(schedule_type, schedule_type)
    if effective not in line_data:
        return None
    return effective


def _compute_next_departures(data: dict, now: datetime, country: str = "CZ", strings: dict | None = None) -> dict:
    strings = strings or _STRINGS["en"]
    today = now.date()
    tomorrow = today + timedelta(days=1)
    schedule_type = _get_schedule_type(data, today, country)
    # Departures after midnight must follow TOMORROW's schedule type
    # (Friday evening shows Saturday morning trips from the Saturday schedule).
    tomorrow_type = _get_schedule_type(data, tomorrow, country)
    today_base = _base_schedule_type(today)
    tomorrow_base = _base_schedule_type(tomorrow)

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

        def _add_departure(dt: datetime, direction_override: str = "") -> None:
            next_buses.append(
                {
                    "minutes_until": int((dt - now).total_seconds() / 60),
                    "departure_at": dt.isoformat(),
                    "line_id": line_num,
                    "line": line_display,
                    "time": dt.strftime("%H:%M"),
                    "direction": direction_override or direction,
                    "route": route,
                    "transport_type": transport_type,
                    "stop": stop_name,
                }
            )

        effective = _effective_schedule(line_data, schedule_type, today_base)
        if effective:
            for hour_str, minutes in line_data[effective].items():
                for entry in minutes:
                    minute, override, skip_dates = _minute_parts(entry)
                    dt = now.replace(
                        hour=int(hour_str), minute=minute, second=0, microsecond=0
                    )
                    if dt >= now and dt.strftime("%m-%d") not in skip_dates:
                        _add_departure(dt, override)

        effective_tomorrow = _effective_schedule(line_data, tomorrow_type, tomorrow_base)
        if effective_tomorrow:
            base = now + timedelta(days=1)
            for hour_str, minutes in line_data[effective_tomorrow].items():
                for entry in minutes:
                    minute, override, skip_dates = _minute_parts(entry)
                    dt = base.replace(
                        hour=int(hour_str), minute=minute, second=0, microsecond=0
                    )
                    if dt.strftime("%m-%d") not in skip_dates:
                        _add_departure(dt, override)

    next_buses.sort(key=lambda x: x["minutes_until"])
    return {
        "next_departures": next_buses[:10],
        "routes": routes,
        "stop": data.get("stop", ""),
        "schedule_type": schedule_type,
    }
