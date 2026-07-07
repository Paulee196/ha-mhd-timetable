const version = new URL(import.meta.url).searchParams.get("v");
await import(`./ha-timetable-card.js${version ? `?v=${encodeURIComponent(version)}` : ""}`);
