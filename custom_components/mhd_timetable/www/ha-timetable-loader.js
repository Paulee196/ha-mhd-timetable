/**
 * Tiny, dependency-free bootstrap for ha-timetable-card.js.
 *
 * Home Assistant's frontend loads us via a single `import(url)` call with no
 * retry (see homeassistant.components.frontend.add_extra_js_url). On a flaky
 * connection - the HA Companion App's WebView on a cold start over mobile
 * data being the classic case - that one fetch can fail, and nothing ever
 * tries again for the rest of that session: the card stays permanently
 * undefined until the user finds a way to force a completely fresh load
 * (which, in the app, may not even be possible).
 *
 * This loader retries the real import a few times with backoff before
 * giving up, so a single transient network hiccup doesn't leave the card
 * broken for an entire session.
 */
// Top-level await (not a fire-and-forget IIFE) so this module's own
// evaluation - and therefore the import() call that loaded it - only
// resolves once loading has either succeeded or been fully retried. That
// makes the outcome observable/awaitable by anything that imports this
// loader, including the CI check for this file.
var selfUrl = new URL(import.meta.url);
var version = selfUrl.searchParams.get("v") || "";
var target = "./ha-timetable-card.js" + (version ? "?v=" + encodeURIComponent(version) : "");

var attempts = 4;
var delayMs = 800;

for (var i = 0; i < attempts; i++) {
  try {
    await import(target);
    break;
  } catch (err) {
    if (i === attempts - 1) {
      console.error("[ha_timetable] Could not load ha-timetable-card.js after retries:", err);
    } else {
      await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
      delayMs *= 2;
    }
  }
}
