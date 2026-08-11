/**
 * Timetable Panel – standalone sidebar editor
 * Accessible from HA sidebar without needing a Lovelace card
 */

const BASE_TYPES = ["workday", "saturday", "sunday", "holiday"];

const TRANSPORT_META = [
  { key: "bus",        icon: "🚌", color: "#1976d2" },
  { key: "trolleybus", icon: "🚎", color: "#0097a7" },
  { key: "tram",       icon: "🚋", color: "#f57c00" },
  { key: "train",      icon: "🚂", color: "#388e3c" },
];

// Train categories offered per UI language (country conventions)
const TRAIN_CATEGORIES = {
  cs: [{ v: "R", l: "R – rychlík" }, { v: "Sp", l: "Sp – spěšný vlak" }, { v: "Ex", l: "Ex – expres" }],
  sk: [{ v: "R", l: "R – rýchlik" }, { v: "Zr", l: "Zr – zrýchlený vlak" }, { v: "REX", l: "REX – regionálny expres" }],
  en: [],
  de: [{ v: "S", l: "S – S-Bahn" }, { v: "RB", l: "RB – Regionalbahn" }, { v: "RE", l: "RE – Regional-Express" }, { v: "IRE", l: "IRE – Interregio-Express" }],
  fr: [{ v: "TER", l: "TER" }, { v: "RER", l: "RER" }],
  es: [{ v: "C", l: "C – Cercanías" }, { v: "MD", l: "MD – Media Distancia" }, { v: "R", l: "R – Regional" }],
};
const TCAT_COLORS = ["#d32f2f", "#7b1fa2", "#00796b", "#5d4037"];

// Schedule-combine presets: day types that share one timetable when chosen.
// Workday is never combined; vacation schedules are always separate.
const COMBINE_PRESETS = {
  none: [],
  weekend: [["saturday", "sunday"]],
  weekend_holiday: [["saturday", "sunday", "holiday"]],
  sunday_holiday: [["sunday", "holiday"]],
};
const COMBINE_ORDER = ["none", "weekend", "weekend_holiday", "sunday_holiday"];
const REPEAT_TYPES = ["yearly"];

