"""MHD Jízdní řády – Home Assistant custom integration."""
from __future__ import annotations

import json
import logging
import os
import pathlib

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor"]

_PANEL_URL = "mhd_timetable"
_STATIC_PATH = "/mhd_timetable_static"
_PANEL_JS = f"{_STATIC_PATH}/mhd-timetable-panel.js"


# ---------------------------------------------------------------------------
# Module-level websocket handlers (registered once, used by all entries)
# ---------------------------------------------------------------------------

@websocket_api.websocket_command({vol.Required("type"): "mhd_timetable/list_entries"})
@websocket_api.async_response
async def _ws_list_entries(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    entries = [
        {"entry_id": eid, "stop": v["data"]["stop"]}
        for eid, v in hass.data.get(DOMAIN, {}).items()
        if isinstance(v, dict) and "data" in v
    ]
    connection.send_result(msg["id"], entries)


@websocket_api.websocket_command({
    vol.Required("type"): "mhd_timetable/get_data",
    vol.Required("entry_id"): str,
})
@websocket_api.async_response
async def _ws_get_data(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    entry_id = msg["entry_id"]
    domain_data = hass.data.get(DOMAIN, {})
    if entry_id not in domain_data:
        connection.send_error(msg["id"], "not_found", "Entry not found")
        return
    connection.send_result(msg["id"], domain_data[entry_id]["data"])


@websocket_api.websocket_command({
    vol.Required("type"): "mhd_timetable/save_data",
    vol.Required("entry_id"): str,
    vol.Required("data"): dict,
})
@websocket_api.async_response
async def _ws_save_data(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    entry_id = msg["entry_id"]
    domain_data = hass.data.get(DOMAIN, {})
    if entry_id not in domain_data:
        connection.send_error(msg["id"], "not_found", "Entry not found")
        return

    entry_storage = domain_data[entry_id]
    entry_storage["data"] = msg["data"]
    await entry_storage["store"].async_save(msg["data"])

    entry = hass.config_entries.async_get_entry(entry_id)
    output_path = entry.data.get("output_path", "").strip() if entry else ""
    if output_path:
        await _write_json_file(hass, output_path, msg["data"])

    async_dispatcher_send(hass, f"{DOMAIN}_updated_{entry_id}")
    connection.send_result(msg["id"], {"success": True})


# ---------------------------------------------------------------------------
# Integration setup
# ---------------------------------------------------------------------------

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    www_path = str(pathlib.Path(__file__).parent / "www")
    hass.http.register_static_path(_STATIC_PATH, www_path, cache_headers=False)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})

    # Register websocket commands once per HA instance
    if not hass.data[DOMAIN].get("_ws_registered"):
        websocket_api.async_register_command(hass, _ws_list_entries)
        websocket_api.async_register_command(hass, _ws_get_data)
        websocket_api.async_register_command(hass, _ws_save_data)
        hass.data[DOMAIN]["_ws_registered"] = True

    # Register sidebar panel once per HA instance
    if not hass.data[DOMAIN].get("_panel_registered"):
        try:
            from homeassistant.components.panel_custom import async_register_panel
            await async_register_panel(
                hass,
                webcomponent_name="mhd-timetable-panel",
                sidebar_title="MHD Jízdní řády",
                sidebar_icon="mdi:bus-clock",
                frontend_url_path=_PANEL_URL,
                module_url=_PANEL_JS,
                require_admin=False,
                config={},
            )
            hass.data[DOMAIN]["_panel_registered"] = True
        except Exception as exc:
            _LOGGER.warning("Could not register MHD panel: %s", exc)

    store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}_{entry.entry_id}")
    data = await store.async_load() or _default_data(entry.data["stop_name"])

    hass.data[DOMAIN][entry.entry_id] = {
        "store": store,
        "data": data,
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Show setup guidance notification on first install (no lines configured yet)
    if not data.get("lines"):
        from homeassistant.components.persistent_notification import async_create as pn_create
        pn_create(
            hass,
            title="MHD Jízdní řády – zastávka přidána",
            message=(
                f"Zastávka **{entry.data['stop_name']}** byla úspěšně nakonfigurována.\n\n"
                "**Jak přidat spoje:**\n"
                "Klikněte na ikonu 🚌 **MHD Jízdní řády** v levém postranním panelu.\n\n"
                "Nebo přidejte kartu do dashboardu:\n"
                "```yaml\n"
                "type: custom:mhd-timetable-card\n"
                f"entity: sensor.mhd_{entry.data['stop_name'].lower().replace(' ', '_')}\n"
                "```\n"
                "a klikněte na ✏️ v kartě."
            ),
            notification_id=f"mhd_timetable_setup_{entry.entry_id}",
        )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    # Remove panel if no entries remain
    remaining = [
        k for k in hass.data.get(DOMAIN, {})
        if k not in ("_ws_registered", "_panel_registered")
    ]
    if not remaining and hass.data[DOMAIN].get("_panel_registered"):
        try:
            from homeassistant.components.frontend import async_remove_panel
            async_remove_panel(hass, _PANEL_URL)
            hass.data[DOMAIN]["_panel_registered"] = False
        except Exception:
            pass

    return unload_ok


def _default_data(stop_name: str) -> dict:
    return {
        "stop": stop_name,
        "vacation_periods": [],
        "lines": {},
    }


async def _write_json_file(hass: HomeAssistant, path: str, data: dict) -> None:
    def _write():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    try:
        await hass.async_add_executor_job(_write)
    except Exception as exc:
        _LOGGER.error("Failed to write JSON to %s: %s", path, exc)
