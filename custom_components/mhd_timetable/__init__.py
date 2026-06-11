"""Jízdní řády – Home Assistant custom integration."""
from __future__ import annotations

import json
import logging
import os
import pathlib
import re
import unicodedata
import uuid

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

_PANEL_TITLES = {
    "cs": "Jízdní řády", "sk": "Cestovné poriadky", "en": "Timetables",
    "de": "Fahrpläne", "fr": "Horaires", "es": "Horarios",
}

_NOTIFY_STRINGS = {
    "cs": {
        "title": "Jízdní řády – zastávka přidána",
        "msg": (
            "Zastávka **{stop}** byla úspěšně nakonfigurována.\n\n"
            "**Jak přidat spoje:**\n"
            "Klikněte na ikonu 🚌 **Jízdní řády** v levém postranním panelu.\n\n"
            "Nebo přidejte kartu do dashboardu:\n"
            "```yaml\ntype: custom:mhd-timetable-card\nentity: {entity}\n```"
        ),
    },
    "sk": {
        "title": "Cestovné poriadky – zastávka pridaná",
        "msg": (
            "Zastávka **{stop}** bola úspešne nakonfigurovaná.\n\n"
            "**Ako pridať spoje:**\n"
            "Kliknite na ikonu 🚌 **Cestovné poriadky** v ľavom bočnom paneli.\n\n"
            "Alebo pridajte kartu do dashboardu:\n"
            "```yaml\ntype: custom:mhd-timetable-card\nentity: {entity}\n```"
        ),
    },
    "en": {
        "title": "Timetables – stop added",
        "msg": (
            "Stop **{stop}** was configured successfully.\n\n"
            "**How to add departures:**\n"
            "Click the 🚌 **Timetables** icon in the left sidebar.\n\n"
            "Or add the card to a dashboard:\n"
            "```yaml\ntype: custom:mhd-timetable-card\nentity: {entity}\n```"
        ),
    },
    "de": {
        "title": "Fahrpläne – Haltestelle hinzugefügt",
        "msg": (
            "Die Haltestelle **{stop}** wurde erfolgreich konfiguriert.\n\n"
            "**Abfahrten hinzufügen:**\n"
            "Klicken Sie auf das 🚌 **Fahrpläne**-Symbol in der linken Seitenleiste.\n\n"
            "Oder fügen Sie die Karte einem Dashboard hinzu:\n"
            "```yaml\ntype: custom:mhd-timetable-card\nentity: {entity}\n```"
        ),
    },
    "fr": {
        "title": "Horaires – arrêt ajouté",
        "msg": (
            "L'arrêt **{stop}** a été configuré avec succès.\n\n"
            "**Comment ajouter des départs :**\n"
            "Cliquez sur l'icône 🚌 **Horaires** dans la barre latérale gauche.\n\n"
            "Ou ajoutez la carte à un tableau de bord :\n"
            "```yaml\ntype: custom:mhd-timetable-card\nentity: {entity}\n```"
        ),
    },
    "es": {
        "title": "Horarios – parada añadida",
        "msg": (
            "La parada **{stop}** se configuró correctamente.\n\n"
            "**Cómo añadir salidas:**\n"
            "Haga clic en el icono 🚌 **Horarios** en la barra lateral izquierda.\n\n"
            "O añada la tarjeta a un panel:\n"
            "```yaml\ntype: custom:mhd-timetable-card\nentity: {entity}\n```"
        ),
    },
}


def _ha_lang(hass: HomeAssistant) -> str:
    lang = (getattr(hass.config, "language", None) or "en").lower().split("-")[0]
    return lang if lang in _PANEL_TITLES else "en"

def _get_version() -> str:
    try:
        manifest = pathlib.Path(__file__).parent / "manifest.json"
        return json.loads(manifest.read_text())["version"]
    except Exception:
        return "0"

def _card_js_url() -> str:
    return f"{_STATIC_PATH}/mhd-timetable-card.js?v={_get_version()}"

def _panel_js_url() -> str:
    return f"{_STATIC_PATH}/mhd-timetable-panel.js?v={_get_version()}"


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
    try:
        from homeassistant.components.http import StaticPathConfig
        await hass.http.async_register_static_paths([
            StaticPathConfig(_STATIC_PATH, www_path, False)
        ])
    except Exception as exc:
        _LOGGER.warning("Could not register MHD static path: %s", exc)

    # Update Lovelace resource registration immediately - the Store is a plain JSON
    # file and can be written at any point. Doing it here (before HTTP serves any
    # requests) ensures the browser always gets the versioned URL on first load.
    await _async_register_lovelace_resource(hass, _card_js_url())

    return True