const I18N = {
  cs: {
    title: "Jízdní řády", loading: "Načítání…",
    no_stops: "Žádné zastávky nejsou nakonfigurovány.",
    no_stops_hint: "Přidejte zastávku v <strong>Nastavení → Integrace → Jízdní řády</strong>.",
    help_tooltip: "Nápověda",
    tab_lines: "Spoje", tab_vacation: "Prázdniny", tab_notifications: "Notifikace",
    no_lines: "Zatím žádné spoje. Přidejte první spoj tlačítkem níže.",
    add_line: "+ Přidat spoj", save_changes: "Uložit změny", saving: "Ukládání…",
    unsaved_changes: "⚠ Máš neuložené změny – dokud neklikneš na \"Uložit změny\", při zavření nebo obnovení stránky se ztratí.",
    load_failed: "Nepodařilo se načíst data zastávky.", edit: "Upravit", vac_count: "+ {0} prázdn.",
    sched_workday: "Pracovní den", sched_saturday: "Sobota", sched_sunday: "Neděle", sched_holiday: "Státní svátek",
    sched_abbr_workday: "Prac. den", sched_abbr_saturday: "So", sched_abbr_sunday: "Ne", sched_abbr_holiday: "Svátek",
    combine_label: "Spojit jízdní řády (volitelné)",
    combine_none: "Nespojovat", combine_weekend: "Víkend (So + Ne)", combine_weekend_holiday: "So + Ne + svátek", combine_sunday_holiday: "Ne + svátek",
    combine_hint: "Spojené dny sdílejí jeden jízdní řád – vyplníte je jen jednou.",
    tt_bus: "Autobus", tt_trolleybus: "Trolejbus", tt_tram: "Tramvaj", tt_train: "Vlak",
    new_line: "Nový spoj", line_word: "Linka", train_word: "Vlak",
    transport_type: "Typ dopravy",
    train_category: "Kategorie vlaku (nepovinné)",
    train_cat_hint: "Vlaky stejným směrem patří do jedné linky. Kategorií rozlišíte rychlejší vlaky od osobních.",
    train_designation: "Označení linky (nepovinné)", train_designation_ph: "obvykle nechte prázdné",
    line_number: "Číslo linky",
    direction: "Směr (cílová zastávka)", route: "Trasa (zastávky oddělené čárkou)",
    custom_stop: "Jede z jiné zastávky", custom_stop_ph: "Název zastávky (např. Hlavní nádraží)",
    active_schedules: "Aktivní rozvrhy", vac_tabs_list: "Prázdninové záložky:",
    vac_tabs_empty: "Prázdninová období definujte v záložce <em>Prázdniny</em>.",
    grid_hint: "Kliknutím na hodinu rozbalíte minuty. Kliknutím na minutu ji přidáte nebo odeberete.",
    vac_grid_hint: "Jízdní řád pro <strong>{0}</strong>. Prázdné = použije se pracovní den.",
    chip_note_btn_title: "Jiná konečná / poznámka k odjezdu",
    chip_note_label: "Odjezd {0} – jiná konečná stanice",
    chip_note_ph: "Např. Nové Město (nepovinné)",
    chip_note_clear: "Odebrat poznámku",
    chip_skip_ph: "Nejede v (např. 1.1., 24.12.)",
    chip_skip_title: "Nejede: {0}",
    add_line_btn: "Přidat spoj", save_line: "Uložit spoj", back: "← Zpět",
    enter_direction: "Zadejte směr (cílovou zastávku).",
    train_exists: "Vlakový spoj tímto směrem a kategorií už existuje. Upravte ho v seznamu spojů, nebo zvolte jinou kategorii.",
    enter_line_number: "Zadejte číslo linky.",
    confirm_del_train: "Smazat vlak{0} směr {1}?", confirm_del_line: "Smazat spoj {0}?",
    vac_intro: "<strong>Státní svátky</strong> jsou rozpoznány automaticky podle nastavení vaší země v Home Assistant. Zde definujte školní a jiná prázdninová období.",
    groups_title: "Skupiny rozvrhu",
    groups_hint: "Seskupte více období pod jeden jízdní řád. Např. \"Prázdninový provoz\" pro letní i vánoční prázdniny.",
    groups_empty: "Žádné skupiny. Přidejte níže nebo nechte prázdné, pokud každé období má jiný rozvrh.",
    group_default: "Skupina", period_default: "Prázdniny",
    group_name_ph: "Název skupiny (např. Prázdninový provoz)", add_group: "+ Přidat skupinu",
    periods_title: "Prázdninová období", periods_empty: "Žádná období. Přidejte první níže.",
    no_group_opt: "— bez skupiny —", period_name_ph: "Název (např. Letní prázdniny)",
    repeat_label: "Opakovat každý rok", repeat_yearly: "Každý rok",
    notifications_intro: "Nastavte upozornění před odjezdem pro vybrané dny, čas a zařízení.",
    notifications_empty: "Žádné notifikace. Přidejte první níže.",
    notification_default: "Upozornění na odjezd", notification_name_ph: "Název (např. Ranní autobus)",
    notify_service: "Služba notifikace", notify_service_ph: "notify.mobile_app_telefon",
    notify_minutes: "Minut předem", notify_window: "Časové okno", notify_line: "Spoj",
    notify_all_lines: "Všechny spoje", notify_enabled: "Zapnuto", add_notification: "+ Přidat notifikaci",
    enter_notify_service: "Zadejte službu notifikace, např. notify.mobile_app_telefon.",
    day_0: "Po", day_1: "Út", day_2: "St", day_3: "Čt", day_4: "Pá", day_5: "So", day_6: "Ne",
    add: "+ Přidat", save: "Uložit",
    enter_group_name: "Zadejte název skupiny.", enter_dates: "Zadejte datum začátku a konce.",
    confirm_del_group: "Smazat skupinu \"{0}\"? Všechna nastavení rozvrhu pro tuto skupinu budou ztracena.",
    save_error: "Chyba při ukládání: ",
    help_title: "Jak to funguje",
    help_1: "<strong>Spoje</strong> přidáte v záložce <em>Spoje</em>. U každého spoje zvolíte typ dopravy (🚌 autobus, 🚎 trolejbus, 🚋 tramvaj, 🚂 vlak), směr a časy odjezdů pro jednotlivé typy dnů pomocí záložek. Kliknutím na hodinu rozbalíte minuty a kliknutím na minutu ji přidáte nebo odeberete. U jednotlivého odjezdu můžete přes ✎ nastavit i jinou konečnou stanici, pokud daný spoj výjimečně nejede na běžnou trasu.",
    help_2: "<strong>Vlaky</strong> nepotřebují číslo linky – stačí směr. Volitelně doplníte kategorii (R, Sp, Ex) nebo označení linky. Pokud spoj jede z jiné zastávky (např. vlakové nádraží), zaškrtněte <em>Jede z jiné zastávky</em> – karta ji pak zobrazí jako samostatnou sekci s vlastními barvami odjezdů.",
    help_3: "<strong>Státní svátky</strong> jsou rozpoznány automaticky podle nastavení země v Home Assistant. Nemusíte je nikde vypisovat. V editoru spoje stačí nastavit záložku <em>Státní svátek</em>.",
    help_4: "<strong>Prázdninová období</strong> si definujete ručně v záložce <em>Prázdniny</em>. Zadáte název (např. Letní prázdniny), datum od–do a volitelně každoroční opakování stejných dat.",
    help_5: "<strong>Skupiny rozvrhu</strong> slouží ke sdílení jednoho jízdního řádu pro více období. Pokud např. Letní prázdniny i Vánoce jedou stejně, vytvořte skupinu <em>Prázdninový provoz</em> a obě období do ní přiřaďte. V editoru spoje pak nastavíte časy jen jednou.",
    help_6: "<strong>Priorita</strong> při výběru jízdního řádu: Státní svátek → aktuální prázdninové období → Sobota/Neděle → Pracovní den. Pokud pro dané prázdniny časy nevyplníte, použije se automaticky pracovní den.",
    help_7: "<strong>Uložení</strong> — po všech změnách klikněte na <em>Uložit změny</em> dole. Senzor se aktualizuje okamžitě.",
    help_card_title: "Přidání karty na dashboard",
    help_card_auto: "Karta je připravena automaticky – na dashboardu zvolte <em>Upravit → Přidat kartu</em> a vyhledejte <strong>Jízdní řády</strong>. Senzor zastávky se doplní sám. Toto je doporučený postup.",
    help_card_hint: "Případně můžete kartu vložit ručně (Přidat kartu → Manuální):",
    copy: "Kopírovat", copied: "Zkopírováno ✓", copy_failed: "Nepodařilo se kopírovat",
  },
  sk: {
    title: "Cestovné poriadky", loading: "Načítavanie…",
    no_stops: "Nie sú nakonfigurované žiadne zastávky.",
    no_stops_hint: "Pridajte zastávku v <strong>Nastavenia → Integrácie → Cestovné poriadky</strong>.",
    help_tooltip: "Pomocník",
    tab_lines: "Spoje", tab_vacation: "Prázdniny", tab_notifications: "Notifikácie",
    no_lines: "Zatiaľ žiadne spoje. Pridajte prvý spoj tlačidlom nižšie.",
    add_line: "+ Pridať spoj", save_changes: "Uložiť zmeny", saving: "Ukladanie…",
    unsaved_changes: "⚠ Máš neuložené zmeny – kým neklikneš na \"Uložiť zmeny\", pri zatvorení alebo obnovení stránky sa stratia.",
    load_failed: "Nepodarilo sa načítať údaje zastávky.", edit: "Upraviť", vac_count: "+ {0} prázdn.",
    sched_workday: "Pracovný deň", sched_saturday: "Sobota", sched_sunday: "Nedeľa", sched_holiday: "Štátny sviatok",
    sched_abbr_workday: "Prac. deň", sched_abbr_saturday: "So", sched_abbr_sunday: "Ne", sched_abbr_holiday: "Sviatok",
    combine_label: "Spojiť cestovné poriadky (voliteľné)",
    combine_none: "Nespájať", combine_weekend: "Víkend (So + Ne)", combine_weekend_holiday: "So + Ne + sviatok", combine_sunday_holiday: "Ne + sviatok",
    combine_hint: "Spojené dni zdieľajú jeden cestovný poriadok – vyplníte ich len raz.",
    tt_bus: "Autobus", tt_trolleybus: "Trolejbus", tt_tram: "Električka", tt_train: "Vlak",
    new_line: "Nový spoj", line_word: "Linka", train_word: "Vlak",
    transport_type: "Typ dopravy",
    train_category: "Kategória vlaku (nepovinné)",
    train_cat_hint: "Vlaky rovnakým smerom patria do jednej linky. Kategóriou rozlíšite rýchlejšie vlaky od osobných.",
    train_designation: "Označenie linky (nepovinné)", train_designation_ph: "obvykle nechajte prázdne",
    line_number: "Číslo linky",
    direction: "Smer (cieľová zastávka)", route: "Trasa (zastávky oddelené čiarkou)",
    custom_stop: "Ide z inej zastávky", custom_stop_ph: "Názov zastávky (napr. Hlavná stanica)",
    active_schedules: "Aktívne rozvrhy", vac_tabs_list: "Prázdninové záložky:",
    vac_tabs_empty: "Prázdninové obdobia definujte v záložke <em>Prázdniny</em>.",
    grid_hint: "Kliknutím na hodinu rozbalíte minúty. Kliknutím na minútu ju pridáte alebo odoberiete.",
    vac_grid_hint: "Cestovný poriadok pre <strong>{0}</strong>. Prázdne = použije sa pracovný deň.",
    chip_note_btn_title: "Iná konečná / poznámka k odchodu",
    chip_note_label: "Odchod {0} – iná konečná stanica",
    chip_note_ph: "Napr. Nové Mesto (nepovinné)",
    chip_note_clear: "Odobrať poznámku",
    chip_skip_ph: "Nejde v (napr. 1.1., 24.12.)",
    chip_skip_title: "Nejde: {0}",
    add_line_btn: "Pridať spoj", save_line: "Uložiť spoj", back: "← Späť",
    enter_direction: "Zadajte smer (cieľovú zastávku).",
    train_exists: "Vlakový spoj týmto smerom a kategóriou už existuje. Upravte ho v zozname spojov, alebo zvoľte inú kategóriu.",
    enter_line_number: "Zadajte číslo linky.",
    confirm_del_train: "Zmazať vlak{0} smer {1}?", confirm_del_line: "Zmazať spoj {0}?",
    vac_intro: "<strong>Štátne sviatky</strong> sú rozpoznané automaticky podľa nastavenia vašej krajiny v Home Assistant. Tu definujte školské a iné prázdninové obdobia.",
    groups_title: "Skupiny rozvrhu",
    groups_hint: "Zoskupte viac období pod jeden cestovný poriadok. Napr. \"Prázdninová prevádzka\" pre letné aj vianočné prázdniny.",
    groups_empty: "Žiadne skupiny. Pridajte nižšie alebo nechajte prázdne, ak má každé obdobie iný rozvrh.",
    group_default: "Skupina", period_default: "Prázdniny",
    group_name_ph: "Názov skupiny (napr. Prázdninová prevádzka)", add_group: "+ Pridať skupinu",
    periods_title: "Prázdninové obdobia", periods_empty: "Žiadne obdobia. Pridajte prvé nižšie.",
    no_group_opt: "— bez skupiny —", period_name_ph: "Názov (napr. Letné prázdniny)",
    repeat_label: "Opakovať každý rok", repeat_yearly: "Každý rok",
    notifications_intro: "Nastavte upozornenia pred odchodom pre vybrané dni, čas a zariadenie.",
    notifications_empty: "Žiadne notifikácie. Pridajte prvú nižšie.",
    notification_default: "Upozornenie na odchod", notification_name_ph: "Názov (napr. Ranný autobus)",
    notify_service: "Služba notifikácie", notify_service_ph: "notify.mobile_app_telefon",
    notify_minutes: "Minút vopred", notify_window: "Časové okno", notify_line: "Spoj",
    notify_all_lines: "Všetky spoje", notify_enabled: "Zapnuté", add_notification: "+ Pridať notifikáciu",
    enter_notify_service: "Zadajte službu notifikácie, napr. notify.mobile_app_telefon.",
    day_0: "Po", day_1: "Ut", day_2: "St", day_3: "Št", day_4: "Pi", day_5: "So", day_6: "Ne",
    add: "+ Pridať", save: "Uložiť",
    enter_group_name: "Zadajte názov skupiny.", enter_dates: "Zadajte dátum začiatku a konca.",
    confirm_del_group: "Zmazať skupinu \"{0}\"? Všetky nastavenia rozvrhu pre túto skupinu budú stratené.",
    save_error: "Chyba pri ukladaní: ",
    help_title: "Ako to funguje",
    help_1: "<strong>Spoje</strong> pridáte v záložke <em>Spoje</em>. Pri každom spoji zvolíte typ dopravy (🚌 autobus, 🚎 trolejbus, 🚋 električka, 🚂 vlak), smer a časy odchodov pre jednotlivé typy dní pomocou záložiek. Kliknutím na hodinu rozbalíte minúty a kliknutím na minútu ju pridáte alebo odoberiete. Pri jednotlivom odchode môžete cez ✎ nastaviť aj inú konečnú stanicu, ak daný spoj výnimočne nejde na bežnú trasu.",
    help_2: "<strong>Vlaky</strong> nepotrebujú číslo linky – stačí smer. Voliteľne doplníte kategóriu (R, Zr, REX) alebo označenie linky. Ak spoj ide z inej zastávky (napr. železničná stanica), zaškrtnite <em>Ide z inej zastávky</em> – karta ju potom zobrazí ako samostatnú sekciu s vlastnými farbami odchodov.",
    help_3: "<strong>Štátne sviatky</strong> sú rozpoznané automaticky podľa nastavenia krajiny v Home Assistant. Nemusíte ich nikde vypisovať. V editore spoja stačí nastaviť záložku <em>Štátny sviatok</em>.",
    help_4: "<strong>Prázdninové obdobia</strong> si definujete ručne v záložke <em>Prázdniny</em>. Zadáte názov (napr. Letné prázdniny), dátum od–do a voliteľne každoročné opakovanie rovnakých dátumov.",
    help_5: "<strong>Skupiny rozvrhu</strong> slúžia na zdieľanie jedného cestovného poriadku pre viac období. Ak napr. Letné prázdniny aj Vianoce idú rovnako, vytvorte skupinu <em>Prázdninová prevádzka</em> a obe obdobia do nej priraďte.",
    help_6: "<strong>Priorita</strong> pri výbere cestovného poriadku: Štátny sviatok → aktuálne prázdninové obdobie → Sobota/Nedeľa → Pracovný deň. Ak pre dané prázdniny časy nevyplníte, použije sa automaticky pracovný deň.",
    help_7: "<strong>Uloženie</strong> — po všetkých zmenách kliknite na <em>Uložiť zmeny</em> dole. Senzor sa aktualizuje okamžite.",
    help_card_title: "Pridanie karty na dashboard",
    help_card_auto: "Karta je pripravená automaticky – na dashboarde zvoľte <em>Upraviť → Pridať kartu</em> a vyhľadajte <strong>Cestovné poriadky</strong>. Senzor zastávky sa doplní sám. Toto je odporúčaný postup.",
    help_card_hint: "Prípadne môžete kartu vložiť ručne (Pridať kartu → Manuálne):",
    copy: "Kopírovať", copied: "Skopírované ✓", copy_failed: "Nepodarilo sa kopírovať",
  },
  en: {
    title: "Timetables", loading: "Loading…",
    no_stops: "No stops are configured.",
    no_stops_hint: "Add a stop in <strong>Settings → Integrations → Timetables</strong>.",
    help_tooltip: "Help",
    tab_lines: "Lines", tab_vacation: "Vacations", tab_notifications: "Notifications",
    no_lines: "No lines yet. Add your first line below.",
    add_line: "+ Add line", save_changes: "Save changes", saving: "Saving…",
    unsaved_changes: "⚠ You have unsaved changes – they will be lost if you close or reload the page before clicking \"Save changes\".",
    load_failed: "Failed to load stop data.", edit: "Edit", vac_count: "+ {0} vac.",
    sched_workday: "Workday", sched_saturday: "Saturday", sched_sunday: "Sunday", sched_holiday: "Public holiday",
    sched_abbr_workday: "Workday", sched_abbr_saturday: "Sat", sched_abbr_sunday: "Sun", sched_abbr_holiday: "Holiday",
    combine_label: "Combine schedules (optional)",
    combine_none: "Don't combine", combine_weekend: "Weekend (Sat + Sun)", combine_weekend_holiday: "Sat + Sun + holiday", combine_sunday_holiday: "Sun + holiday",
    combine_hint: "Combined days share one timetable – you fill it in only once.",
    tt_bus: "Bus", tt_trolleybus: "Trolleybus", tt_tram: "Tram", tt_train: "Train",
    new_line: "New line", line_word: "Line", train_word: "Train",
    transport_type: "Transport type",
    train_category: "Train category (optional)",
    train_cat_hint: "Trains heading the same direction belong to one line. Use the category to distinguish faster trains from local ones.",
    train_designation: "Line designation (optional)", train_designation_ph: "e.g. S3, RE5",
    line_number: "Line number",
    direction: "Direction (final stop)", route: "Route (stops separated by commas)",
    custom_stop: "Departs from a different stop", custom_stop_ph: "Stop name (e.g. Central Station)",
    active_schedules: "Active schedules", vac_tabs_list: "Vacation tabs:",
    vac_tabs_empty: "Define vacation periods in the <em>Vacations</em> tab.",
    grid_hint: "Click an hour to expand minutes. Click a minute to add or remove it.",
    vac_grid_hint: "Timetable for <strong>{0}</strong>. Empty = the workday schedule is used.",
    chip_note_btn_title: "Different terminus / note for this departure",
    chip_note_label: "Departure {0} – different terminus",
    chip_note_ph: "E.g. Downtown (optional)",
    chip_note_clear: "Remove note",
    chip_skip_ph: "Doesn't run on (e.g. 1.1, 24.12)",
    chip_skip_title: "Doesn't run: {0}",
    add_line_btn: "Add line", save_line: "Save line", back: "← Back",
    enter_direction: "Enter the direction (final stop).",
    train_exists: "A train line with this direction and category already exists. Edit it in the line list or pick a different category.",
    enter_line_number: "Enter the line number.",
    confirm_del_train: "Delete train{0} to {1}?", confirm_del_line: "Delete line {0}?",
    vac_intro: "<strong>Public holidays</strong> are detected automatically from your country setting in Home Assistant. Define school and other vacation periods here.",
    groups_title: "Schedule groups",
    groups_hint: "Group multiple periods under one timetable. E.g. \"Vacation service\" for both summer and Christmas breaks.",
    groups_empty: "No groups. Add one below, or leave empty if every period has its own schedule.",
    group_default: "Group", period_default: "Vacation",
    group_name_ph: "Group name (e.g. Vacation service)", add_group: "+ Add group",
    periods_title: "Vacation periods", periods_empty: "No periods. Add the first one below.",
    no_group_opt: "— no group —", period_name_ph: "Name (e.g. Summer break)",
    repeat_label: "Repeat every year", repeat_yearly: "Every year",
    notifications_intro: "Set departure reminders for selected days, time windows and notification devices.",
    notifications_empty: "No notifications. Add the first one below.",
    notification_default: "Departure reminder", notification_name_ph: "Name (e.g. Morning bus)",
    notify_service: "Notification service", notify_service_ph: "notify.mobile_app_phone",
    notify_minutes: "Minutes before", notify_window: "Time window", notify_line: "Line",
    notify_all_lines: "All lines", notify_enabled: "Enabled", add_notification: "+ Add notification",
    enter_notify_service: "Enter a notification service, e.g. notify.mobile_app_phone.",
    day_0: "Mon", day_1: "Tue", day_2: "Wed", day_3: "Thu", day_4: "Fri", day_5: "Sat", day_6: "Sun",
    add: "+ Add", save: "Save",
    enter_group_name: "Enter a group name.", enter_dates: "Enter start and end dates.",
    confirm_del_group: "Delete group \"{0}\"? All schedule settings for this group will be lost.",
    save_error: "Error while saving: ",
    help_title: "How it works",
    help_1: "<strong>Lines</strong> are added in the <em>Lines</em> tab. For each one pick the transport type (🚌 bus, 🚎 trolleybus, 🚋 tram, 🚂 train), the direction and the departure times per day type using the tabs. Click an hour to expand minutes, click a minute to add or remove it. Use the ✎ on a placed minute to give that one departure a different terminus, for trips that exceptionally don't run the line's usual route.",
    help_2: "<strong>Trains</strong> do not need a line number – the direction is enough. Optionally add a category or a line designation (e.g. S3). If a service departs from a different stop (e.g. the railway station), tick <em>Departs from a different stop</em> – the card then shows that stop as a separate section with its own departure colors.",
    help_3: "<strong>Public holidays</strong> are detected automatically from the country setting in Home Assistant. You do not need to list them. Just configure the <em>Public holiday</em> tab in the editor.",
    help_4: "<strong>Vacation periods</strong> are defined manually in the <em>Vacations</em> tab. Enter a name (e.g. Summer break), a from–to date and optionally repeat the same dates every year.",
    help_5: "<strong>Schedule groups</strong> share one timetable across multiple periods. If e.g. summer and Christmas run the same, create a group <em>Vacation service</em> and assign both periods to it.",
    help_6: "<strong>Priority</strong> when picking the timetable: Public holiday → current vacation period → Saturday/Sunday → Workday. If you leave a vacation empty, the workday schedule is used.",
    help_7: "<strong>Saving</strong> — after all changes click <em>Save changes</em> at the bottom. The sensor updates immediately.",
    help_card_title: "Adding the card to a dashboard",
    help_card_auto: "The card is ready automatically – on your dashboard choose <em>Edit → Add card</em> and search for <strong>Timetables</strong>. The stop sensor is filled in for you. This is the recommended way.",
    help_card_hint: "Alternatively you can add the card manually (Add card → Manual):",
    copy: "Copy", copied: "Copied ✓", copy_failed: "Copy failed",
  },
  de: {
    title: "Fahrpläne", loading: "Wird geladen…",
    no_stops: "Keine Haltestellen konfiguriert.",
    no_stops_hint: "Fügen Sie eine Haltestelle unter <strong>Einstellungen → Integrationen → Fahrpläne</strong> hinzu.",
    help_tooltip: "Hilfe",
    tab_lines: "Linien", tab_vacation: "Ferien", tab_notifications: "Benachrichtigungen",
    no_lines: "Noch keine Linien. Fügen Sie unten die erste Linie hinzu.",
    add_line: "+ Linie hinzufügen", save_changes: "Änderungen speichern", saving: "Wird gespeichert…",
    unsaved_changes: "⚠ Es gibt ungespeicherte Änderungen – sie gehen verloren, wenn Sie die Seite schließen oder neu laden, bevor Sie auf \"Änderungen speichern\" klicken.",
    load_failed: "Daten der Haltestelle konnten nicht geladen werden.", edit: "Bearbeiten", vac_count: "+ {0} Ferien",
    sched_workday: "Werktag", sched_saturday: "Samstag", sched_sunday: "Sonntag", sched_holiday: "Feiertag",
    sched_abbr_workday: "Werktag", sched_abbr_saturday: "Sa", sched_abbr_sunday: "So", sched_abbr_holiday: "Feiertag",
    combine_label: "Fahrpläne zusammenfassen (optional)",
    combine_none: "Nicht zusammenfassen", combine_weekend: "Wochenende (Sa + So)", combine_weekend_holiday: "Sa + So + Feiertag", combine_sunday_holiday: "So + Feiertag",
    combine_hint: "Zusammengefasste Tage teilen einen Fahrplan – Sie füllen ihn nur einmal aus.",
    tt_bus: "Bus", tt_trolleybus: "O-Bus", tt_tram: "Straßenbahn", tt_train: "Zug",
    new_line: "Neue Linie", line_word: "Linie", train_word: "Zug",
    transport_type: "Verkehrsmittel",
    train_category: "Zuggattung (optional)",
    train_cat_hint: "Züge in dieselbe Richtung gehören zu einer Linie. Mit der Gattung unterscheiden Sie schnellere Züge von Regionalzügen.",
    train_designation: "Linienbezeichnung (optional)", train_designation_ph: "z. B. S3, RE5, RB27",
    line_number: "Liniennummer",
    direction: "Richtung (Endhaltestelle)", route: "Strecke (Haltestellen durch Komma getrennt)",
    custom_stop: "Fährt von einer anderen Haltestelle", custom_stop_ph: "Name der Haltestelle (z. B. Hauptbahnhof)",
    active_schedules: "Aktive Fahrpläne", vac_tabs_list: "Ferien-Tabs:",
    vac_tabs_empty: "Ferienzeiten definieren Sie im Tab <em>Ferien</em>.",
    grid_hint: "Klicken Sie auf eine Stunde, um die Minuten aufzuklappen. Klicken Sie auf eine Minute, um sie hinzuzufügen oder zu entfernen.",
    vac_grid_hint: "Fahrplan für <strong>{0}</strong>. Leer = der Werktagsfahrplan wird verwendet.",
    chip_note_btn_title: "Andere Endstation / Hinweis für diese Abfahrt",
    chip_note_label: "Abfahrt {0} – andere Endstation",
    chip_note_ph: "Z. B. Innenstadt (optional)",
    chip_note_clear: "Hinweis entfernen",
    chip_skip_ph: "Fährt nicht am (z. B. 1.1., 24.12.)",
    chip_skip_title: "Fährt nicht: {0}",
    add_line_btn: "Linie hinzufügen", save_line: "Linie speichern", back: "← Zurück",
    enter_direction: "Geben Sie die Richtung (Endhaltestelle) ein.",
    train_exists: "Eine Zuglinie mit dieser Richtung und Gattung existiert bereits. Bearbeiten Sie sie in der Linienliste oder wählen Sie eine andere Gattung.",
    enter_line_number: "Geben Sie die Liniennummer ein.",
    confirm_del_train: "Zug{0} Richtung {1} löschen?", confirm_del_line: "Linie {0} löschen?",
    vac_intro: "<strong>Feiertage</strong> werden automatisch anhand der Ländereinstellung in Home Assistant erkannt. Definieren Sie hier Schulferien und andere Ferienzeiten.",
    groups_title: "Fahrplangruppen",
    groups_hint: "Fassen Sie mehrere Zeiträume unter einem Fahrplan zusammen, z. B. \"Ferienbetrieb\" für Sommer- und Weihnachtsferien.",
    groups_empty: "Keine Gruppen. Unten hinzufügen oder leer lassen, wenn jeder Zeitraum einen eigenen Fahrplan hat.",
    group_default: "Gruppe", period_default: "Ferien",
    group_name_ph: "Gruppenname (z. B. Ferienbetrieb)", add_group: "+ Gruppe hinzufügen",
    periods_title: "Ferienzeiten", periods_empty: "Keine Zeiträume. Fügen Sie unten den ersten hinzu.",
    no_group_opt: "— ohne Gruppe —", period_name_ph: "Name (z. B. Sommerferien)",
    repeat_label: "Jedes Jahr wiederholen", repeat_yearly: "Jedes Jahr",
    notifications_intro: "Richten Sie Abfahrtserinnerungen für ausgewählte Tage, Zeitfenster und Geräte ein.",
    notifications_empty: "Keine Benachrichtigungen. Fügen Sie unten die erste hinzu.",
    notification_default: "Abfahrtserinnerung", notification_name_ph: "Name (z. B. Morgenbus)",
    notify_service: "Benachrichtigungsdienst", notify_service_ph: "notify.mobile_app_phone",
    notify_minutes: "Minuten vorher", notify_window: "Zeitfenster", notify_line: "Linie",
    notify_all_lines: "Alle Linien", notify_enabled: "Aktiv", add_notification: "+ Benachrichtigung hinzufügen",
    enter_notify_service: "Geben Sie einen Benachrichtigungsdienst ein, z. B. notify.mobile_app_phone.",
    day_0: "Mo", day_1: "Di", day_2: "Mi", day_3: "Do", day_4: "Fr", day_5: "Sa", day_6: "So",
    add: "+ Hinzufügen", save: "Speichern",
    enter_group_name: "Geben Sie einen Gruppennamen ein.", enter_dates: "Geben Sie Start- und Enddatum ein.",
    confirm_del_group: "Gruppe \"{0}\" löschen? Alle Fahrplaneinstellungen dieser Gruppe gehen verloren.",
    save_error: "Fehler beim Speichern: ",
    help_title: "So funktioniert es",
    help_1: "<strong>Linien</strong> fügen Sie im Tab <em>Linien</em> hinzu. Für jede wählen Sie das Verkehrsmittel (🚌 Bus, 🚎 O-Bus, 🚋 Straßenbahn, 🚂 Zug), die Richtung und die Abfahrtszeiten pro Tagestyp über die Tabs. Klicken Sie auf eine Stunde, um die Minuten aufzuklappen. Über das ✎-Symbol an einer Minute können Sie für diese eine Abfahrt eine andere Endstation festlegen, falls diese Fahrt ausnahmsweise nicht die übliche Strecke fährt.",
    help_2: "<strong>Züge</strong> brauchen keine Liniennummer – die Richtung genügt. Optional ergänzen Sie eine Gattung (S, RB, RE, IRE) oder eine Linienbezeichnung (z. B. S3). Fährt ein Zug von einer anderen Haltestelle (z. B. dem Bahnhof), aktivieren Sie <em>Fährt von einer anderen Haltestelle</em> – die Karte zeigt diese dann als eigenen Abschnitt mit eigenen Abfahrtsfarben.",
    help_3: "<strong>Feiertage</strong> werden automatisch anhand der Ländereinstellung in Home Assistant erkannt. Sie müssen sie nirgends eintragen. Konfigurieren Sie im Editor einfach den Tab <em>Feiertag</em>.",
    help_4: "<strong>Ferienzeiten</strong> definieren Sie manuell im Tab <em>Ferien</em>. Geben Sie einen Namen (z. B. Sommerferien), ein Von–Bis-Datum und optional eine jährliche Wiederholung derselben Daten ein.",
    help_5: "<strong>Fahrplangruppen</strong> teilen einen Fahrplan über mehrere Zeiträume. Wenn z. B. Sommer- und Weihnachtsferien gleich verkehren, erstellen Sie eine Gruppe <em>Ferienbetrieb</em> und weisen Sie beide Zeiträume zu.",
    help_6: "<strong>Priorität</strong> bei der Fahrplanwahl: Feiertag → aktuelle Ferienzeit → Samstag/Sonntag → Werktag. Bleibt eine Ferienzeit leer, wird der Werktagsfahrplan verwendet.",
    help_7: "<strong>Speichern</strong> — klicken Sie nach allen Änderungen unten auf <em>Änderungen speichern</em>. Der Sensor aktualisiert sich sofort.",
    help_card_title: "Karte zum Dashboard hinzufügen",
    help_card_auto: "Die Karte ist automatisch bereit – wählen Sie auf dem Dashboard <em>Bearbeiten → Karte hinzufügen</em> und suchen Sie nach <strong>Fahrpläne</strong>. Der Haltestellen-Sensor wird automatisch ausgefüllt. Dies ist der empfohlene Weg.",
    help_card_hint: "Alternativ können Sie die Karte manuell hinzufügen (Karte hinzufügen → Manuell):",
    copy: "Kopieren", copied: "Kopiert ✓", copy_failed: "Kopieren fehlgeschlagen",
  },
  fr: {
    title: "Horaires", loading: "Chargement…",
    no_stops: "Aucun arrêt configuré.",
    no_stops_hint: "Ajoutez un arrêt dans <strong>Paramètres → Intégrations → Horaires</strong>.",
    help_tooltip: "Aide",
    tab_lines: "Lignes", tab_vacation: "Vacances", tab_notifications: "Notifications",
    no_lines: "Aucune ligne pour l'instant. Ajoutez la première ligne ci-dessous.",
    add_line: "+ Ajouter une ligne", save_changes: "Enregistrer les modifications", saving: "Enregistrement…",
    unsaved_changes: "⚠ Vous avez des modifications non enregistrées – elles seront perdues si vous fermez ou rechargez la page avant de cliquer sur \"Enregistrer les modifications\".",
    load_failed: "Impossible de charger les données de l'arrêt.", edit: "Modifier", vac_count: "+ {0} vac.",
    sched_workday: "Jour ouvré", sched_saturday: "Samedi", sched_sunday: "Dimanche", sched_holiday: "Jour férié",
    sched_abbr_workday: "Ouvré", sched_abbr_saturday: "Sam", sched_abbr_sunday: "Dim", sched_abbr_holiday: "Férié",
    combine_label: "Combiner les horaires (facultatif)",
    combine_none: "Ne pas combiner", combine_weekend: "Week-end (Sam + Dim)", combine_weekend_holiday: "Sam + Dim + férié", combine_sunday_holiday: "Dim + férié",
    combine_hint: "Les jours combinés partagent un horaire – vous ne le remplissez qu'une fois.",
    tt_bus: "Bus", tt_trolleybus: "Trolleybus", tt_tram: "Tramway", tt_train: "Train",
    new_line: "Nouvelle ligne", line_word: "Ligne", train_word: "Train",
    transport_type: "Type de transport",
    train_category: "Catégorie de train (facultatif)",
    train_cat_hint: "Les trains dans la même direction appartiennent à une seule ligne. La catégorie distingue les trains rapides des omnibus.",
    train_designation: "Désignation de la ligne (facultatif)", train_designation_ph: "p. ex. RER A, ligne H",
    line_number: "Numéro de ligne",
    direction: "Direction (terminus)", route: "Itinéraire (arrêts séparés par des virgules)",
    custom_stop: "Part d'un autre arrêt", custom_stop_ph: "Nom de l'arrêt (p. ex. Gare centrale)",
    active_schedules: "Horaires actifs", vac_tabs_list: "Onglets vacances :",
    vac_tabs_empty: "Définissez les périodes de vacances dans l'onglet <em>Vacances</em>.",
    grid_hint: "Cliquez sur une heure pour déplier les minutes. Cliquez sur une minute pour l'ajouter ou la retirer.",
    vac_grid_hint: "Horaire pour <strong>{0}</strong>. Vide = l'horaire de jour ouvré est utilisé.",
    chip_note_btn_title: "Terminus différent / note pour ce départ",
    chip_note_label: "Départ {0} – terminus différent",
    chip_note_ph: "Ex. Centre-ville (facultatif)",
    chip_note_clear: "Supprimer la note",
    chip_skip_ph: "Ne circule pas le (ex. 1.1, 24.12)",
    chip_skip_title: "Ne circule pas : {0}",
    add_line_btn: "Ajouter la ligne", save_line: "Enregistrer la ligne", back: "← Retour",
    enter_direction: "Saisissez la direction (terminus).",
    train_exists: "Une ligne de train avec cette direction et cette catégorie existe déjà. Modifiez-la dans la liste ou choisissez une autre catégorie.",
    enter_line_number: "Saisissez le numéro de ligne.",
    confirm_del_train: "Supprimer le train{0} direction {1} ?", confirm_del_line: "Supprimer la ligne {0} ?",
    vac_intro: "<strong>Les jours fériés</strong> sont détectés automatiquement selon le pays configuré dans Home Assistant. Définissez ici les vacances scolaires et autres périodes.",
    groups_title: "Groupes d'horaires",
    groups_hint: "Regroupez plusieurs périodes sous un même horaire, p. ex. \"Service vacances\" pour l'été et Noël.",
    groups_empty: "Aucun groupe. Ajoutez-en un ci-dessous, ou laissez vide si chaque période a son propre horaire.",
    group_default: "Groupe", period_default: "Vacances",
    group_name_ph: "Nom du groupe (p. ex. Service vacances)", add_group: "+ Ajouter un groupe",
    periods_title: "Périodes de vacances", periods_empty: "Aucune période. Ajoutez la première ci-dessous.",
    no_group_opt: "— sans groupe —", period_name_ph: "Nom (p. ex. Vacances d'été)",
    repeat_label: "Répéter chaque année", repeat_yearly: "Chaque année",
    notifications_intro: "Configurez des rappels de départ pour certains jours, créneaux horaires et appareils.",
    notifications_empty: "Aucune notification. Ajoutez la première ci-dessous.",
    notification_default: "Rappel de départ", notification_name_ph: "Nom (p. ex. bus du matin)",
    notify_service: "Service de notification", notify_service_ph: "notify.mobile_app_phone",
    notify_minutes: "Minutes avant", notify_window: "Créneau horaire", notify_line: "Ligne",
    notify_all_lines: "Toutes les lignes", notify_enabled: "Activé", add_notification: "+ Ajouter une notification",
    enter_notify_service: "Saisissez un service de notification, p. ex. notify.mobile_app_phone.",
    day_0: "Lun", day_1: "Mar", day_2: "Mer", day_3: "Jeu", day_4: "Ven", day_5: "Sam", day_6: "Dim",
    add: "+ Ajouter", save: "Enregistrer",
    enter_group_name: "Saisissez un nom de groupe.", enter_dates: "Saisissez les dates de début et de fin.",
    confirm_del_group: "Supprimer le groupe \"{0}\" ? Tous les réglages d'horaire de ce groupe seront perdus.",
    save_error: "Erreur lors de l'enregistrement : ",
    help_title: "Comment ça marche",
    help_1: "<strong>Les lignes</strong> s'ajoutent dans l'onglet <em>Lignes</em>. Pour chacune, choisissez le type de transport (🚌 bus, 🚎 trolleybus, 🚋 tramway, 🚂 train), la direction et les heures de départ par type de jour via les onglets. Cliquez sur une heure pour déplier les minutes. Utilisez le ✎ sur une minute pour donner à ce seul départ un terminus différent, pour les courses qui ne suivent exceptionnellement pas l'itinéraire habituel.",
    help_2: "<strong>Les trains</strong> n'ont pas besoin de numéro de ligne – la direction suffit. Ajoutez éventuellement une catégorie (TER, RER) ou une désignation (p. ex. RER A). Si un train part d'un autre arrêt (p. ex. la gare), cochez <em>Part d'un autre arrêt</em> – la carte l'affiche alors comme une section séparée avec ses propres couleurs de départs.",
    help_3: "<strong>Les jours fériés</strong> sont détectés automatiquement selon le pays configuré dans Home Assistant. Vous n'avez rien à saisir. Configurez simplement l'onglet <em>Jour férié</em> dans l'éditeur.",
    help_4: "<strong>Les périodes de vacances</strong> se définissent manuellement dans l'onglet <em>Vacances</em>. Saisissez un nom (p. ex. Vacances d'été), des dates de début et fin et, si besoin, une répétition annuelle des mêmes dates.",
    help_5: "<strong>Les groupes d'horaires</strong> partagent un horaire entre plusieurs périodes. Si p. ex. l'été et Noël circulent pareil, créez un groupe <em>Service vacances</em> et affectez-y les deux périodes.",
    help_6: "<strong>Priorité</strong> du choix de l'horaire : Jour férié → période de vacances en cours → Samedi/Dimanche → Jour ouvré. Si une période reste vide, l'horaire de jour ouvré est utilisé.",
    help_7: "<strong>Enregistrement</strong> — après vos modifications, cliquez sur <em>Enregistrer les modifications</em> en bas. Le capteur se met à jour immédiatement.",
    help_card_title: "Ajouter la carte au tableau de bord",
    help_card_auto: "La carte est prête automatiquement – sur votre tableau de bord, choisissez <em>Modifier → Ajouter une carte</em> et recherchez <strong>Horaires</strong>. Le capteur de l'arrêt est rempli automatiquement. C'est la méthode recommandée.",
    help_card_hint: "Vous pouvez aussi ajouter la carte manuellement (Ajouter une carte → Manuel) :",
    copy: "Copier", copied: "Copié ✓", copy_failed: "Échec de la copie",
  },
  es: {
    title: "Horarios", loading: "Cargando…",
    no_stops: "No hay paradas configuradas.",
    no_stops_hint: "Añada una parada en <strong>Ajustes → Integraciones → Horarios</strong>.",
    help_tooltip: "Ayuda",
    tab_lines: "Líneas", tab_vacation: "Vacaciones", tab_notifications: "Notificaciones",
    no_lines: "Aún no hay líneas. Añada la primera línea abajo.",
    add_line: "+ Añadir línea", save_changes: "Guardar cambios", saving: "Guardando…",
    unsaved_changes: "⚠ Tienes cambios sin guardar – se perderán si cierras o recargas la página antes de pulsar \"Guardar cambios\".",
    load_failed: "No se pudieron cargar los datos de la parada.", edit: "Editar", vac_count: "+ {0} vac.",
    sched_workday: "Día laborable", sched_saturday: "Sábado", sched_sunday: "Domingo", sched_holiday: "Festivo",
    sched_abbr_workday: "Laborable", sched_abbr_saturday: "Sáb", sched_abbr_sunday: "Dom", sched_abbr_holiday: "Festivo",
    combine_label: "Combinar horarios (opcional)",
    combine_none: "No combinar", combine_weekend: "Fin de semana (Sáb + Dom)", combine_weekend_holiday: "Sáb + Dom + festivo", combine_sunday_holiday: "Dom + festivo",
    combine_hint: "Los días combinados comparten un horario: solo lo rellena una vez.",
    tt_bus: "Autobús", tt_trolleybus: "Trolebús", tt_tram: "Tranvía", tt_train: "Tren",
    new_line: "Nueva línea", line_word: "Línea", train_word: "Tren",
    transport_type: "Tipo de transporte",
    train_category: "Categoría del tren (opcional)",
    train_cat_hint: "Los trenes en la misma dirección pertenecen a una sola línea. La categoría distingue los trenes rápidos de los regionales.",
    train_designation: "Designación de la línea (opcional)", train_designation_ph: "p. ej. C1, C4",
    line_number: "Número de línea",
    direction: "Dirección (parada final)", route: "Recorrido (paradas separadas por comas)",
    custom_stop: "Sale de otra parada", custom_stop_ph: "Nombre de la parada (p. ej. Estación Central)",
    active_schedules: "Horarios activos", vac_tabs_list: "Pestañas de vacaciones:",
    vac_tabs_empty: "Defina los periodos de vacaciones en la pestaña <em>Vacaciones</em>.",
    grid_hint: "Haga clic en una hora para desplegar los minutos. Haga clic en un minuto para añadirlo o quitarlo.",
    vac_grid_hint: "Horario para <strong>{0}</strong>. Vacío = se usa el horario laborable.",
    chip_note_btn_title: "Destino diferente / nota para esta salida",
    chip_note_label: "Salida {0} – destino diferente",
    chip_note_ph: "Ej. Centro (opcional)",
    chip_note_clear: "Quitar nota",
    chip_skip_ph: "No circula el (ej. 1.1, 24.12)",
    chip_skip_title: "No circula: {0}",
    add_line_btn: "Añadir línea", save_line: "Guardar línea", back: "← Atrás",
    enter_direction: "Introduzca la dirección (parada final).",
    train_exists: "Ya existe una línea de tren con esta dirección y categoría. Edítela en la lista o elija otra categoría.",
    enter_line_number: "Introduzca el número de línea.",
    confirm_del_train: "¿Eliminar el tren{0} dirección {1}?", confirm_del_line: "¿Eliminar la línea {0}?",
    vac_intro: "<strong>Los festivos</strong> se detectan automáticamente según el país configurado en Home Assistant. Defina aquí las vacaciones escolares y otros periodos.",
    groups_title: "Grupos de horarios",
    groups_hint: "Agrupe varios periodos bajo un mismo horario, p. ej. \"Servicio de vacaciones\" para verano y Navidad.",
    groups_empty: "No hay grupos. Añada uno abajo o déjelo vacío si cada periodo tiene su propio horario.",
    group_default: "Grupo", period_default: "Vacaciones",
    group_name_ph: "Nombre del grupo (p. ej. Servicio de vacaciones)", add_group: "+ Añadir grupo",
    periods_title: "Periodos de vacaciones", periods_empty: "No hay periodos. Añada el primero abajo.",
    no_group_opt: "— sin grupo —", period_name_ph: "Nombre (p. ej. Vacaciones de verano)",
    repeat_label: "Repetir cada año", repeat_yearly: "Cada año",
    notifications_intro: "Configure recordatorios de salida para días, franjas horarias y dispositivos seleccionados.",
    notifications_empty: "No hay notificaciones. Añada la primera abajo.",
    notification_default: "Recordatorio de salida", notification_name_ph: "Nombre (p. ej. autobús de la mañana)",
    notify_service: "Servicio de notificación", notify_service_ph: "notify.mobile_app_phone",
    notify_minutes: "Minutos antes", notify_window: "Franja horaria", notify_line: "Línea",
    notify_all_lines: "Todas las líneas", notify_enabled: "Activado", add_notification: "+ Añadir notificación",
    enter_notify_service: "Introduzca un servicio de notificación, p. ej. notify.mobile_app_phone.",
    day_0: "Lun", day_1: "Mar", day_2: "Mié", day_3: "Jue", day_4: "Vie", day_5: "Sáb", day_6: "Dom",
    add: "+ Añadir", save: "Guardar",
    enter_group_name: "Introduzca un nombre de grupo.", enter_dates: "Introduzca las fechas de inicio y fin.",
    confirm_del_group: "¿Eliminar el grupo \"{0}\"? Se perderán todos los ajustes de horario de este grupo.",
    save_error: "Error al guardar: ",
    help_title: "Cómo funciona",
    help_1: "<strong>Las líneas</strong> se añaden en la pestaña <em>Líneas</em>. Para cada una elija el tipo de transporte (🚌 autobús, 🚎 trolebús, 🚋 tranvía, 🚂 tren), la dirección y las horas de salida por tipo de día mediante las pestañas. Haga clic en una hora para desplegar los minutos. Use el ✎ en un minuto para dar a esa salida un destino diferente, para los servicios que excepcionalmente no siguen la ruta habitual.",
    help_2: "<strong>Los trenes</strong> no necesitan número de línea – basta la dirección. Opcionalmente añada una categoría (C, MD, R) o una designación (p. ej. C1). Si un tren sale de otra parada (p. ej. la estación), marque <em>Sale de otra parada</em> – la tarjeta la mostrará como sección separada con sus propios colores de salidas.",
    help_3: "<strong>Los festivos</strong> se detectan automáticamente según el país configurado en Home Assistant. No necesita introducirlos. Configure simplemente la pestaña <em>Festivo</em> en el editor.",
    help_4: "<strong>Los periodos de vacaciones</strong> se definen manualmente en la pestaña <em>Vacaciones</em>. Introduzca un nombre (p. ej. Vacaciones de verano), fechas de inicio y fin y, opcionalmente, una repetición anual de las mismas fechas.",
    help_5: "<strong>Los grupos de horarios</strong> comparten un horario entre varios periodos. Si p. ej. verano y Navidad circulan igual, cree un grupo <em>Servicio de vacaciones</em> y asigne ambos periodos.",
    help_6: "<strong>Prioridad</strong> al elegir el horario: Festivo → periodo de vacaciones actual → Sábado/Domingo → Día laborable. Si deja un periodo vacío, se usa el horario laborable.",
    help_7: "<strong>Guardar</strong> — tras todos los cambios haga clic en <em>Guardar cambios</em> abajo. El sensor se actualiza inmediatamente.",
    help_card_title: "Añadir la tarjeta al panel",
    help_card_auto: "La tarjeta está lista automáticamente – en su panel elija <em>Editar → Añadir tarjeta</em> y busque <strong>Horarios</strong>. El sensor de la parada se rellena solo. Esta es la forma recomendada.",
    help_card_hint: "También puede añadir la tarjeta manualmente (Añadir tarjeta → Manual):",
    copy: "Copiar", copied: "Copiado ✓", copy_failed: "Error al copiar",
  },
};

class MHDTimetablePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._entries = [];
    this._selectedId = null;
    this._data = null;
    this._loading = true;
    this._saving = false;
    this._editorLine = null;
    this._newLineNum = "";
    this._editorTab = "workday";
    this._expandedHours = {};
    this._editingChipNote = null;
    this._vacationView = false;
    this._notificationView = false;
    this._editingVacIdx = null;
    this._editingGroupIdx = null;
    this._editingNotificationIdx = null;
    this._helpVisible = false;
    // Snapshot of the last successfully loaded/saved data, used to detect
    // unsaved edits (see _hasUnsavedChanges) and warn before they're lost.
    this._savedSnapshot = null;
    this._onBeforeUnload = e => {
      if (this._hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
  }

  connectedCallback() {
    window.addEventListener("beforeunload", this._onBeforeUnload);
    if (this._hass) this._init();
  }

  disconnectedCallback() {
    window.removeEventListener("beforeunload", this._onBeforeUnload);
  }

  _hasUnsavedChanges() {
    if (!this._data || this._savedSnapshot === null) return false;
    try {
      return JSON.stringify(this._data) !== this._savedSnapshot;
    } catch (_e) {
      return false;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this.isConnected && this._loading) this._init();
  }

  async _init() {
    try {
      this._entries = await this._hass.callWS({ type: "ha_timetable/list_entries" });
      if (this._entries.length > 0) {
        this._selectedId = this._entries[0].entry_id;
        await this._loadData();
      }
    } catch (e) {
      console.error("Timetable panel init error:", e);
    }
    this._loading = false;
    this._render();
  }

  async _loadData() {
    if (!this._selectedId) return;
    try {
      this._data = await this._hass.callWS({
        type: "ha_timetable/get_data",
        entry_id: this._selectedId,
      });
      this._ensureIds();
      this._savedSnapshot = JSON.stringify(this._data);
    } catch (e) {
      this._data = null;
      this._savedSnapshot = null;
    }
  }

  _ensureIds() {
    if (!this._data) return;
    if (!this._data.vacation_groups) this._data.vacation_groups = [];
    if (!this._data.vacation_periods) this._data.vacation_periods = [];
    if (!this._data.notifications) this._data.notifications = [];
    this._data.vacation_periods.forEach(p => {
      if (!p.id) p.id = this._genId();
      if (p.repeat && !REPEAT_TYPES.includes(p.repeat)) delete p.repeat;
    });
    this._data.vacation_groups.forEach(g => {
      if (!g.id) g.id = this._genId();
    });
    this._data.notifications.forEach(n => {
      if (!n.id) n.id = this._genId();
      if (!Array.isArray(n.days) || n.days.length === 0) n.days = [0, 1, 2, 3, 4];
      if (n.enabled === undefined) n.enabled = true;
      if (!n.minutes_before) n.minutes_before = 10;
      if (!n.start_time) n.start_time = "06:00";
      if (!n.end_time) n.end_time = "08:00";
    });
  }

  _genId() {
    return "vp_" + Math.random().toString(36).slice(2, 7);
  }

  _lang() {
    const l = ((this._hass && (this._hass.language || (this._hass.locale || {}).language)) || "en")
      .toLowerCase().split("-")[0];
    return I18N[l] ? l : "en";
  }

  _t(key) {
    const lang = this._lang();
    let s = (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
    for (let i = 1; i < arguments.length; i++) s = s.replace("{" + (i - 1) + "}", arguments[i]);
    return s;
  }

  _schedLabel(t) { return this._t("sched_" + t); }
  _ttLabel(k)    { return this._t("tt_" + k); }
  _trainCats()   { return TRAIN_CATEGORIES[this._lang()] || []; }

  _selectedEntry() {
    return this._entries.find(e => e.entry_id === this._selectedId) || null;
  }

  _cardEntityId() {
    const selected = this._selectedEntry();
    if (selected?.entity_id) return selected.entity_id;

    if (this._hass?.states && this._selectedId) {
      const found = Object.keys(this._hass.states).find(id => {
        const attr = this._hass.states[id]?.attributes || {};
        return attr.entry_id === this._selectedId && (
          attr.timetable_domain === "mhd_timetable" ||
          Array.isArray(attr.next_departures) ||
          Array.isArray(attr.routes)
        );
      });
      if (found) return found;
    }

    return null;
  }

  // A minute entry is either a plain number (normal departure) or
  // { m, direction, skip_dates } for a departure that ends/continues
  // somewhere other than the line's usual direction (a short-turn trip)
  // and/or does not run on specific calendar dates every year (e.g. a
  // paper timetable's "nejede 1.1." footnote).
  _minuteNum(entry) {
    return typeof entry === "object" && entry !== null ? entry.m : entry;
  }
  _minuteNote(entry) {
    return typeof entry === "object" && entry !== null ? (entry.direction || "") : "";
  }
  _minuteSkipDates(entry) {
    return typeof entry === "object" && entry !== null && Array.isArray(entry.skip_dates)
      ? entry.skip_dates : [];
  }

  _currentChipEntry() {
    const ec = this._editingChipNote;
    if (!ec) return null;
    const ld = this._getLineData();
    const arr = (ld[ec.type] && ld[ec.type][String(ec.hour)]) || [];
    return arr.find(e => this._minuteNum(e) === ec.minute) || null;
  }
  _currentChipNoteText() {
    return this._minuteNote(this._currentChipEntry());
  }
  _currentChipSkipDatesText() {
    return this._minuteSkipDates(this._currentChipEntry()).join(", ");
  }

  _schedColor(key) {
    if (key === "workday") return "blue";
    if (key === "saturday" || key === "sunday") return "yellow";
    if (key === "holiday") return "green";
    return "purple";
  }

  _cardYaml() {
    const entityId = this._cardEntityId();
    if (!entityId) return null;
    return `type: custom:ha-timetable-card\nentity: ${entityId}`;
  }

  _vacationPeriods() { return this._data?.vacation_periods || []; }
  _vacationGroups()  { return this._data?.vacation_groups  || []; }
  _notifications()   { return this._data?.notifications || []; }

  _repeatValue(period) {
    return REPEAT_TYPES.includes(period?.repeat) ? period.repeat : "";
  }

  _repeatLabel(period) {
    const repeat = this._repeatValue(period);
    return repeat ? this._t("repeat_" + repeat) : "";
  }

  _notifyServices() {
    const notify = this._hass?.services?.notify || {};
    return Object.keys(notify).sort().map(service => `notify.${service}`);
  }

  _lineLabel(key, lineData) {
    const tt = lineData?.transport_type || "bus";
    const direction = lineData?.direction ? ` → ${lineData.direction}` : "";
    if (tt === "train") {
      if (this._isAutoTrainKey(key)) {
        const category = lineData?.train_category ? ` ${lineData.train_category}` : "";
        return `${this._t("train_word")}${category}${direction}`;
      }
      return `${key}${direction}`;
    }
    return `${this._t("line_word")} ${key}${direction}`;
  }

  _lineOptions(selected = "") {
    const lines = this._data?.lines || {};
    return [
      `<option value="" ${!selected ? "selected" : ""}>${this._t("notify_all_lines")}</option>`,
      ...Object.keys(lines).map(key => `
        <option value="${key}" ${selected === key ? "selected" : ""}>${this._lineLabel(key, lines[key])}</option>
      `),
    ].join("");
  }

  _dayChecks(days = [0, 1, 2, 3, 4]) {
    const selected = new Set((Array.isArray(days) ? days : [0, 1, 2, 3, 4]).map(Number));
    return [0, 1, 2, 3, 4, 5, 6].map(day => `
      <label class="day-chip ${selected.has(day) ? "on" : ""}">
        <input class="notif-day" type="checkbox" value="${day}" ${selected.has(day) ? "checked" : ""}>
        ${this._t("day_" + day)}
      </label>
    `).join("");
  }

  _notificationForm(rule = {}, editIdx = "") {
    const services = this._notifyServices();
    const days = Array.isArray(rule.days) ? rule.days : [0, 1, 2, 3, 4];
    return `
      <div class="notif-form" data-idx="${editIdx}">
        <datalist id="notify-services">
          ${services.map(service => `<option value="${service}"></option>`).join("")}
        </datalist>
        <label class="notif-enabled">
          <input class="notif-enabled-cb" type="checkbox" ${rule.enabled === false ? "" : "checked"}>
          ${this._t("notify_enabled")}
        </label>
        <input class="notif-label" value="${rule.label || ""}" placeholder="${this._t("notification_name_ph")}">
        <div class="notif-grid">
          <label>
            <span>${this._t("notify_service")}</span>
            <input class="notif-service" list="notify-services" value="${rule.notify_service || ""}" placeholder="${this._t("notify_service_ph")}">
          </label>
          <label>
            <span>${this._t("notify_minutes")}</span>
            <input class="notif-minutes" type="number" min="1" max="240" value="${rule.minutes_before || 10}">
          </label>
          <label>
            <span>${this._t("notify_line")}</span>
            <select class="notif-line">${this._lineOptions(rule.line_id || "")}</select>
          </label>
          <label>
            <span>${this._t("notify_window")}</span>
            <div class="time-range">
              <input class="notif-start" type="time" value="${rule.start_time || "06:00"}">
              <span>–</span>
              <input class="notif-end" type="time" value="${rule.end_time || "08:00"}">
            </div>
          </label>
        </div>
        <div class="day-row">${this._dayChecks(days)}</div>
        <div class="notif-actions">
          <button class="${editIdx === "" ? "notif-add" : "notif-edit-save"}">${editIdx === "" ? this._t("add_notification") : this._t("save")}</button>
          ${editIdx === "" ? "" : `<button class="notif-edit-cancel">✕</button>`}
        </div>
      </div>`;
  }

  _readNotificationForm(form, existing = {}) {
    const service = form.querySelector(".notif-service")?.value.trim() || "";
    if (!service) {
      alert(this._t("enter_notify_service"));
      return null;
    }
    const days = [...form.querySelectorAll(".notif-day:checked")].map(cb => parseInt(cb.value, 10));
    const minutes = parseInt(form.querySelector(".notif-minutes")?.value || "10", 10);
    return {
      id: existing.id || this._genId(),
      enabled: form.querySelector(".notif-enabled-cb")?.checked !== false,
      label: form.querySelector(".notif-label")?.value.trim() || this._t("notification_default"),
      notify_service: service,
      minutes_before: isNaN(minutes) ? 10 : Math.max(1, Math.min(240, minutes)),
      start_time: form.querySelector(".notif-start")?.value || "06:00",
      end_time: form.querySelector(".notif-end")?.value || "08:00",
      days: days.length ? days : [0, 1, 2, 3, 4],
      line_id: form.querySelector(".notif-line")?.value || "",
    };
  }

  // Returns the list of unique schedule tabs for the line editor vacation section.
  // Each entry: { key: "vacation_<id>", label: "..." }
  _vacationTabs() {
    const groups  = this._vacationGroups();
    const periods = this._vacationPeriods();
    const seen = new Set();
    const tabs = [];
    // Groups first
    groups.forEach(g => {
      seen.add(g.id);
      tabs.push({ key: `vacation_${g.id}`, label: g.label || this._t("group_default") });
    });
    // Ungrouped periods
    periods.forEach(p => {
      if (!p.group_id && !seen.has(p.id)) {
        seen.add(p.id);
        tabs.push({ key: `vacation_${p.id}`, label: p.label || this._t("period_default") });
      }
    });
    return tabs;
  }

  // Builds the schedule tab groups for a line. Active base day types are merged
  // according to ld.combine; each group shares one timetable. Vacation tabs are
  // appended individually (never combined). Returns [{ key, members, label, vacation }].
  _scheduleGroups(ld) {
    const active = BASE_TYPES.filter(t => (ld.schedule_types || []).includes(t));
    const linkSets = COMBINE_PRESETS[ld.combine || "none"] || [];
    const assigned = new Set();
    const groups = [];
    active.forEach(t => {
      if (assigned.has(t)) return;
      let members = [t];
      for (const set of linkSets) {
        if (set.includes(t)) {
          const inter = active.filter(x => set.includes(x));
          if (inter.length >= 2) { members = inter; break; }
        }
      }
      members.forEach(m => assigned.add(m));
      groups.push({
        key: members[0],
        members,
        vacation: false,
        label: members.length > 1
          ? members.map(m => this._t("sched_abbr_" + m)).join(" + ")
          : this._schedLabel(members[0]),
      });
    });
    this._vacationTabs().forEach(vt => {
      groups.push({ key: vt.key, members: [vt.key], vacation: true, label: vt.label });
    });
    return groups;
  }

  // Resolves which underlying day types a tab key writes to (combined group or self).
  _membersForKey(ld, key) {
    const g = this._scheduleGroups(ld).find(grp => grp.key === key);
    return g ? g.members : [key];
  }

  // Mirrors each combined group's primary schedule onto its other members, so the
  // sensor (which reads each day type independently) sees identical times.
  _syncCombinedSchedules(ld) {
    this._scheduleGroups(ld).forEach(g => {
      if (g.members.length > 1) {
        const src = ld[g.key] || {};
        g.members.forEach(m => {
          if (m !== g.key) ld[m] = JSON.parse(JSON.stringify(src));
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  _render() {
    this.shadowRoot.innerHTML = `<style>${this._styles()}</style>${this._html()}`;
    this._bind();
  }

  _html() {
    if (this._loading) return `<div class="page"><div class="loading">${this._t("loading")}</div></div>`;
    if (this._entries.length === 0) return `
      <div class="page">
        <div class="toolbar"><h1>${this._t("title")}</h1></div>
        <div class="empty">
          <p>${this._t("no_stops")}</p>
          <p>${this._t("no_stops_hint")}</p>
        </div>
      </div>`;

    return `
      <div class="page">
        <div class="toolbar">
          <h1>${this._t("title")}</h1>
          ${this._entries.length > 1 ? `
            <select class="stop-select">
              ${this._entries.map(e => `
                <option value="${e.entry_id}" ${e.entry_id === this._selectedId ? "selected" : ""}>
                  ${e.stop}
                </option>`).join("")}
            </select>` : `<span class="stop-title">${this._data?.stop || ""}</span>`}
          <button class="help-btn" title="${this._t("help_tooltip")}">?</button>
        </div>
        ${this._helpVisible ? this._helpHTML() : ""}
        ${this._editorLine !== null ? this._lineEditorHTML() : this._mainEditorHTML()}
      </div>`;
  }

  _helpHTML() {
    const steps = [1, 2, 3, 4, 5, 6, 7].map(n => `
        <div class="help-section">
          <div class="help-step">${n}</div>
          <div>${this._t("help_" + n)}</div>
        </div>`).join("");
    const cardYaml = this._cardYaml();
    return `
      <div class="help-box">
        <div class="help-title">${this._t("help_title")}</div>
        ${steps}
        <div class="help-divider"></div>
        <div class="help-card-title">${this._t("help_card_title")}</div>
        <p style="font-size:0.9em;color:var(--primary-text-color);margin:0 0 10px;line-height:1.5">
          ${this._t("help_card_auto")}
        </p>
        ${cardYaml ? `<p style="font-size:0.88em;color:var(--secondary-text-color);margin:0 0 8px">
          ${this._t("help_card_hint")}
        </p>
        <div class="help-code" id="help-card-yaml">${cardYaml}</div>
        <button class="help-copy-btn">${this._t("copy")}</button>` : ""}
      </div>`;
  }

  _mainEditorHTML() {
    if (!this._data) return `<div class="empty">${this._t("load_failed")}</div>`;
    const lines = this._data.lines || {};
    const keys = Object.keys(lines);
    return `
      <div class="tabs">
        <button class="tab ${!this._vacationView && !this._notificationView ? "active" : ""}" data-view="lines">${this._t("tab_lines")}</button>
        <button class="tab ${this._vacationView ? "active" : ""}" data-view="vacation">${this._t("tab_vacation")}</button>
        <button class="tab ${this._notificationView ? "active" : ""}" data-view="notifications">${this._t("tab_notifications")}</button>
      </div>
      <div class="content">
        ${this._notificationView ? this._notificationsHTML() : this._vacationView ? this._vacationHTML() : `
          ${keys.length === 0
            ? `<p class="hint">${this._t("no_lines")}</p>`
            : keys.map(k => this._lineRowHTML(k, lines[k])).join("")}
          <button class="add-btn">${this._t("add_line")}</button>
        `}
      </div>
      ${this._hasUnsavedChanges() ? `<p class="unsaved-hint">${this._t("unsaved_changes")}</p>` : ""}
      <div class="footer">
        <button class="save-btn ${this._saving ? "saving" : ""}">
          ${this._saving ? this._t("saving") : this._t("save_changes")}
        </button>
      </div>`;
  }

  // A train line key is auto-generated unless the user typed a designation (S3, RE5…)
  _isAutoTrainKey(num) {
    return num === "train" || String(num).startsWith("train_") || String(num).startsWith("vlak_");
  }

  _lineRowHTML(num, data) {
    const types = (data.schedule_types || [])
      .filter(t => BASE_TYPES.includes(t))
      .map(t => this._schedLabel(t)).join(", ");
    const vtabs = this._vacationTabs();
    const vacCount = vtabs.filter(vt => data[vt.key] && Object.keys(data[vt.key]).length > 0).length;
    const vacLabel = vacCount > 0 ? ` ${this._t("vac_count", vacCount)}` : "";
    const tt = data.transport_type || "bus";
    const isTrain = tt === "train";
    const ttMeta = TRANSPORT_META.find(m => m.key === tt) || TRANSPORT_META[0];
    const label = isTrain ? (this._isAutoTrainKey(num) ? "" : num) : num;
    const badge = `${ttMeta.icon}${label ? " " + label : ""}`;
    const tcat = isTrain && data.train_category ? `${data.train_category} ` : "";
    return `
      <div class="line-row">
        <div class="lr-left">
          <span class="lr-num">${badge}</span>
          <div class="lr-meta">
            <span class="lr-dir">${tcat}${data.direction || ""}</span>
            <span class="lr-types">${types}${vacLabel}</span>
          </div>
        </div>
        <div class="lr-actions">
          <button class="btn-edit" data-line="${num}">${this._t("edit")}</button>
          <button class="btn-del" data-line="${num}">✕</button>
        </div>
      </div>`;
  }

  // -------------------------------------------------------------------------
  // Vacation HTML
  // -------------------------------------------------------------------------
  _vacationHTML() {
    return `
      <p class="hint">${this._t("vac_intro")}</p>
      ${this._groupsSectionHTML()}
      <div class="vac-divider"></div>
      ${this._periodsSectionHTML()}`;
  }

  _notificationsHTML() {
    const notifications = this._notifications();
    const lines = this._data?.lines || {};
    return `
      <p class="hint">${this._t("notifications_intro")}</p>
      ${notifications.length === 0
        ? `<p class="hint" style="font-style:italic">${this._t("notifications_empty")}</p>`
        : notifications.map((rule, i) => {
            if (this._editingNotificationIdx === i) return this._notificationForm(rule, String(i));
            const dayLabel = (rule.days || []).map(day => this._t("day_" + day)).join(", ");
            const lineLabel = rule.line_id ? this._lineLabel(rule.line_id, lines[rule.line_id] || {}) : this._t("notify_all_lines");
            return `
              <div class="notif-row ${rule.enabled === false ? "off" : ""}">
                <div class="notif-main">
                  <span class="notif-name">${rule.label || this._t("notification_default")}</span>
                  <span class="notif-meta">${rule.notify_service || ""} · ${rule.minutes_before || 10} min · ${rule.start_time || "06:00"}–${rule.end_time || "08:00"}</span>
                  <span class="notif-meta">${dayLabel || this._t("notify_all_lines")} · ${lineLabel}</span>
                </div>
                <button class="notif-edit-btn" data-idx="${i}">${this._t("edit")}</button>
                <button class="notif-del" data-idx="${i}">✕</button>
              </div>`;
          }).join("")}
      ${this._notificationForm()}`;
  }

  _groupsSectionHTML() {
    const groups = this._vacationGroups();
    const editIdx = this._editingGroupIdx;
    return `
      <div class="vac-section-title">${this._t("groups_title")}</div>
      <p class="hint">${this._t("groups_hint")}</p>
      ${groups.length === 0
        ? `<p class="hint" style="font-style:italic">${this._t("groups_empty")}</p>`
        : groups.map((g, i) => editIdx === i ? `
          <div class="vac-edit-row">
            <input class="grp-edit-label" value="${g.label || ""}">
            <button class="grp-edit-save" data-idx="${i}">${this._t("save")}</button>
            <button class="grp-edit-cancel">✕</button>
          </div>` : `
          <div class="vac-row">
            <span class="grp-icon">🗂</span>
            <span class="vac-name">${g.label || this._t("group_default")}</span>
            <span class="vac-dates">${this._periodsInGroup(g.id).join(", ") || "—"}</span>
            <button class="grp-edit-btn" data-idx="${i}">${this._t("edit")}</button>
            <button class="grp-del" data-idx="${i}">✕</button>
          </div>`).join("")}
      <div class="vac-form">
        <input class="grp-label" placeholder="${this._t("group_name_ph")}">
        <button class="grp-add">${this._t("add_group")}</button>
      </div>`;
  }

  _periodsInGroup(groupId) {
    return this._vacationPeriods()
      .filter(p => p.group_id === groupId)
      .map(p => p.label || this._t("period_default"));
  }

  _periodsSectionHTML() {
    const periods = this._vacationPeriods();
    const groups  = this._vacationGroups();
    const editIdx = this._editingVacIdx;

    const groupOptions = (selected) => [
      `<option value="" ${!selected ? "selected" : ""}>${this._t("no_group_opt")}</option>`,
      ...groups.map(g => `<option value="${g.id}" ${selected === g.id ? "selected" : ""}>${g.label || this._t("group_default")}</option>`),
    ].join("");

    return `
      <div class="vac-section-title">${this._t("periods_title")}</div>
      ${periods.length === 0
        ? `<p class="hint" style="font-style:italic">${this._t("periods_empty")}</p>`
        : periods.map((p, i) => {
            const groupLabel = groups.find(g => g.id === p.group_id)?.label || "";
            const repeat = this._repeatValue(p);
            const repeatLabel = this._repeatLabel(p);
            return editIdx === i ? `
              <div class="vac-edit-row">
                <input class="vac-edit-label" value="${p.label || ""}">
                <input class="vac-edit-start" type="date" value="${p.start}">
                <span>–</span>
                <input class="vac-edit-end" type="date" value="${p.end}">
                <select class="vac-edit-group">${groupOptions(p.group_id)}</select>
                <label class="vac-repeat-toggle">
                  <input class="vac-edit-repeat-cb" type="checkbox" ${repeat ? "checked" : ""}>
                  ${this._t("repeat_label")}
                </label>
                <button class="vac-edit-save" data-idx="${i}">${this._t("save")}</button>
                <button class="vac-edit-cancel">✕</button>
              </div>` : `
              <div class="vac-row">
                <span class="vac-name">${p.label || this._t("period_default")}</span>
                <span class="vac-dates">${p.start} – ${p.end}</span>
                ${groupLabel ? `<span class="vac-group-badge">${groupLabel}</span>` : ""}
                ${repeatLabel ? `<span class="vac-repeat-badge">${repeatLabel}</span>` : ""}
                <button class="vac-edit-btn" data-idx="${i}">${this._t("edit")}</button>
                <button class="vac-del" data-idx="${i}">✕</button>
              </div>`;
          }).join("")}
      <div class="vac-form">
        <input class="vac-label" placeholder="${this._t("period_name_ph")}">
        <input class="vac-start" type="date">
        <span>–</span>
        <input class="vac-end" type="date">
        ${groups.length > 0 ? `<select class="vac-new-group">${groupOptions("")}</select>` : ""}
        <label class="vac-repeat-toggle">
          <input class="vac-repeat-cb" type="checkbox">
          ${this._t("repeat_label")}
        </label>
        <button class="vac-add">${this._t("add")}</button>
      </div>`;
  }

  // -------------------------------------------------------------------------
  // Line editor
  // -------------------------------------------------------------------------
  _lineEditorHTML() {
    const isNew = this._editorLine === "__new__";
    const ld = this._getLineData();
    const types = (ld.schedule_types || ["workday", "saturday", "sunday"]).filter(t => BASE_TYPES.includes(t));
    const vacTabs = this._vacationTabs();
    const combine = ld.combine || "none";

    const groups = this._scheduleGroups(ld);
    // Keep the active tab pointing at a real group (combine/active changes can drop it)
    let tab = this._editorTab;
    if (!groups.some(g => g.key === tab)) {
      tab = groups[0]?.key || "workday";
      this._editorTab = tab;
    }
    const currentTabLabel = groups.find(g => g.key === tab)?.label || tab;

    const ttype = ld.transport_type || "bus";
    const customStop = ld.custom_stop || "";
    const isTrain = ttype === "train";
    const tcat = ld.train_category || "";
    const cats = this._trainCats();
    const isAuto = isNew || this._isAutoTrainKey(this._editorLine);

    const header = isNew
      ? this._t("new_line")
      : isTrain
        ? (isAuto
            ? `${this._t("train_word")}${tcat ? " " + tcat : ""}${ld.direction ? " → " + ld.direction : ""}`
            : `${this._editorLine}${ld.direction ? " → " + ld.direction : ""}`)
        : `${this._t("line_word")} ${this._editorLine}`;

    return `
      <div class="le-header">
        <button class="back-btn">${this._t("back")}</button>
        <h2>${header}</h2>
      </div>
      <div class="le-fields">
        <div class="field">
          <label>${this._t("transport_type")}</label>
          <div class="ttype-chips">
            ${TRANSPORT_META.map(t => `
              <button class="ttype-chip ${t.key === ttype ? "active" : ""}" data-type="${t.key}"
                      style="--tc:${t.color}">
                ${t.icon} ${this._ttLabel(t.key)}
              </button>`).join("")}
          </div>
        </div>
        ${isTrain ? `
        ${cats.length > 0 ? `
        <div class="field">
          <label>${this._t("train_category")}</label>
          <div class="ttype-chips">
            ${cats.map((c, i) => `
              <button class="tcat-chip ${tcat === c.v ? "active" : ""}" data-cat="${c.v}"
                      style="--tc:${TCAT_COLORS[i % TCAT_COLORS.length]}">${c.l}</button>`).join("")}
          </div>
          <p class="hint" style="margin-top:6px">${this._t("train_cat_hint")}</p>
        </div>` : ""}
        <div class="field">
          <label>${this._t("train_designation")}</label>
          <input id="le-num" value="${isNew ? this._newLineNum : (isAuto ? "" : this._editorLine)}"
                 placeholder="${this._t("train_designation_ph")}" ${isNew ? "" : "readonly"}>
        </div>` : `
        <div class="field">
          <label>${this._t("line_number")}</label>
          <input id="le-num" value="${isNew ? this._newLineNum : this._editorLine}" ${isNew ? "" : "readonly"}>
        </div>`}
        <div class="field">
          <label>${this._t("direction")}</label>
          <input id="le-dir" value="${ld.direction || ""}">
        </div>
        <div class="field">
          <label>${this._t("route")}</label>
          <textarea id="le-route" rows="2">${ld.route || ""}</textarea>
        </div>
        <div class="field">
          <label class="type-chip ${customStop ? "on" : ""}" id="le-cs-label">
            <input type="checkbox" id="le-cs-cb" ${customStop ? "checked" : ""}>
            ${this._t("custom_stop")}
          </label>
          <input id="le-cs-inp" type="text" value="${customStop}"
                 placeholder="${this._t("custom_stop_ph")}"
                 style="${customStop ? "" : "display:none"}; margin-top:6px">
        </div>
        <div class="field">
          <label>${this._t("active_schedules")}</label>
          <div class="type-checks">
            ${BASE_TYPES.map(t => `
              <label class="type-chip ${types.includes(t) ? "on" : ""}">
                <input type="checkbox" class="type-cb" value="${t}" ${types.includes(t) ? "checked" : ""}>
                ${this._schedLabel(t)}
              </label>`).join("")}
          </div>
          ${vacTabs.length > 0
            ? `<p class="hint" style="margin-top:8px">${this._t("vac_tabs_list")} <strong>${vacTabs.map(t => t.label).join(", ")}</strong></p>`
            : `<p class="hint" style="margin-top:8px">${this._t("vac_tabs_empty")}</p>`}
        </div>
        <div class="field">
          <label>${this._t("combine_label")}</label>
          <div class="ttype-chips">
            ${COMBINE_ORDER.map(c => `
              <button class="combine-chip ${combine === c ? "active" : ""}" data-combine="${c}" style="--tc:#5e35b1">
                ${this._t("combine_" + c)}
              </button>`).join("")}
          </div>
          <p class="hint" style="margin-top:6px">${this._t("combine_hint")}</p>
        </div>
      </div>
      <div class="sched-tabs">
        ${groups.map(g => `
          <button class="stab stab-${this._schedColor(g.key)} ${g.vacation ? "vac-stab" : ""} ${g.key === tab ? "active" : ""}" data-type="${g.key}">
            ${g.label}
          </button>`).join("")}
      </div>
      <div class="time-grid-wrap">
        <p class="hint">
          ${tab.startsWith("vacation_")
            ? this._t("vac_grid_hint", currentTabLabel)
            : this._t("grid_hint")}
        </p>
        <div class="time-grid">${this._timeGridHTML(ld, tab, groups.map(g => g.key))}</div>
      </div>
      <div class="footer">
        <button class="line-save-btn">${isNew ? this._t("add_line_btn") : this._t("save_line")}</button>
      </div>`;
  }

  _timeGridHTML(lineData, activeType, allTypes) {
    const types = allTypes || [activeType];
    let html = "";
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, "0");

      // Collect chips from ALL schedule types for this hour
      const allChips = [];
      types.forEach(type => {
        const sched = lineData[type] || {};
        const mins = (sched[String(h)] || sched[hStr] || []).slice();
        mins.sort((a, b) => this._minuteNum(a) - this._minuteNum(b))
          .forEach(entry => allChips.push({
            m: this._minuteNum(entry),
            note: this._minuteNote(entry),
            skipDates: this._minuteSkipDates(entry),
            type,
          }));
      });
      allChips.sort((a, b) => a.m - b.m);

      // Active type mins for the editable minute grid
      const activeSched = lineData[activeType] || {};
      const activeMins = (activeSched[String(h)] || activeSched[hStr] || []).slice().map(e => this._minuteNum(e));

      const expanded = this._expandedHours[`${activeType}_${h}`];
      const noteEdit = this._editingChipNote;
      const editingHere = noteEdit && noteEdit.hour === h;
      html += `
        <div class="hour-row">
          <div class="hour-hdr ${expanded ? "open" : ""}" data-hour="${h}" data-type="${activeType}">
            <span class="hour-lbl">${hStr}</span>
            <div class="chips">
              ${allChips.map(({m, note, skipDates, type}) => {
                const hasException = !!note || skipDates.length > 0;
                const titleParts = [];
                if (note) titleParts.push(note);
                if (skipDates.length) titleParts.push(this._t("chip_skip_title", this._formatSkipDatesForDisplay(skipDates)));
                return `
                <span class="chip chip-${this._schedColor(type)} ${hasException ? "has-note" : ""}" data-h="${h}" data-m="${m}" data-type="${type}" title="${titleParts.join(" · ")}">
                  ${String(m).padStart(2,"0")}
                  <button class="chip-note-btn" data-h="${h}" data-m="${m}" data-type="${type}" title="${this._t("chip_note_btn_title")}">✎</button>
                </span>`;
              }).join("")}
            </div>
            <span class="toggle">${expanded ? "▲" : "▼"}</span>
          </div>
          ${editingHere ? `
            <div class="chip-note-form" data-h="${h}">
              <span class="chip-note-form-lbl">${this._t("chip_note_label", `${String(noteEdit.hour).padStart(2,"0")}:${String(noteEdit.minute).padStart(2,"0")}`)}</span>
              <input class="chip-note-input" placeholder="${this._t("chip_note_ph")}" value="${this._currentChipNoteText()}">
              <input class="chip-skip-input" placeholder="${this._t("chip_skip_ph")}" value="${this._currentChipSkipDatesText()}">
              <button class="chip-note-save">${this._t("save")}</button>
              <button class="chip-note-clear">${this._t("chip_note_clear")}</button>
              <button class="chip-note-cancel">✕</button>
            </div>` : ""}
          ${expanded ? `
            <div class="min-grid">
              ${Array.from({length:60}, (_, m) => `
                <button class="mcell mcell-${this._schedColor(activeType)} ${activeMins.includes(m) ? "on" : ""}" data-h="${h}" data-m="${m}" data-type="${activeType}">
                  ${String(m).padStart(2,"0")}
                </button>`).join("")}
            </div>` : ""}
        </div>`;
    }
    return html;
  }

  // -------------------------------------------------------------------------
  // Event binding
  // -------------------------------------------------------------------------
  _bind() {
    const root = this.shadowRoot;

    root.querySelector(".help-btn")?.addEventListener("click", () => {
      this._helpVisible = !this._helpVisible;
      this._render();
    });

    root.querySelector(".help-copy-btn")?.addEventListener("click", e => {
      const text = root.querySelector("#help-card-yaml")?.textContent?.trim();
      if (!text) return;
      const btn = e.currentTarget;
      const _done = ok => {
        btn.textContent = ok ? this._t("copied") : this._t("copy_failed");
        setTimeout(() => { btn.textContent = this._t("copy"); }, 2000);
      };
      const _fallback = () => {
        const ta = document.createElement("textarea");
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
        ta.value = text;
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
          document.execCommand("copy");
          _done(true);
        } catch (_) {
          _done(false);
        }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => _done(true)).catch(_fallback);
      } else {
        _fallback();
      }
    });

    root.querySelector(".stop-select")?.addEventListener("change", async e => {
      this._selectedId = e.target.value;
      this._editorLine = null;
      this._vacationView = false;
      this._notificationView = false;
      await this._loadData();
      this._render();
    });

    root.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._vacationView = btn.dataset.view === "vacation";
        this._notificationView = btn.dataset.view === "notifications";
        this._editingVacIdx = null;
        this._editingGroupIdx = null;
        this._editingNotificationIdx = null;
        this._render();
      });
    });

    root.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editorLine = btn.dataset.line;
        const ld = this._data.lines[btn.dataset.line];
        const types = (ld?.schedule_types || ["workday"]).filter(t => BASE_TYPES.includes(t));
        this._editorTab = types[0] || "workday";
        this._expandedHours = {};
        this._editingChipNote = null;
        this._render();
      });
    });
    root.querySelectorAll(".btn-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const ld = this._data.lines[btn.dataset.line] || {};
        const msg = ld.transport_type === "train"
          ? this._t("confirm_del_train", ld.train_category ? " " + ld.train_category : "", ld.direction || "?")
          : this._t("confirm_del_line", btn.dataset.line);
        if (!confirm(msg)) return;
        delete this._data.lines[btn.dataset.line];
        this._render();
      });
    });
    root.querySelector(".add-btn")?.addEventListener("click", () => {
      this._editorLine = "__new__";
      this._newLineNum = "";
      this._editorTab = "workday";
      this._expandedHours = {};
      this._editingChipNote = null;
      this._render();
    });

    root.querySelector(".save-btn")?.addEventListener("click", () => this._saveData());

    // ---- Notification handlers ----
    root.querySelectorAll(".notif-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editingNotificationIdx = parseInt(btn.dataset.idx);
        this._render();
      });
    });
    root.querySelector(".notif-edit-cancel")?.addEventListener("click", () => {
      this._editingNotificationIdx = null;
      this._render();
    });
    root.querySelector(".notif-edit-save")?.addEventListener("click", e => {
      const form = e.currentTarget.closest(".notif-form");
      const idx = this._editingNotificationIdx;
      if (!form || idx === null) return;
      const rule = this._readNotificationForm(form, this._data.notifications[idx] || {});
      if (!rule) return;
      this._data.notifications[idx] = rule;
      this._editingNotificationIdx = null;
      this._render();
    });
    root.querySelector(".notif-add")?.addEventListener("click", e => {
      const form = e.currentTarget.closest(".notif-form");
      if (!form) return;
      const rule = this._readNotificationForm(form);
      if (!rule) return;
      if (!this._data.notifications) this._data.notifications = [];
      this._data.notifications.push(rule);
      this._render();
    });
    root.querySelectorAll(".notif-del").forEach(btn => {
      btn.addEventListener("click", () => {
        this._data.notifications.splice(parseInt(btn.dataset.idx), 1);
        this._editingNotificationIdx = null;
        this._render();
      });
    });
    root.querySelectorAll(".notif-day").forEach(cb => {
      cb.addEventListener("change", () => {
        cb.closest(".day-chip")?.classList.toggle("on", cb.checked);
      });
    });

    // ---- Group handlers ----
    root.querySelectorAll(".grp-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editingGroupIdx = parseInt(btn.dataset.idx);
        this._render();
      });
    });
    root.querySelector(".grp-edit-cancel")?.addEventListener("click", () => {
      this._editingGroupIdx = null;
      this._render();
    });
    root.querySelector(".grp-edit-save")?.addEventListener("click", () => {
      const idx = this._editingGroupIdx;
      const label = root.querySelector(".grp-edit-label")?.value.trim();
      if (!label) { alert(this._t("enter_group_name")); return; }
      this._data.vacation_groups[idx].label = label;
      this._editingGroupIdx = null;
      this._render();
    });
    root.querySelectorAll(".grp-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const removed = this._data.vacation_groups[idx];
        if (!confirm(this._t("confirm_del_group", removed.label))) return;
        this._data.vacation_groups.splice(idx, 1);
        // Clear group assignment from periods
        this._data.vacation_periods.forEach(p => {
          if (p.group_id === removed.id) delete p.group_id;
        });
        // Remove schedule keys from lines
        const key = `vacation_${removed.id}`;
        Object.values(this._data.lines || {}).forEach(line => { delete line[key]; });
        this._render();
      });
    });
    root.querySelector(".grp-add")?.addEventListener("click", () => {
      const label = root.querySelector(".grp-label")?.value.trim();
      if (!label) { alert(this._t("enter_group_name")); return; }
      if (!this._data.vacation_groups) this._data.vacation_groups = [];
      this._data.vacation_groups.push({ id: this._genId(), label });
      root.querySelector(".grp-label").value = "";
      this._render();
    });

    // ---- Period handlers ----
    root.querySelectorAll(".vac-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._editingVacIdx = parseInt(btn.dataset.idx);
        this._render();
      });
    });
    root.querySelector(".vac-edit-cancel")?.addEventListener("click", () => {
      this._editingVacIdx = null;
      this._render();
    });
    root.querySelector(".vac-edit-save")?.addEventListener("click", () => {
      const idx = this._editingVacIdx;
      const label    = root.querySelector(".vac-edit-label")?.value.trim();
      const start    = root.querySelector(".vac-edit-start")?.value;
      const end      = root.querySelector(".vac-edit-end")?.value;
      const groupId  = root.querySelector(".vac-edit-group")?.value || "";
      const repeatCb = root.querySelector(".vac-edit-repeat-cb");
      if (!start || !end) { alert(this._t("enter_dates")); return; }
      const p = this._data.vacation_periods[idx];
      p.label = label || this._t("period_default");
      p.start = start;
      p.end   = end;
      if (groupId) p.group_id = groupId; else delete p.group_id;
      if (repeatCb?.checked) p.repeat = "yearly";
      else delete p.repeat;
      this._editingVacIdx = null;
      this._render();
    });
    root.querySelectorAll(".vac-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const removed = this._data.vacation_periods[idx];
        this._data.vacation_periods.splice(idx, 1);
        // Remove orphaned standalone schedule key (only if no group)
        if (removed?.id && !removed.group_id) {
          const key = `vacation_${removed.id}`;
          Object.values(this._data.lines || {}).forEach(line => { delete line[key]; });
        }
        this._render();
      });
    });
    root.querySelector(".vac-add")?.addEventListener("click", () => {
      const label   = root.querySelector(".vac-label")?.value.trim();
      const start   = root.querySelector(".vac-start")?.value;
      const end     = root.querySelector(".vac-end")?.value;
      const groupId = root.querySelector(".vac-new-group")?.value || "";
      const repeatCb = root.querySelector(".vac-repeat-cb");
      if (!start || !end) { alert(this._t("enter_dates")); return; }
      if (!this._data.vacation_periods) this._data.vacation_periods = [];
      const entry = { id: this._genId(), label: label || this._t("period_default"), start, end };
      if (groupId) entry.group_id = groupId;
      if (repeatCb?.checked) entry.repeat = "yearly";
      this._data.vacation_periods.push(entry);
      this._render();
    });

    if (this._editorLine !== null) this._bindLineEditor();
  }

  _bindLineEditor() {
    const root = this.shadowRoot;

    root.querySelector(".back-btn")?.addEventListener("click", () => {
      this._editorLine = null;
      this._render();
    });

    // Transport type chips
    root.querySelectorAll(".ttype-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        this._syncFields();
        this._getLineData().transport_type = chip.dataset.type;
        this._render();
      });
    });

    // Train category chips (toggle - click active one to deselect)
    root.querySelectorAll(".tcat-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        this._syncFields();
        const ld = this._getLineData();
        ld.train_category = ld.train_category === chip.dataset.cat ? "" : chip.dataset.cat;
        this._render();
      });
    });

    // Schedule combine presets
    root.querySelectorAll(".combine-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        this._syncFields();
        const ld = this._getLineData();
        ld.combine = chip.dataset.combine;
        this._syncCombinedSchedules(ld);
        this._expandedHours = {};
        this._editingChipNote = null;
        this._render();
      });
    });

    // Custom stop checkbox
    root.querySelector("#le-cs-cb")?.addEventListener("change", e => {
      const inp   = root.querySelector("#le-cs-inp");
      const label = root.querySelector("#le-cs-label");
      if (inp)   inp.style.display   = e.target.checked ? "" : "none";
      if (label) label.classList.toggle("on", e.target.checked);
      if (!e.target.checked) this._getLineData().custom_stop = "";
    });

    root.querySelectorAll(".stab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._syncFields();
        this._editorTab = btn.dataset.type;
        this._expandedHours = {};
        this._editingChipNote = null;
        this._render();
      });
    });

    root.querySelectorAll(".type-cb").forEach(cb => {
      cb.addEventListener("change", () => {
        this._syncFields();
        const checked = [...root.querySelectorAll(".type-cb:checked")].map(c => c.value);
        this._getLineData().schedule_types = checked;
        if (!checked.includes(this._editorTab) && !this._editorTab.startsWith("vacation_")) {
          const vtabs = this._vacationTabs();
          this._editorTab = checked[0] || (vtabs[0]?.key ?? "workday");
        }
        this._render();
      });
    });

    root.querySelectorAll(".hour-hdr").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.closest(".chip")) return;
        const key = `${el.dataset.type}_${el.dataset.hour}`;
        this._expandedHours[key] = !this._expandedHours[key];
        this._syncFields();
        this._render();
      });
    });

    root.querySelectorAll(".mcell").forEach(btn => {
      btn.addEventListener("click", () => {
        this._syncFields();
        this._toggleMinute(btn.dataset.type, parseInt(btn.dataset.h), parseInt(btn.dataset.m));
        this._render();
      });
    });

    root.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", e => {
        e.stopPropagation();
        this._syncFields();
        this._toggleMinute(chip.dataset.type, parseInt(chip.dataset.h), parseInt(chip.dataset.m));
        this._render();
      });
    });

    // ---- Per-departure "different terminus" note ----
    root.querySelectorAll(".chip-note-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        this._syncFields();
        this._editingChipNote = {
          type: btn.dataset.type,
          hour: parseInt(btn.dataset.h),
          minute: parseInt(btn.dataset.m),
        };
        this._render();
      });
    });
    root.querySelector(".chip-note-save")?.addEventListener("click", e => {
      e.stopPropagation();
      const ec = this._editingChipNote;
      const val = root.querySelector(".chip-note-input")?.value || "";
      const skipVal = root.querySelector(".chip-skip-input")?.value || "";
      if (ec) this._setMinuteException(ec.type, ec.hour, ec.minute, val, skipVal);
      this._editingChipNote = null;
      this._render();
    });
    root.querySelector(".chip-note-clear")?.addEventListener("click", e => {
      e.stopPropagation();
      const ec = this._editingChipNote;
      if (ec) this._setMinuteException(ec.type, ec.hour, ec.minute, "", "");
      this._editingChipNote = null;
      this._render();
    });
    root.querySelector(".chip-note-cancel")?.addEventListener("click", e => {
      e.stopPropagation();
      this._editingChipNote = null;
      this._render();
    });

    root.querySelector(".line-save-btn")?.addEventListener("click", () => {
      this._syncFields();
      const ld = this._getLineData();
      this._syncCombinedSchedules(ld);
      const isNew = this._editorLine === "__new__";
      if (!this._data.lines) this._data.lines = {};

      let num;
      if (!isNew) {
        num = this._editorLine;
      } else if ((ld.transport_type || "bus") === "train") {
        if (!(ld.direction || "").trim()) { alert(this._t("enter_direction")); return; }
        // Optional designation (S3, RE5…) becomes the key; otherwise direction-based key
        const designation = root.querySelector("#le-num")?.value?.trim();
        num = designation || this._trainKey(ld.direction, ld.train_category || "");
        if (this._data.lines[num]) {
          alert(this._t("train_exists"));
          return;
        }
      } else {
        num = root.querySelector("#le-num")?.value?.trim();
        if (!num) { alert(this._t("enter_line_number")); return; }
      }

      this._data.lines[num] = ld;
      if (isNew) delete this._data._newLine;
      this._editorLine = null;
      this._render();
    });
  }

  // Deterministic train line key: train_<direction-slug>[_<category>]
  // (must produce the same keys as _train_key in __init__.py)
  _trainKey(direction, category) {
    const slug = (direction || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
    let key = "train" + (slug ? "_" + slug : "");
    if (category) key += "_" + category.toLowerCase();
    return key;
  }

  _syncFields() {
    const root = this.shadowRoot;
    const ld = this._getLineData();
    const num   = root.querySelector("#le-num");
    const dir   = root.querySelector("#le-dir");
    const route = root.querySelector("#le-route");
    const csCb  = root.querySelector("#le-cs-cb");
    const csInp = root.querySelector("#le-cs-inp");
    if (num && this._editorLine === "__new__") this._newLineNum = num.value;
    if (dir)   ld.direction = dir.value;
    if (route) ld.route = route.value;
    if (csCb && csInp) ld.custom_stop = csCb.checked ? csInp.value.trim() : "";
  }

  _getLineData() {
    if (this._editorLine === "__new__") {
      if (!this._data._newLine) this._data._newLine = {
        transport_type: "bus", custom_stop: "", train_category: "", combine: "none",
        direction: "", route: "", valid_from: new Date().toISOString().slice(0, 10),
        schedule_types: ["workday", "saturday", "sunday"],
        workday: {}, saturday: {}, sunday: {}, holiday: {},
      };
      return this._data._newLine;
    }
    const ld = this._data.lines[this._editorLine];
    if (!ld) {
      this._data.lines[this._editorLine] = {
        transport_type: "bus", custom_stop: "",
        direction: "", route: "", schedule_types: ["workday"], workday: {},
      };
    } else {
      if (!ld.transport_type) ld.transport_type = "bus";
      if (ld.custom_stop === undefined) ld.custom_stop = "";
    }
    return this._data.lines[this._editorLine];
  }

  _toggleMinute(type, hour, minute) {
    const ld = this._getLineData();
    if (!ld[type]) ld[type] = {};
    const key = String(hour);
    if (!ld[type][key]) ld[type][key] = [];
    const arr = ld[type][key];
    const idx = arr.findIndex(e => this._minuteNum(e) === minute);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(minute);
    arr.sort((a, b) => this._minuteNum(a) - this._minuteNum(b));
    if (arr.length === 0) delete ld[type][key];
    // Mirror the edit into the other days of a combined group
    this._syncCombinedSchedules(ld);
  }

  // "1.1., 24.12." (as written on paper timetables) -> ["01-01", "12-24"].
  // Silently drops anything that doesn't parse as D.M. / DD.MM.
  _parseSkipDatesInput(str) {
    return (str || "")
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.?$/);
        if (!m) return null;
        const day = parseInt(m[1], 10), month = parseInt(m[2], 10);
        if (day < 1 || day > 31 || month < 1 || month > 12) return null;
        return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      })
      .filter(Boolean);
  }
  // ["01-01", "12-24"] -> "1.1., 24.12." for display in the edit field.
  _formatSkipDatesForDisplay(arr) {
    return (arr || [])
      .map(md => {
        const [month, day] = String(md).split("-");
        return month && day ? `${parseInt(day, 10)}.${parseInt(month, 10)}.` : null;
      })
      .filter(Boolean)
      .join(", ");
  }

  // Attach (or clear) a "different terminus" and/or "doesn't run on these
  // dates" exception on an already-placed departure. Stored as
  // {m, direction, skip_dates} instead of a plain number; collapses back
  // to a plain number when both are empty, so unused lines stay tiny.
  _setMinuteException(type, hour, minute, note, skipDatesInput) {
    const ld = this._getLineData();
    const arr = ld[type] && ld[type][String(hour)];
    if (!arr) return;
    const idx = arr.findIndex(e => this._minuteNum(e) === minute);
    if (idx < 0) return;
    const trimmed = (note || "").trim();
    const skipDates = this._parseSkipDatesInput(skipDatesInput);
    if (!trimmed && skipDates.length === 0) {
      arr[idx] = minute;
    } else {
      const entry = { m: minute };
      if (trimmed) entry.direction = trimmed;
      if (skipDates.length) entry.skip_dates = skipDates;
      arr[idx] = entry;
    }
    this._syncCombinedSchedules(ld);
  }

  async _saveData() {
    if (!this._selectedId || !this._data) return;
    if (this._data._newLine) delete this._data._newLine;
    this._saving = true;
    this._render();
    try {
      await this._hass.callWS({
        type: "ha_timetable/save_data",
        entry_id: this._selectedId,
        data: this._data,
      });
      this._savedSnapshot = JSON.stringify(this._data);
    } catch (e) {
      alert(this._t("save_error") + (e.message || e));
    }
    this._saving = false;
    this._render();
  }

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------
  _styles() {
    return `
      :host { display: block; background: var(--primary-background-color); min-height: 100%; }

      .page { max-width: 720px; margin: 0 auto; padding: 16px; }

      .toolbar {
        display: flex; align-items: center; gap: 16px;
        margin-bottom: 20px; flex-wrap: wrap;
      }
      h1 { margin: 0; font-size: 1.4em; color: var(--primary-text-color); }
      .stop-title { font-size: 1em; color: var(--secondary-text-color); }
      .stop-select {
        padding: 6px 10px; border-radius: 8px;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.95em;
      }

      .loading, .empty { padding: 40px; text-align: center; color: var(--secondary-text-color); }

      .help-btn {
        margin-left: auto; width: 30px; height: 30px; border-radius: 50%;
        border: 2px solid var(--primary-color); background: none;
        color: var(--primary-color); font-size: 1em; font-weight: 700;
        cursor: pointer; line-height: 1; flex-shrink: 0;
      }
      .help-btn:hover { background: var(--primary-color); color: var(--primary-color-text, #fff); }

      .help-box {
        background: var(--card-background-color, #fff);
        border: 1px solid var(--primary-color);
        border-radius: 12px; padding: 18px 20px;
        margin-bottom: 20px;
      }
      .help-title {
        font-size: 0.85em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--primary-color);
        margin-bottom: 14px;
      }
      .help-section {
        display: flex; gap: 12px; align-items: flex-start;
        margin-bottom: 12px; font-size: 0.9em; line-height: 1.5;
        color: var(--primary-text-color);
      }
      .help-section:last-child { margin-bottom: 0; }
      .help-divider {
        border: none; border-top: 1px solid var(--divider-color, rgba(0,0,0,.1));
        margin: 14px 0;
      }
      .help-card-title {
        font-size: 0.82em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.05em; color: var(--secondary-text-color);
        margin-bottom: 8px;
      }
      .help-code {
        font-family: monospace; font-size: 0.88em;
        background: var(--secondary-background-color);
        border-radius: 6px; padding: 10px 12px;
        white-space: pre; color: var(--primary-text-color);
        margin-bottom: 8px;
      }
      .help-copy-btn {
        padding: 5px 14px; border-radius: 6px; font-size: 0.82em;
        background: none; border: 1px solid var(--primary-color);
        color: var(--primary-color); cursor: pointer;
      }
      .help-copy-btn:hover { background: var(--primary-color); color: var(--primary-color-text, #fff); }

      .help-step {
        min-width: 24px; height: 24px; border-radius: 50%;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        font-size: 0.78em; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; margin-top: 1px;
      }

      .tabs {
        display: flex; border-bottom: 2px solid var(--divider-color, rgba(0,0,0,.1));
        margin-bottom: 16px;
      }
      .tab {
        padding: 10px 20px; border: none; background: none; cursor: pointer;
        font-size: 0.95em; color: var(--secondary-text-color);
        border-bottom: 3px solid transparent; margin-bottom: -2px;
        transition: all 0.2s;
      }
      .tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); font-weight: 600; }

      .content { min-height: 200px; }
      .hint { color: var(--secondary-text-color); font-size: 0.88em; margin: 0 0 12px; }

      .line-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px;
        background: var(--card-background-color, #fff);
        border-radius: 10px; margin-bottom: 8px;
        box-shadow: 0 1px 4px rgba(0,0,0,.06);
      }
      .lr-left { display: flex; align-items: center; gap: 14px; }
      .lr-num {
        font-size: 1.2em; font-weight: 800;
        color: var(--primary-color);
        min-width: 32px; text-align: center;
      }
      .lr-dir { font-size: 0.95em; color: var(--primary-text-color); }
      .lr-types { font-size: 0.78em; color: var(--secondary-text-color); margin-top: 2px; }
      .lr-actions { display: flex; gap: 8px; }
      .btn-edit {
        padding: 6px 14px; border-radius: 6px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; cursor: pointer; font-size: 0.88em;
      }
      .btn-del {
        padding: 6px 10px; border-radius: 6px;
        background: none; border: 1px solid var(--error-color, #e53935);
        color: var(--error-color, #e53935); cursor: pointer; font-size: 0.88em;
      }

      .add-btn {
        display: block; width: 100%; margin-top: 12px;
        padding: 12px; border: 2px dashed var(--primary-color);
        background: none; border-radius: 10px;
        color: var(--primary-color); cursor: pointer; font-size: 0.95em; font-weight: 600;
      }
      .add-btn:hover { background: var(--secondary-background-color); }

      /* Vacation section */
      .vac-section-title {
        font-size: 0.78em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--secondary-text-color);
        margin: 16px 0 8px;
      }
      .vac-divider {
        border: none; border-top: 1px solid var(--divider-color, rgba(0,0,0,.1));
        margin: 20px 0;
      }

      .vac-row {
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        padding: 10px 14px;
        background: var(--card-background-color, #fff);
        border-radius: 8px; margin-bottom: 6px;
      }
      .grp-icon { font-size: 1em; }
      .vac-name { flex: 1; font-size: 0.95em; font-weight: 600; min-width: 120px; }
      .vac-dates { font-size: 0.82em; color: var(--secondary-text-color); }
      .vac-group-badge {
        font-size: 0.78em; padding: 2px 8px; border-radius: 10px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        opacity: 0.8;
      }
      .vac-repeat-badge {
        font-size: 0.78em; padding: 2px 8px; border-radius: 10px;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        border: 1px solid var(--divider-color, rgba(0,0,0,.18));
      }
      .vac-repeat-toggle {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 0.86em; color: var(--primary-text-color);
        white-space: nowrap;
      }
      .vac-edit-btn, .grp-edit-btn {
        padding: 4px 10px; border-radius: 6px; font-size: 0.82em;
        background: none; border: 1px solid var(--primary-color);
        color: var(--primary-color); cursor: pointer; margin-left: auto;
      }
      .vac-del, .grp-del {
        background: none; border: none;
        color: var(--error-color, #e53935); cursor: pointer; font-size: 1em;
      }

      .vac-edit-row {
        display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        padding: 10px 14px;
        background: var(--secondary-background-color);
        border-radius: 8px; margin-bottom: 6px;
        border: 1px solid var(--primary-color);
      }
      .vac-edit-row input, .vac-edit-row select {
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 6px 9px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.9em;
      }
      .vac-edit-label, .grp-edit-label { flex: 1; min-width: 130px; }
      .vac-edit-save, .grp-edit-save {
        padding: 6px 12px; border-radius: 6px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; cursor: pointer; font-size: 0.88em; font-weight: 600;
      }
      .vac-edit-cancel, .grp-edit-cancel {
        background: none; border: none;
        color: var(--error-color, #e53935); cursor: pointer; font-size: 1em;
      }

      .vac-form {
        display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        margin-top: 10px; padding-top: 12px;
        border-top: 1px dashed var(--divider-color, rgba(0,0,0,.15));
      }
      .vac-form input, .vac-form select {
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 7px 10px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.9em;
      }
      .vac-label, .grp-label { flex: 1; min-width: 140px; }
      .vac-add, .grp-add {
        padding: 7px 14px; border-radius: 6px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; cursor: pointer; font-size: 0.9em;
      }

      .notif-row {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 14px; margin-bottom: 8px;
        background: var(--card-background-color, #fff);
        border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.05);
      }
      .notif-row.off { opacity: 0.58; }
      .notif-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .notif-name { font-size: 0.95em; font-weight: 700; color: var(--primary-text-color); }
      .notif-meta { font-size: 0.8em; color: var(--secondary-text-color); overflow-wrap: anywhere; }
      .notif-edit-btn {
        padding: 4px 10px; border-radius: 6px; font-size: 0.82em;
        background: none; border: 1px solid var(--primary-color);
        color: var(--primary-color); cursor: pointer;
      }
      .notif-del {
        background: none; border: none;
        color: var(--error-color, #e53935); cursor: pointer; font-size: 1em;
      }
      .notif-form {
        display: flex; flex-direction: column; gap: 10px;
        padding: 12px 14px; margin: 10px 0 12px;
        background: var(--card-background-color, #fff);
        border: 1px solid var(--divider-color, rgba(0,0,0,.16));
        border-radius: 8px;
      }
      .notif-enabled {
        display: inline-flex; align-items: center; gap: 7px;
        font-size: 0.88em; color: var(--primary-text-color);
      }
      .notif-label {
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 8px 10px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.92em;
      }
      .notif-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 10px;
      }
      .notif-grid label { display: flex; flex-direction: column; gap: 5px; }
      .notif-grid span {
        font-size: 0.75em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.04em; color: var(--secondary-text-color);
      }
      .notif-grid input, .notif-grid select {
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 7px 9px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.9em;
      }
      .time-range { display: flex; align-items: center; gap: 6px; }
      .time-range input { min-width: 0; width: 100%; }
      .day-row { display: flex; flex-wrap: wrap; gap: 7px; }
      .day-chip {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 5px 9px; border-radius: 16px;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        color: var(--secondary-text-color); font-size: 0.82em; cursor: pointer;
      }
      .day-chip.on {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border-color: var(--primary-color);
      }
      .day-chip input { display: none; }
      .notif-actions { display: flex; gap: 8px; align-items: center; }
      .notif-add, .notif-edit-save {
        padding: 7px 14px; border-radius: 6px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; cursor: pointer; font-size: 0.9em;
      }
      .notif-edit-cancel {
        background: none; border: none;
        color: var(--error-color, #e53935); cursor: pointer; font-size: 1em;
      }

      .unsaved-hint {
        margin: 10px 0 0; padding: 8px 12px;
        background: rgba(245, 124, 0, 0.15);
        border: 1px solid #f57c00; border-radius: 7px;
        color: var(--primary-text-color); font-size: 0.85em; font-weight: 600;
      }

      .footer {
        position: sticky; bottom: 0;
        padding: 14px 0;
        background: var(--primary-background-color);
        border-top: 1px solid var(--divider-color, rgba(0,0,0,.1));
        margin-top: 16px;
      }
      .save-btn {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; border-radius: 8px; padding: 12px 32px;
        font-size: 1em; font-weight: 600; cursor: pointer;
        transition: opacity 0.2s;
      }
      .save-btn:hover { opacity: 0.85; }
      .save-btn.saving { opacity: 0.6; pointer-events: none; }

      /* Line editor */
      .le-header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
      .back-btn {
        background: none; border: none; color: var(--primary-color);
        font-size: 0.95em; cursor: pointer; padding: 6px 0;
      }
      .le-header h2 { margin: 0; font-size: 1.15em; }

      .le-fields { margin-bottom: 16px; }
      .field { margin-bottom: 14px; }
      .field label {
        display: block; font-size: 0.78em; font-weight: 700;
        color: var(--secondary-text-color); text-transform: uppercase;
        letter-spacing: 0.04em; margin-bottom: 5px;
      }
      .field input, .field textarea {
        width: 100%; box-sizing: border-box;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 7px; padding: 9px 11px;
        font-size: 0.95em;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-family: inherit; resize: vertical;
      }
      .field input[readonly] { opacity: 0.6; }

      .type-checks { display: flex; flex-wrap: wrap; gap: 8px; }
      .type-chip {
        display: flex; align-items: center; gap: 6px;
        padding: 5px 12px; border-radius: 20px; cursor: pointer;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        font-size: 0.88em; transition: all 0.2s;
      }
      .type-chip.on {
        background: var(--primary-color);
        color: var(--primary-color-text, #fff);
        border-color: var(--primary-color);
      }
      .type-chip input { display: none; }

      .ttype-chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .ttype-chip, .tcat-chip, .combine-chip {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 14px; border-radius: 20px; cursor: pointer;
        border: 2px solid var(--tc, #999);
        background: transparent; color: var(--tc, #999);
        font-size: 0.9em; font-weight: 600; transition: all 0.2s;
      }
      .ttype-chip.active, .tcat-chip.active, .combine-chip.active {
        background: var(--tc, #999);
        color: #fff;
      }
      .ttype-chip:hover:not(.active), .tcat-chip:hover:not(.active), .combine-chip:hover:not(.active) { opacity: 0.75; }

      .sched-tabs {
        display: flex; flex-wrap: wrap; gap: 6px;
        margin: 14px 0 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.1));
      }
      .stab {
        padding: 6px 14px; border-radius: 18px;
        border: 1.5px solid; background: none;
        cursor: pointer; font-size: 0.88em;
        font-weight: 600; transition: all 0.18s;
      }
      .stab.vac-stab { border-style: dashed; }
      .stab.vac-stab.active { border-style: solid; }

      .stab-blue   { color: #1e88e5; border-color: #1e88e5; }
      .stab-yellow { color: #f9a825; border-color: #f9a825; }
      .stab-green  { color: #43a047; border-color: #43a047; }
      .stab-purple { color: #8e24aa; border-color: #8e24aa; }

      .stab-blue.active   { background: #1e88e5; color: #fff; }
      .stab-yellow.active { background: #f9a825; color: #fff; }
      .stab-green.active  { background: #43a047; color: #fff; }
      .stab-purple.active { background: #8e24aa; color: #fff; }

      .time-grid-wrap { margin-bottom: 80px; }
      .hour-row { margin-bottom: 3px; }
      .hour-hdr {
        display: flex; align-items: center; gap: 10px;
        padding: 7px 10px; border-radius: 7px; cursor: pointer;
        background: var(--card-background-color, #fff);
        transition: background 0.15s;
      }
      .hour-hdr:hover, .hour-hdr.open { background: var(--secondary-background-color); }
      .hour-lbl {
        font-size: 0.9em; font-weight: 700;
        color: var(--secondary-text-color); min-width: 28px;
      }
      .chips { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
      .chip {
        position: relative;
        border-radius: 4px; padding: 2px 6px;
        font-size: 0.78em; font-weight: 700; cursor: pointer;
        color: #fff; transition: opacity 0.15s;
      }
      .chip:hover { opacity: 0.7; }
      .chip-blue   { background: #1e88e5; }
      .chip-yellow { background: #f9a825; }
      .chip-green  { background: #43a047; }
      .chip-purple { background: #8e24aa; }
      .toggle { font-size: 0.68em; color: var(--secondary-text-color); margin-left: auto; }

      .chip-note-btn {
        position: absolute; top: -5px; right: -5px;
        width: 14px; height: 14px; line-height: 13px;
        border-radius: 50%; border: none; padding: 0;
        font-size: 8px; cursor: pointer;
        background: var(--card-background-color, #fff);
        color: var(--secondary-text-color);
        opacity: 0; transition: opacity 0.15s;
      }
      .chip:hover .chip-note-btn { opacity: 1; }
      .chip.has-note { padding-right: 10px; }
      .chip.has-note .chip-note-btn { opacity: 1; background: #e53935; color: #fff; }

      .chip-note-form {
        display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        padding: 10px 14px; margin: 2px 0 6px;
        background: var(--secondary-background-color);
        border-radius: 8px; border: 1px solid var(--primary-color);
      }
      .chip-note-form-lbl { font-size: 0.85em; font-weight: 600; color: var(--secondary-text-color); }
      .chip-note-input, .chip-skip-input {
        flex: 1; min-width: 160px;
        border: 1px solid var(--divider-color, rgba(0,0,0,.2));
        border-radius: 6px; padding: 6px 9px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color); font-size: 0.9em;
      }
      .chip-note-save {
        padding: 6px 12px; border-radius: 6px;
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; cursor: pointer; font-size: 0.88em; font-weight: 600;
      }
      .chip-note-clear {
        padding: 6px 10px; border-radius: 6px;
        background: none; border: 1px solid var(--error-color, #e53935);
        color: var(--error-color, #e53935); cursor: pointer; font-size: 0.85em;
      }
      .chip-note-cancel {
        background: none; border: none;
        color: var(--error-color, #e53935); cursor: pointer; font-size: 1em;
      }

      .min-grid {
        display: grid; grid-template-columns: repeat(10, 1fr);
        gap: 3px; padding: 8px;
        background: var(--secondary-background-color);
        border-radius: 0 0 7px 7px; margin-bottom: 4px;
      }
      .mcell {
        border: 1px solid var(--divider-color, rgba(0,0,0,.1));
        border-radius: 4px; padding: 5px 2px; font-size: 0.75em;
        cursor: pointer; background: var(--card-background-color, #fff);
        color: var(--secondary-text-color); transition: all 0.1s;
      }
      .mcell:hover { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .mcell.on { font-weight: 700; color: #fff; }
      .mcell-blue.on    { background: #1e88e5; border-color: #1e88e5; }
      .mcell-yellow.on  { background: #f9a825; border-color: #f9a825; }
      .mcell-green.on   { background: #43a047; border-color: #43a047; }
      .mcell-purple.on  { background: #8e24aa; border-color: #8e24aa; }

      .line-save-btn {
        background: var(--primary-color); color: var(--primary-color-text, #fff);
        border: none; border-radius: 8px; padding: 12px 32px;
        font-size: 1em; font-weight: 600; cursor: pointer;
      }
    `;
  }
}

if (!customElements.get("ha-timetable-panel")) {
  customElements.define("ha-timetable-panel", MHDTimetablePanel);
}
if (!customElements.get("mhd-timetable-panel")) {
  // A single class cannot be registered under two tag names - the Custom
  // Elements spec throws "this constructor has already been used with this
  // registry". Use a trivial subclass for the legacy alias instead.
  class MHDTimetablePanelLegacy extends MHDTimetablePanel {}
  customElements.define("mhd-timetable-panel", MHDTimetablePanelLegacy);
}
