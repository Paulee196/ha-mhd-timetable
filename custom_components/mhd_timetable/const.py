DOMAIN = "mhd_timetable"
STORAGE_KEY = "mhd_timetable"
STORAGE_VERSION = 1

SCHEDULE_TYPES = ["workday", "saturday", "sunday", "holiday"]

SCHEDULE_LABELS = {
    "workday": "Pracovní den",
    "saturday": "Sobota",
    "sunday": "Neděle",
    "holiday": "Státní svátek",
}

# Czech public holidays as (month, day) tuples
CZ_HOLIDAYS_FIXED = [
    (1, 1),
    (5, 1),
    (5, 8),
    (7, 5),
    (7, 6),
    (9, 28),
    (10, 28),
    (11, 17),
    (12, 24),
    (12, 25),
    (12, 26),
]