async def _async_register_lovelace_resource(hass: HomeAssistant, url: str) -> None:
    """Ensure exactly one correct registration for the card JS in Lovelace resources."""
    filename = "mhd-timetable-card.js"
    base = url.split("?")[0]
    try:
        store = Store(hass, 1, "lovelace_resources")
        data = await store.async_load() or {"items": []}
        items = data.setdefault("items", [])

        all_for_file = [i for i in items if filename in i.get("url", "")]
        hacs_entries = [i for i in all_for_file if "/hacsfiles/" in i.get("url", "")]
        our_entries  = [i for i in all_for_file if i not in hacs_entries]

        if hacs_entries:
            # HACS manages this file – remove any leftover registrations from us
            # so there is no double-load (HACS handles versioning via hacstag)
            if our_entries:
                for item in our_entries:
                    items.remove(item)
                await store.async_save(data)
                _LOGGER.info("Removed duplicate MHD card registration (HACS manages it)")
            else:
                _LOGGER.debug("HACS manages card JS registration, nothing to do")
            return

        # No HACS entry – manual install, maintain our own versioned registration
        if len(our_entries) == 1 and our_entries[0].get("url") == url:
            _LOGGER.debug("Lovelace resource up to date: %s", url)
            return
        for item in our_entries:
            items.remove(item)
        items.append({"id": str(uuid.uuid4()), "type": "module", "url": url})
        await store.async_save(data)
        _LOGGER.info("Lovelace resource registered: %s", url)
    except Exception as exc:
        _LOGGER.warning("Could not register Lovelace resource %s: %s", url, exc)


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
                sidebar_title=_PANEL_TITLES[_ha_lang(hass)],
                sidebar_icon="mdi:bus-clock",
                frontend_url_path=_PANEL_URL,
                module_url=_panel_js_url(),
                require_admin=False,
                config={},
            )
            hass.data[DOMAIN]["_panel_registered"] = True
        except Exception as exc:
            _LOGGER.warning("Could not register MHD panel: %s", exc)

    store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}_{entry.entry_id}")
    data = await store.async_load() or _default_data(entry.data["stop_name"])
    if _migrate_data(data):
        await store.async_save(data)
        _LOGGER.info("Migrated stored timetable data for %s", entry.data["stop_name"])

    hass.data[DOMAIN][entry.entry_id] = {
        "store": store,
        "data": data,
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Show setup guidance notification on first install (no lines configured yet)
    if not data.get("lines"):
        from homeassistant.components.persistent_notification import async_create as pn_create
        notify = _NOTIFY_STRINGS[_ha_lang(hass)]
        entity_id = f"sensor.mhd_{entry.data['stop_name'].lower().replace(' ', '_')}"
        pn_create(
            hass,
            title=notify["title"],
            message=notify["msg"].format(stop=entry.data["stop_name"], entity=entity_id),
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


# Legacy Czech transport type keys (stored by 0.8.5/0.8.6) → canonical keys
_TT_MIGRATION = {"vlak": "train", "tramvaj": "tram", "trolejbus": "trolleybus", "autobus": "bus"}


def _train_key(direction: str, category: str) -> str:
    """Deterministic line key for a train: train_<direction-slug>[_<category>]."""
    slug = unicodedata.normalize("NFD", direction or "")
    slug = "".join(c for c in slug if not unicodedata.combining(c)).lower()
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")[:30]
    key = "train" + (f"_{slug}" if slug else "")
    if category:
        key += f"_{category.lower()}"
    return key


def _migrate_data(data: dict) -> bool:
    """One-time cleanup of stored data. Returns True if anything changed."""
    changed = False
    lines = data.get("lines") or {}

    for line_data in lines.values():
        tt = line_data.get("transport_type")
        if tt in _TT_MIGRATION:
            line_data["transport_type"] = _TT_MIGRATION[tt]
            changed = True

    # Re-key auto-generated train keys (train_trutnov_mb3xyz…) to the deterministic
    # form. Keys typed by the user as a designation (S3, RE5…) are left untouched.
    for key in list(lines.keys()):
        line_data = lines[key]
        if line_data.get("transport_type") != "train":
            continue
        if key != "train" and not key.startswith(("train_", "vlak_")):
            continue
        target = _train_key(
            line_data.get("direction", ""),
            (line_data.get("train_category") or "").strip(),
        )
        if target != key and target not in lines:
            lines[target] = lines.pop(key)
            changed = True

    return changed


async def _write_json_file(hass: HomeAssistant, path: str, data: dict) -> None:
    def _write():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    try:
        await hass.async_add_executor_job(_write)
    except Exception as exc:
        _LOGGER.error("Failed to write JSON to %s: %s", path, exc)
