// Shared fixtures: a fake fetch, an Overpass answer around Lyon, and a clock.

/** 2026-11-01 (a Sunday) at 11:00, Paris time (UTC+1). */
export const SUNDAY_11H = Date.parse('2026-11-01T10:00:00Z');

export const HOME = { latitude: 45.764, longitude: 4.8357 };

export const OVERPASS_ANSWER = {
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 45.765,
      lon: 4.836,
      tags: {
        amenity: 'pharmacy',
        name: 'Pharmacie du Centre',
        opening_hours: 'Mo-Sa 08:30-19:30',
        phone: '+33 4 78 00 00 01',
        'addr:housenumber': '12',
        'addr:street': 'Rue de la République',
        'addr:postcode': '69002',
        'addr:city': 'Lyon',
      },
    },
    {
      type: 'way',
      id: 2,
      center: { lat: 45.77, lon: 4.84 },
      tags: {
        amenity: 'pharmacy',
        name: 'Pharmacie des Halles',
        opening_hours: 'Mo-Su 08:00-20:00',
      },
    },
    {
      type: 'node',
      id: 3,
      lat: 45.75,
      lon: 4.82,
      tags: {
        amenity: 'pharmacy',
        name: 'Grande Pharmacie',
        opening_hours: 'Jan-Mar Mo-Fr 09:00-12:00',
      },
    },
    // The same pharmacy again, from the healthcare= branch of the union.
    {
      type: 'way',
      id: 2,
      center: { lat: 45.77, lon: 4.84 },
      tags: { healthcare: 'pharmacy', name: 'Pharmacie des Halles' },
    },
  ],
};

/**
 * A fetch that answers per URL prefix and records the calls.
 * @param {Record<string, object | string | Error | ((url: string) => object)>} routes
 */
export function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    const key = Object.keys(routes).find((prefix) => String(url).startsWith(prefix));
    if (!key) return new Response('not found', { status: 404 });
    let answer = routes[key];
    if (typeof answer === 'function') answer = answer(String(url));
    if (answer instanceof Error) throw answer;
    if (answer instanceof Response) return answer;
    const body = typeof answer === 'string' ? answer : JSON.stringify(answer);
    return new Response(body, { status: 200 });
  };
  impl.calls = calls;
  return impl;
}
