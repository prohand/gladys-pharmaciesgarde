# Pharmacies de garde

This integration tells Gladys **which pharmacy is on duty**, and **which
pharmacies are open** around the house. It feeds a device, a dashboard widget,
scene triggers and scene actions.

## Before you start

- You need **Gladys 5.3 or newer**.
- The **position of the house** must be filled in in Gladys
  (**Settings → Houses**). The integration reads it: Gladys asks you for
  permission at install time.

> There is no national feed of pharmacies on duty. At night, in France, the
> reference remains **3237** (or [3237.fr](https://www.3237.fr/)). This
> integration helps you day to day, it does not replace the official service.

## The sources

Use one, or several. The device badge shows where the answer comes from:
**local** or **cloud**.

| Source                            | Transport | What it gives                                                           |
| --------------------------------- | --------- | ----------------------------------------------------------------------- |
| **Duty rota** (typed)             | local     | The pharmacy on duty, according to the rota of your sector              |
| **Rota published online** (a URL) | cloud     | Same, from a published file (open data, town hall site…)                |
| **OpenStreetMap**                 | cloud     | The pharmacies around the house, with their opening hours (open/closed) |

Order in which the suggested pharmacy is chosen:

1. a turn found in a rota. If both rotas give one, the Gladys switch
   **"Prefer the local connection"** decides: on (the default) = typed rota,
   off = published rota;
2. otherwise, the nearest **open** pharmacy according to OpenStreetMap. The
   badge turns **degraded** (orange dot): it is open, not necessarily on duty.

### Duty rota (local)

The rota is published by the pharmacists' union of your sector, often relayed
by the town hall, the local paper or the pharmacies. Copy it into the
**Duty rota (local)** field: nothing leaves Gladys.

One turn per line (or separated by `|`, as the field fits on a single line),
fields separated by `;`:

```
date [> end] ; name ; address ; phone
```

Examples:

```
2026-11-01 ; Pharmacie du Centre ; 12 rue de la Paix, Lyon ; 04 78 00 00 01
2026-11-07 19:00 > 2026-11-14 09:00 ; Pharmacie des Halles ; 3 place des Halles ; 04 78 00 00 02
15/11/2026 9h00 ; Pharmacie du Pont
# une ligne qui commence par # est un commentaire
```

- a **date alone** = the whole day (midnight to midnight);
- a **start time without an end** = 24 hours;
- an **end date without a time** = until the end of that day;
- the address and the phone are optional. If the name matches an OpenStreetMap
  pharmacy, the integration fills in the position and the phone;
- times are read in the **time zone** of the configuration.

**JSON** is also accepted: a list of objects
`{ "start", "end", "name", "address", "phone", "latitude", "longitude" }`
(or `date` for a whole day). The French keys `debut`, `fin`, `nom`,
`adresse`, `telephone` are read too, and a list can be stored under
`entries`, `records` or `results` (Opendatasoft format included).

### Rota published online (cloud)

Put the address of a file in the same format (text or JSON) in **Rota published
online (cloud)**. It is read again at every **refresh interval**. If the
server does not answer, the last copy read is kept.

### OpenStreetMap (cloud)

Enabled by default. Once a day (adjustable), the integration asks the public
Overpass API for the pharmacies within the **search radius**. After that,
everything is computed every minute on Gladys, with no network call.

Opening hours are read when they are simple
(`Mo-Fr 08:30-19:30; Sa 09:00-12:00`, `24/7`, opening after midnight). More
complex hours (months, public holidays…) are marked **unknown**: the pharmacy
is listed but never announced as open. Public holidays are not known: on such
a day, the weekly schedule is an estimate.

A pharmacy with wrong information? Fix it on
[openstreetmap.org](https://www.openstreetmap.org): everyone benefits.

## Configuration

| Field                                          | Role                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| **House**                                      | The house to search around. Empty: the first one with a position          |
| **Latitude (optional) / Longitude (optional)** | Optional: search somewhere else (second home…). Both, or neither          |
| **Search radius (km)**                         | 1 to 30 km, 5 by default                                                  |
| **Open pharmacies (OpenStreetMap)**            | Enables the OpenStreetMap source                                          |
| **Duty rota (local)**                          | The typed rota (see above)                                                |
| **Rota published online (cloud)**              | The URL of a published rota                                               |
| **Country**                                    | The official service the widget links to: 3237 (France), aponet (Germany) |
| **Time zone**                                  | IANA name, `Europe/Paris` by default                                      |
| **Refresh interval (h)**                       | How often OSM and the online rota are read again, 24 h by default         |
| **Rota ending warning (days)**                 | Delay of the "Rota running out" trigger. 0 = disabled                     |
| **Overpass server (advanced)**                 | Another Overpass server. Empty = `overpass-api.de`                        |

Two buttons:

- **Test the sources**: reads everything again and shows the position, the
  turns read (and the unreadable lines, with their number), the state of
  OpenStreetMap and the current answer;
- **Show the next turns**: the list of turns for the next N days, to check that
  the rota is read correctly.

## The "Pharmacie de garde" device

In **Integrations → Pharmacies de garde → Discovery**, create the device. Its
features:

| Feature                | Content                                                |
| ---------------------- | ------------------------------------------------------ |
| Pharmacy               | Name of the suggested pharmacy (`-` if none)           |
| Address, Phone         | Its contact details                                    |
| Source                 | `rota`, `published rota` or `open now (OpenStreetMap)` |
| Distance               | Straight-line distance, in km                          |
| Nearest open, Distance | The nearest open pharmacy, whatever the rota           |

## The "Pharmacies" widget

Add it to the dashboard. It shows the suggested pharmacy (name, source, until
when, phone), the number of open pharmacies, the distance, the list of
pharmacies (with address, hours and map link) and the days left in the rota.
Buttons: **Refresh**, **Show on the map**, and the country's **official
service**.

Setting: **Pharmacies listed** (0 to 8).

## Scenes

### Triggers

| Trigger                          | When                                                        | Variables                                                     |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| **The pharmacy on duty changed** | New turn, or (without a rota) another nearest open pharmacy | `name`, `address`, `phone`, `distance_km`, `until`, `map_url` |
| **No pharmacy available**        | Neither a turn nor an open pharmacy around the house        | —                                                             |
| **Rota running out**             | The rota ends in fewer than N days (once a day)             | `days_left`, `last_day`                                       |

The first one can be filtered by **source** (typed rota, published rota, or
OpenStreetMap).

Example: _"On Saturday at 6 pm, send me the weekend's pharmacy on duty"_,
or _"When the pharmacy on duty changes, send
`{{triggerEvent.data.name}} — {{triggerEvent.data.phone}}`"_.

### Actions

| Action                        | Fields                                                            | Outputs                                                                          |
| ----------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Find the pharmacy on duty** | When: now, tonight (21:00), tomorrow (10:00), next Sunday (10:00) | `found`, `name`, `address`, `phone`, `distance_km`, `until`, `source`, `map_url` |
| **Refresh the pharmacies**    | —                                                                 | `found`, `open_count`                                                            |

## Privacy

- The typed rota never leaves Gladys.
- OpenStreetMap (Overpass) receives the position of the house **rounded to
  about 100 m**, once per refresh interval. Distances are computed on Gladys,
  with the exact position.
- The published rota is a simple download of the URL you give.
- Cached data is in `/data/state.json`, inside the container.

## Troubleshooting

| Symptom                                  | What to do                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| "Neither house position nor rota"        | Fill in the position of the house in Gladys, or the coordinates                                 |
| No open pharmacy although there are some | Hours missing or complex in OSM: **Test the sources** gives the number "without readable hours" |
| A line of the rota is ignored            | **Test the sources** gives the line number and the reason                                       |
| Wrong duty time                          | Check the **time zone**                                                                         |
| "Online sources are not responding"      | Overpass is sometimes overloaded: try again, or change server                                   |
