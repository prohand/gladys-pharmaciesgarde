// -----------------------------------------------------------------------------
// A duty rota published online (open data portal, town web site, a file of
// your own on the LAN).
//
// The file is read in the same formats as the rota typed in the configuration
// (see planning.js), refreshed every `refresh_hours`, and the last copy read
// is kept: a portal that is down for a day must not erase the rota.
// -----------------------------------------------------------------------------

/** A rota is a few KB: a bigger answer is not one. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Whether a planning URL can be fetched (http or https only).
 * @param {string} url
 */
export function isValidPlanningUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Download a published rota, as text.
 * @param {string} url
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchPlanningText(url, fetchImpl = fetch) {
  if (!isValidPlanningUrl(url)) throw new Error('invalid planning URL');
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json, text/plain, text/csv, */*' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error('file too large');
  return text;
}
