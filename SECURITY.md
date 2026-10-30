# Security policy

## Supported versions

Only the latest release of the Pharmacies de garde integration receives
security fixes. Update the integration from the Gladys store before reporting
an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-pharmaciesgarde](https://github.com/prohand/gladys-pharmaciesgarde/security),
then **Report a vulnerability**.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove addresses and coordinates first).

You should get a first answer within 7 days. A fix is released as a new version
of the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes —
including how it handles the house location, the rota files it downloads and
the answers of the Overpass API.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)),
OpenStreetMap and the Overpass servers, and the sites publishing duty rotas.

## What the integration does with your data

- The **house location** is read from Gladys (manifest `"location": true`,
  shown at install time). It is sent to the Overpass API **rounded to about
  100 m**, once per refresh interval, and to no one else.
- The **typed rota** never leaves Gladys.
- The **published rota** URL is downloaded as is (http or https, 15 s timeout,
  2 MB cap); its content is parsed as data, never executed.
- Caches are written to `/data/state.json` only (the rootfs is read-only).

## Good practices for users

- Point the published rota field only to a source you trust.
- Keep Gladys and the integration up to date.
- For a medical emergency, call the emergency services (15 / 112 in France,
  112 in Europe): this integration is a convenience, not a medical service.
