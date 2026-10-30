# Farmacias de guardia

Esta integración indica a Gladys **qué farmacia está de guardia** y **qué
farmacias están abiertas** alrededor de la casa. Alimenta un dispositivo, un
widget del panel, disparadores y acciones de escena.

## Antes de empezar

- Se necesita **Gladys 5.3 o posterior**.
- La **ubicación de la casa** debe estar indicada en Gladys
  (**Ajustes → Casas**). La integración la lee: Gladys le pide autorización al
  instalarla.

> No existe un flujo nacional de farmacias de guardia. En España no hay un
> servicio nacional: el calendario de guardias lo publica cada Colegio de
> Farmacéuticos provincial, así que consulte el del Colegio Oficial de
> Farmacéuticos de su provincia. En caso de urgencia, llame al **112**. En
> Francia, por la noche, la referencia sigue siendo el **3237** (o
> [3237.fr](https://www.3237.fr/)). Esta integración le ayuda en el día a día,
> pero no sustituye al servicio oficial.

## Las fuentes

Utilice una o varias. La insignia del dispositivo muestra de dónde viene la
respuesta: **local** o **nube**.

| Fuente                                  | Transporte | Qué aporta                                                                   |
| --------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| **Cuadro de turnos** (escrito)          | local      | La farmacia de guardia, según el cuadro de su zona                           |
| **Cuadro de turnos en línea** (una URL) | nube       | Lo mismo, desde un archivo publicado (datos abiertos, web del ayuntamiento…) |
| **OpenStreetMap**                       | nube       | Las farmacias alrededor de la casa, con su horario (abierta/cerrada)         |

Orden de elección de la farmacia recomendada:

1. un turno encontrado en un cuadro. Si los dos cuadros aportan uno, decide el
   interruptor de Gladys **«Preferir la conexión local»**: activado (por
   defecto) = cuadro escrito, desactivado = cuadro en línea;
2. si no, la farmacia **abierta** más cercana según OpenStreetMap. La insignia
   pasa a **degradado** (punto naranja): está abierta, pero no necesariamente
   de guardia.

### Cuadro de turnos (local)

El cuadro lo publica el Colegio de Farmacéuticos de su provincia, y a menudo lo
difunden el ayuntamiento, la prensa local o las propias farmacias. Cópielo en el
campo **Cuadro de turnos (local)**: nada sale de Gladys.

Un turno por línea (o separados por `|`, si el campo ocupa una sola línea),
con los campos separados por `;`:

```
fecha [> fin] ; nombre ; dirección ; teléfono
```

Ejemplos:

```
2026-11-01 ; Pharmacie du Centre ; 12 rue de la Paix, Lyon ; 04 78 00 00 01
2026-11-07 19:00 > 2026-11-14 09:00 ; Pharmacie des Halles ; 3 place des Halles ; 04 78 00 00 02
15/11/2026 9h00 ; Pharmacie du Pont
# une ligne qui commence par # est un commentaire
```

- una **fecha sola** = todo el día (de medianoche a medianoche);
- una **hora de inicio sin fin** = 24 horas;
- una **fecha de fin sin hora** = hasta el final de ese día;
- la dirección y el teléfono son opcionales. Si el nombre coincide con una
  farmacia de OpenStreetMap, la integración completa la ubicación y el
  teléfono;
- las horas se leen en la **zona horaria** de la configuración.

También se acepta **JSON**: una lista de objetos
`{ "start", "end", "name", "address", "phone", "latitude", "longitude" }`
(o `date` para un día). Las claves en francés `debut`, `fin`, `nom`,
`adresse`, `telephone` también se leen, y la lista puede estar dentro de
`entries`, `records` o `results` (se admite el formato Opendatasoft).

### Cuadro de turnos en línea (nube)

Indique la dirección de un archivo con el mismo formato (texto o JSON) en
**Cuadro de turnos en línea**. Se vuelve a leer en cada **intervalo de
actualización**. Si el servidor no responde, se conserva la última copia leída.

### OpenStreetMap (nube)

Activado por defecto. Una vez al día (configurable), la integración pide a la
API pública de Overpass las farmacias situadas dentro del **radio de
búsqueda**. Después, todo se calcula cada minuto en Gladys, sin llamadas de
red.

Los horarios de apertura se leen cuando son sencillos
(`Mo-Fr 08:30-19:30; Sa 09:00-12:00`, `24/7`, apertura pasada la medianoche).
Los horarios más complejos (meses, festivos…) se marcan como **desconocidos**:
la farmacia aparece en la lista, pero nunca se anuncia como abierta. Los
festivos no se conocen: ese día, el horario de la semana es una estimación.

¿Una farmacia con datos incorrectos? Corríjala en
[openstreetmap.org](https://www.openstreetmap.org): todo el mundo se beneficia.

## Configuración

| Campo                                        | Función                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Casa**                                     | La casa alrededor de la cual buscar. Vacío: la primera con ubicación                          |
| **Latitud (opcional) / Longitud (opcional)** | Opcional: buscar en otro lugar (segunda residencia…). Las dos, o ninguna                      |
| **Radio de búsqueda (km)**                   | De 1 a 30 km, 5 por defecto                                                                   |
| **Farmacias abiertas (OpenStreetMap)**       | Activa la fuente OpenStreetMap                                                                |
| **Cuadro de turnos (local)**                 | El cuadro escrito (véase más arriba)                                                          |
| **Cuadro de turnos en línea (nube)**         | La URL de un cuadro publicado                                                                 |
| **País**                                     | El servicio oficial al que enlaza el widget: 3237 (Francia), aponet (Alemania), España u Otro |
| **Zona horaria**                             | Nombre IANA, `Europe/Paris` por defecto (en España, `Europe/Madrid`)                          |
| **Intervalo de actualización (h)**           | Nueva lectura de OSM y del cuadro en línea, 24 h por defecto                                  |
| **Aviso fin de turnos (días)**               | Plazo del disparador «Cuadro de turnos a punto de acabar». 0 = desactivado                    |
| **Servidor Overpass (avanzado)**             | Otro servidor Overpass. Vacío = `overpass-api.de`                                             |

Dos botones:

- **Probar las fuentes**: vuelve a leerlo todo y muestra la ubicación, los
  turnos leídos (y las líneas ilegibles, con su número), el estado de
  OpenStreetMap y la respuesta del momento;
- **Ver los próximos turnos**: la lista de turnos de los próximos N días, para
  comprobar que el cuadro se lee correctamente.

## El dispositivo «Pharmacie de garde»

En **Integraciones → Pharmacies de garde → Descubrimiento**, cree el
dispositivo. Sus características:

| Característica                 | Contenido                                                 |
| ------------------------------ | --------------------------------------------------------- |
| Farmacia                       | Nombre de la farmacia recomendada (`-` si no hay ninguna) |
| Dirección, Teléfono            | Sus datos de contacto                                     |
| Fuente                         | `rota`, `published rota` o `open now (OpenStreetMap)`     |
| Distancia                      | Distancia en línea recta, en km                           |
| Abierta más cercana, Distancia | La farmacia abierta más cercana, sea cual sea el cuadro   |

## El widget «Farmacias»

Añádalo al panel. Muestra la farmacia recomendada (nombre, fuente, hasta
cuándo, teléfono), el número de farmacias abiertas, la distancia, la lista de
farmacias (con dirección, horario y enlace al mapa) y los días restantes del
cuadro. Botones: **Actualizar**, **Ver en el mapa** y el **servicio oficial**
del país.

Ajuste: **Farmacias listadas** (de 0 a 8).

## Escenas

### Disparadores

| Disparador                             | Cuándo                                                       | Variables                                                     |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| **La farmacia de guardia ha cambiado** | Nuevo turno o (sin cuadro) otra farmacia abierta más cercana | `name`, `address`, `phone`, `distance_km`, `until`, `map_url` |
| **Ninguna farmacia disponible**        | Ni turno ni farmacia abierta alrededor de la casa            | —                                                             |
| **Cuadro de turnos a punto de acabar** | El cuadro termina en menos de N días (una vez al día)        | `days_left`, `last_day`                                       |

El primero puede filtrarse por **fuente** (cuadro escrito, en línea u
OpenStreetMap).

Ejemplo: _«El sábado a las 18:00, envíame la farmacia de guardia del fin de
semana»_, o _«Cuando cambie la farmacia de guardia, envía
`{{triggerEvent.data.name}} — {{triggerEvent.data.phone}}`»_.

### Acciones

| Acción                            | Campos                                                                     | Salidas                                                                          |
| --------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Buscar la farmacia de guardia** | Cuándo: ahora, esta noche (21:00), mañana (10:00), próximo domingo (10:00) | `found`, `name`, `address`, `phone`, `distance_km`, `until`, `source`, `map_url` |
| **Actualizar las farmacias**      | —                                                                          | `found`, `open_count`                                                            |

## Privacidad

- El cuadro escrito nunca sale de Gladys.
- OpenStreetMap (Overpass) recibe la ubicación de la casa **redondeada a unos
  100 m**, una vez por intervalo de actualización. Las distancias se calculan
  en Gladys, con la ubicación exacta.
- El cuadro en línea es una simple descarga de la URL que usted indique.
- Los datos en caché están en `/data/state.json`, dentro del contenedor.

## Solución de problemas

| Síntoma                                  | Qué hacer                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| «Ni ubicación de la casa ni cuadro»      | Indique la ubicación de la casa en Gladys, o las coordenadas                                                     |
| Ninguna farmacia abierta aunque las haya | Horarios ausentes o complejos en OSM: **Probar las fuentes** indica el número de farmacias «sin horario legible» |
| Se ignora una línea del cuadro           | **Probar las fuentes** indica el número de línea y el motivo                                                     |
| Hora de guardia incorrecta               | Compruebe la **zona horaria**                                                                                    |
| «Las fuentes en línea no responden»      | A veces Overpass está saturado: vuelva a intentarlo, o cambie de servidor                                        |
