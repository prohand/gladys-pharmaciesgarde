# Pharmacies de garde (Notdienst-Apotheken)

Diese Integration sagt Gladys, **welche Apotheke Notdienst hat** und **welche
Apotheken geöffnet sind**, und zwar in der Umgebung deines Hauses. Sie versorgt
ein Gerät, ein Dashboard-Widget, Auslöser und Szenen-Aktionen.

## Bevor du loslegst

- Du brauchst **Gladys 5.3 oder neuer**.
- Der **Standort des Hauses** muss in Gladys eingetragen sein
  (**Einstellungen → Häuser**). Die Integration liest ihn aus: Gladys fragt dich
  bei der Installation um Erlaubnis.

> Es gibt keinen landesweiten Datenfeed für Notdienst-Apotheken. In Frankreich
> ist nachts weiterhin die **3237** (oder [3237.fr](https://www.3237.fr/)) die
> Referenz. In Deutschland ist die offizielle Notdienstsuche
> [aponet.de](https://www.aponet.de/apotheke/notdienstsuche) oder die
> Telefonnummer **0800 00 22 8 33** (aus dem Festnetz kostenlos) bzw.
> **22 8 33** (vom Handy, kostenpflichtig); das Widget verlinkt über die Einstellung
> **Land** = Deutschland dorthin. Diese Integration hilft dir im Alltag, sie
> ersetzt nicht den offiziellen Dienst.

## Die Quellen

Nutze eine oder mehrere. Das Badge des Geräts zeigt, woher die Antwort kommt:
**lokal** oder **Cloud**.

| Quelle                         | Übertragung | Was sie liefert                                                                |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------ |
| **Notdienstplan** (eingegeben) | lokal       | Die Notdienst-Apotheke laut Plan deines Bezirks                                |
| **Online-Plan** (eine URL)     | Cloud       | Dasselbe, aus einer veröffentlichten Datei (Open Data, Website der Gemeinde…)  |
| **OpenStreetMap**              | Cloud       | Die Apotheken rund um das Haus mit ihren Öffnungszeiten (geöffnet/geschlossen) |

Reihenfolge bei der Wahl der empfohlenen Apotheke:

1. ein Dienst, der in einem Plan gefunden wird. Wenn beide Pläne einen liefern,
   entscheidet der Gladys-Schalter **„Lokale Verbindung bevorzugen“**: aktiviert
   (Standard) = eingegebener Plan, deaktiviert = Online-Plan;
2. sonst die nächste **geöffnete** Apotheke laut OpenStreetMap. Das Badge wechselt
   auf **eingeschränkt** (oranger Punkt): Sie ist geöffnet, aber nicht
   unbedingt im Notdienst.

### Notdienstplan (lokal)

Der Plan wird von der Apothekerkammer bzw. dem Apothekerverband deines Bezirks
veröffentlicht und oft von der Gemeinde, der Lokalzeitung oder den Apotheken
weitergegeben. Kopiere ihn in das Feld **Notdienstplan (lokal)**: Nichts verlässt
Gladys.

Ein Dienst pro Zeile (oder getrennt durch `|`, wenn das Feld nur eine Zeile
hat), Felder getrennt durch `;`:

```
date [> fin] ; nom ; adresse ; téléphone
```

Beispiele:

```
2026-11-01 ; Pharmacie du Centre ; 12 rue de la Paix, Lyon ; 04 78 00 00 01
2026-11-07 19:00 > 2026-11-14 09:00 ; Pharmacie des Halles ; 3 place des Halles ; 04 78 00 00 02
15/11/2026 9h00 ; Pharmacie du Pont
# une ligne qui commence par # est un commentaire
```

- ein **Datum allein** = der ganze Tag (von Mitternacht bis Mitternacht);
- eine **Startzeit ohne Ende** = 24 Stunden;
- ein **Enddatum ohne Uhrzeit** = bis zum Ende dieses Tages;
- Adresse und Telefonnummer sind optional. Wenn der Name zu einer Apotheke aus
  OpenStreetMap passt, ergänzt die Integration Standort und Telefonnummer;
- die Uhrzeiten werden in der **Zeitzone** der Konfiguration gelesen.

**JSON** wird ebenfalls akzeptiert: eine Liste von Objekten
`{ "start", "end", "name", "address", "phone", "latitude", "longitude" }`
(oder `date` für einen Tag). Die französischen Schlüssel `debut`, `fin`, `nom`,
`adresse`, `telephone` werden ebenfalls gelesen, und eine Liste kann unter
`entries`, `records` oder `results` abgelegt sein (das Opendatasoft-Format wird
verstanden).

### Online-Plan (Cloud)

Trage die Adresse einer Datei im selben Format (Text oder JSON) bei **Online
veröffentlichter Plan (Cloud)** ein. Sie wird bei jedem **Aktualisierungsintervall**
neu gelesen. Antwortet der Server nicht, bleibt die zuletzt gelesene Kopie
erhalten.

### OpenStreetMap (Cloud)

Standardmäßig aktiviert. Einmal am Tag (einstellbar) fragt die Integration die
öffentliche Overpass-API nach den Apotheken im **Suchradius**. Danach wird
alles jede Minute auf Gladys berechnet, ohne Netzwerkzugriff.

Die Öffnungszeiten werden gelesen, wenn sie einfach sind
(`Mo-Fr 08:30-19:30; Sa 09:00-12:00`, `24/7`, Öffnung über Mitternacht hinaus).
Kompliziertere Zeiten (Monate, Feiertage…) werden als **unbekannt** markiert: Die
Apotheke wird aufgelistet, aber nie als geöffnet gemeldet. Feiertage sind nicht
bekannt: An diesem Tag ist die Wochenzeit nur eine Schätzung.

Eine Apotheke ist falsch eingetragen? Korrigiere sie auf
[openstreetmap.org](https://www.openstreetmap.org): Alle profitieren davon.

## Konfiguration

| Feld                                               | Aufgabe                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Haus**                                           | Das Haus, um das herum gesucht wird. Leer: das erste mit Standort                          |
| **Breitengrad (optional) / Längengrad (optional)** | Optional: woanders suchen (Zweitwohnsitz…). Beide oder keine                               |
| **Suchradius (km)**                                | 1 bis 30 km, standardmäßig 5                                                               |
| **Geöffnete Apotheken (OpenStreetMap)**            | Aktiviert die Quelle OpenStreetMap                                                         |
| **Notdienstplan (lokal)**                          | Der eingegebene Plan (siehe oben)                                                          |
| **Online veröffentlichter Plan (Cloud)**           | Die URL eines veröffentlichten Plans                                                       |
| **Land**                                           | Der offizielle Dienst, zu dem das Widget verlinkt: 3237 (Frankreich), aponet (Deutschland) |
| **Zeitzone**                                       | IANA-Name, standardmäßig `Europe/Paris`                                                    |
| **Aktualisierungsintervall (h)**                   | Neulesen von OSM und Online-Plan, standardmäßig 24 h                                       |
| **Warnung Planende (Tage)**                        | Vorlauf des Auslösers „Notdienstplan läuft bald aus“. 0 = deaktiviert                      |
| **Overpass-Server (erweitert)**                    | Ein anderer Overpass-Server. Leer = `overpass-api.de`                                      |

Zwei Schaltflächen:

- **Quellen testen**: liest alles neu und zeigt den Standort, die gelesenen
  Dienste (und die unlesbaren Zeilen, mit ihrer Nummer), den Zustand von
  OpenStreetMap und die aktuelle Antwort;
- **Nächste Dienste anzeigen**: die Liste der Dienste der nächsten N Tage, um zu
  prüfen, ob der Plan richtig gelesen wird.

## Das Gerät „Pharmacie de garde“

Erstelle das Gerät unter **Integrationen → Pharmacies de garde → Erkennung**. Seine
Funktionen:

| Funktion                      | Inhalt                                                   |
| ----------------------------- | -------------------------------------------------------- |
| Apotheke                      | Name der empfohlenen Apotheke (`-`, wenn keine)          |
| Adresse, Telefon              | Ihre Kontaktdaten                                        |
| Quelle                        | `rota`, `published rota` oder `open now (OpenStreetMap)` |
| Entfernung                    | Luftlinie, in km                                         |
| Nächste geöffnete, Entfernung | Die nächste geöffnete Apotheke, unabhängig vom Plan      |

## Das Widget „Apotheken“

Füge es dem Dashboard hinzu. Es zeigt die empfohlene Apotheke (Name, Quelle, bis
wann, Telefon), die Anzahl der geöffneten Apotheken, die Entfernung, die Liste
der Apotheken (mit Adresse, Öffnungszeiten und Kartenlink) und die verbleibenden
Tage des Plans. Schaltflächen: **Aktualisieren**, **Auf der Karte ansehen** und
der **offizielle Dienst** des Landes.

Einstellung: **Aufgelistete Apotheken** (0 bis 8).

## Szenen

### Auslöser

| Auslöser                                  | Wann                                                                     | Variablen                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **Die Notdienst-Apotheke hat gewechselt** | Neuer Dienst oder (ohne Plan) andere nächste geöffnete Apotheke          | `name`, `address`, `phone`, `distance_km`, `until`, `map_url` |
| **Keine Apotheke verfügbar**              | Weder ein Dienst noch eine geöffnete Apotheke in der Umgebung des Hauses | —                                                             |
| **Notdienstplan läuft bald aus**          | Der Plan endet in weniger als N Tagen (einmal am Tag)                    | `days_left`, `last_day`                                       |

Der erste kann nach **Quelle** gefiltert werden (Eingegebener Plan, Online-Plan
oder Geöffnet (OpenStreetMap)).

Beispiel: _„Samstags um 18 Uhr schick mir die Notdienst-Apotheke des
Wochenendes“_ oder _„Wenn die Notdienst-Apotheke wechselt, sende
`{{triggerEvent.data.name}} — {{triggerEvent.data.phone}}`“_.

### Aktionen

| Aktion                        | Felder                                                                        | Ausgaben                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Notdienst-Apotheke finden** | Wann: Jetzt, Heute Abend (21 Uhr), Morgen (10 Uhr), Nächster Sonntag (10 Uhr) | `found`, `name`, `address`, `phone`, `distance_km`, `until`, `source`, `map_url` |
| **Apotheken aktualisieren**   | —                                                                             | `found`, `open_count`                                                            |

## Datenschutz

- Der eingegebene Plan verlässt Gladys nie.
- OpenStreetMap (Overpass) erhält den Standort des Hauses **auf etwa 100 m
  gerundet**, einmal pro Aktualisierungsintervall. Die Entfernungen werden auf
  Gladys mit dem genauen Standort berechnet.
- Der Online-Plan ist ein einfacher Download der URL, die du angibst.
- Die zwischengespeicherten Daten liegen in `/data/state.json`, im Container.

## Fehlerbehebung

| Symptom                                        | Was tun                                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| „Weder Standort des Hauses noch Plan“          | Trage den Standort des Hauses in Gladys ein, oder die Koordinaten                                                 |
| Keine Apotheke geöffnet, obwohl es welche gibt | Öffnungszeiten fehlen oder sind komplex in OSM: **Quellen testen** zeigt die Anzahl „ohne lesbare Öffnungszeiten“ |
| Eine Zeile des Plans wird ignoriert            | **Quellen testen** zeigt die Zeilennummer und den Grund                                                           |
| Falsche Uhrzeit des Dienstes                   | Prüfe die **Zeitzone**                                                                                            |
| „Die Online-Quellen antworten nicht“           | Overpass ist manchmal überlastet: Versuche es erneut oder wechsle den Server                                      |
