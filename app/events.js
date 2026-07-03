import { PI_SERVICE_URL } from './config';

// React Native's fetch doesn't support incrementally reading a
// streaming response body the way web fetch does, so this uses the
// classic RN pattern for consuming SSE instead: XHR's onprogress fires
// repeatedly with the full response text so far, and we diff against
// the last-seen length to find newly-arrived `data: ...` chunks. No
// extra native dependency needed (avoids yet another EAS rebuild).
const RECONNECT_DELAY_MS = 5000;

export function subscribeToEvents(onEvent) {
  let xhr = null;
  let reconnectTimer = null;
  let cancelled = false;

  function connect() {
    if (cancelled) return;
    xhr = new XMLHttpRequest();
    xhr.open('GET', `${PI_SERVICE_URL}/events`);

    let lastLength = 0;
    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(lastLength);
      lastLength = xhr.responseText.length;
      const chunks = newText.split('\n\n').filter((chunk) => chunk.trim());
      for (const chunk of chunks) {
        const match = chunk.match(/^data: (.*)$/m);
        if (!match) continue;
        try {
          onEvent(JSON.parse(match[1]));
        } catch {
          // malformed chunk (e.g. split across two onprogress calls) — skip it
        }
      }
    };

    // The connection ending (server restart, network blip, or the
    // Pi being unreachable) always retries — there's no "give up"
    // state here, matching AppBanner's own retry-forever pattern for
    // /system/status.
    function scheduleReconnect() {
      if (cancelled) return;
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    }
    xhr.onerror = scheduleReconnect;
    xhr.onloadend = scheduleReconnect;

    xhr.send();
  }

  connect();

  return function unsubscribe() {
    cancelled = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (xhr) xhr.abort();
  };
}
