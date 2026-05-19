"""Config flow for MHD Jízdní řády."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import DOMAIN


class MHDTimetableConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            await self.async_set_unique_id(user_input["stop_name"].lower().replace(" ", "_"))
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=user_input["stop_name"],
                data={
                    "stop_name": user_input["stop_name"],
                    "output_path": user_input.get("output_path", "").strip(),
                },
            )

        slug = ""
        schema = vol.Schema({
            vol.Required("stop_name"): str,
            vol.Optional(
                "output_path",
                default="/config/www/jizdni_rady/timetable.json",
            ): str,
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return MHDOptionsFlow(config_entry)


class MHDOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self._config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = self._config_entry.data
        schema = vol.Schema({
            vol.Optional("output_path", default=current.get("output_path", "")): str,
        })
        return self.async_show_form(step_id="init", data_schema=schema)
