# Pharmacies de garde

Cette intégration indique à Gladys **quelle pharmacie est de garde**, et
**quelles pharmacies sont ouvertes** autour de la maison. Elle alimente un
appareil, un widget du tableau de bord, des déclencheurs et des actions de
scène.

## Avant de commencer

- Il faut **Gladys 5.3 ou plus récent**.
- La **position de la maison** doit être renseignée dans Gladys
  (**Paramètres → Maisons**). L'intégration la lit : Gladys vous demande
  l'autorisation à l'installation.

> Il n'existe pas de flux national des pharmacies de garde. La nuit, en France,
> la référence reste le **3237** (ou [3237.fr](https://www.3237.fr/)). Cette
> intégration vous aide au quotidien, elle ne remplace pas le service officiel.

## Les sources

Utilisez-en une, ou plusieurs. Le badge de l'appareil montre d'où vient la
réponse : **local** ou **cloud**.

| Source                                  | Transport | Ce qu'elle donne                                                       |
| --------------------------------------- | --------- | ---------------------------------------------------------------------- |
| **Tableau de garde** (saisi)            | local     | La pharmacie de garde, selon le tableau de votre secteur               |
| **Tableau de garde en ligne** (une URL) | cloud     | Pareil, depuis un fichier publié (open data, site de la mairie…)       |
| **OpenStreetMap**                       | cloud     | Les pharmacies autour de la maison, avec leurs horaires (ouvert/fermé) |

Ordre de choix de la pharmacie conseillée :

1. une garde trouvée dans un tableau. Si les deux tableaux en donnent une,
   l'interrupteur Gladys **« Préférer la connexion locale »** choisit : activé
   (par défaut) = tableau saisi, désactivé = tableau en ligne ;
2. sinon, la pharmacie **ouverte** la plus proche selon OpenStreetMap. Le badge
   passe en **dégradé** (point orange) : elle est ouverte, pas forcément de
   garde.

### Tableau de garde (local)

Le tableau est publié par le syndicat des pharmaciens de votre secteur, souvent
relayé par la mairie, le journal local ou les pharmacies. Recopiez-le dans le
champ **Tableau de garde (local)** : rien ne sort de Gladys.

Une garde par ligne (ou séparées par `|`, le champ tenant sur une ligne),
champs séparés par `;` :

```
date [> fin] ; nom ; adresse ; téléphone
```

Exemples :

```
2026-11-01 ; Pharmacie du Centre ; 12 rue de la Paix, Lyon ; 04 78 00 00 01
2026-11-07 19:00 > 2026-11-14 09:00 ; Pharmacie des Halles ; 3 place des Halles ; 04 78 00 00 02
15/11/2026 9h00 ; Pharmacie du Pont
# une ligne qui commence par # est un commentaire
```

- une **date seule** = toute la journée (de minuit à minuit) ;
- une **heure de début sans fin** = 24 heures ;
- une **date de fin sans heure** = jusqu'à la fin de ce jour ;
- l'adresse et le téléphone sont facultatifs. Si le nom correspond à une
  pharmacie d'OpenStreetMap, l'intégration complète la position et le
  téléphone ;
- les heures se lisent dans le **fuseau horaire** de la configuration.

Le **JSON** est aussi accepté : une liste d'objets
`{ "start", "end", "name", "address", "phone", "latitude", "longitude" }`
(ou `date` pour une journée). Les clés françaises `debut`, `fin`, `nom`,
`adresse`, `telephone` sont lues aussi, et une liste peut être rangée sous
`entries`, `records` ou `results` (format Opendatasoft compris).

### Tableau de garde en ligne (cloud)

Mettez l'adresse d'un fichier au même format (texte ou JSON) dans **Tableau de
garde en ligne**. Il est relu à chaque **intervalle d'actualisation**. Si le
serveur ne répond pas, la dernière copie lue est gardée.

### OpenStreetMap (cloud)

Activé par défaut. Une fois par jour (réglable), l'intégration demande à
l'API publique Overpass les pharmacies dans le **rayon de recherche**. Ensuite
tout se calcule chaque minute sur Gladys, sans appel réseau.

Les horaires d'ouverture sont lus quand ils sont simples
(`Mo-Fr 08:30-19:30; Sa 09:00-12:00`, `24/7`, ouverture après minuit). Les
horaires plus complexes (mois, jours fériés…) sont marqués **inconnus** : la
pharmacie est listée mais jamais annoncée ouverte. Les jours fériés ne sont pas
connus : ce jour-là, l'horaire de la semaine est une estimation.

Une pharmacie mal renseignée ? Corrigez-la sur
[openstreetmap.org](https://www.openstreetmap.org) : tout le monde en profite.

## Configuration

| Champ                              | Rôle                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------- |
| **Maison**                         | La maison autour de laquelle chercher. Vide : la première avec position   |
| **Latitude / Longitude**           | Facultatif : chercher ailleurs (résidence secondaire…). Les deux, ou rien |
| **Rayon de recherche (km)**        | 1 à 30 km, 5 par défaut                                                   |
| **Pharmacies ouvertes (OSM)**      | Active la source OpenStreetMap                                            |
| **Tableau de garde (local)**       | Le tableau saisi (voir plus haut)                                         |
| **Tableau de garde en ligne**      | L'URL d'un tableau publié                                                 |
| **Pays**                           | Le service officiel lié au widget : 3237 (France), aponet (Allemagne)     |
| **Fuseau horaire**                 | Nom IANA, `Europe/Paris` par défaut                                       |
| **Intervalle d'actualisation (h)** | Relecture d'OSM et du tableau en ligne, 24 h par défaut                   |
| **Alerte fin de tableau (jours)**  | Délai du déclencheur « Tableau de garde bientôt terminé ». 0 = désactivé  |
| **Serveur Overpass (avancé)**      | Un autre serveur Overpass. Vide = `overpass-api.de`                       |

Deux boutons :

- **Tester les sources** : relit tout et affiche la position, les gardes lues
  (et les lignes illisibles, avec leur numéro), l'état d'OpenStreetMap et la
  réponse du moment ;
- **Voir les prochaines gardes** : la liste des gardes des N prochains jours,
  pour vérifier que le tableau est bien lu.

## L'appareil « Pharmacie de garde »

Dans **Intégrations → Pharmacies de garde → Découverte**, créez l'appareil. Ses
fonctionnalités :

| Fonctionnalité                   | Contenu                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| Pharmacie                        | Nom de la pharmacie conseillée (`-` si aucune)                |
| Adresse, Téléphone               | Ses coordonnées                                               |
| Source                           | `rota`, `published rota` ou `open now (OpenStreetMap)`        |
| Distance                         | Distance à vol d'oiseau, en km                                |
| Ouverte la plus proche, Distance | La pharmacie ouverte la plus proche, quel que soit le tableau |

## Le widget « Pharmacies »

Ajoutez-le au tableau de bord. Il montre la pharmacie conseillée (nom, source,
jusqu'à quand, téléphone), le nombre de pharmacies ouvertes, la distance, la
liste des pharmacies (avec adresse, horaires et lien carte) et les jours
restants du tableau. Boutons : **Actualiser**, **Voir sur la carte**, et le
**service officiel** du pays.

Réglage : **Pharmacies listées** (0 à 8).

## Scènes

### Déclencheurs

| Déclencheur                          | Quand                                                                    | Variables                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **La pharmacie de garde a changé**   | Nouvelle garde, ou (sans tableau) autre pharmacie ouverte la plus proche | `name`, `address`, `phone`, `distance_km`, `until`, `map_url` |
| **Aucune pharmacie disponible**      | Ni garde ni pharmacie ouverte autour de la maison                        | —                                                             |
| **Tableau de garde bientôt terminé** | Le tableau finit dans moins de N jours (une fois par jour)               | `days_left`, `last_day`                                       |

Le premier peut être filtré par **source** (tableau saisi, en ligne, ou
OpenStreetMap).

Exemple : _« Le samedi à 18 h, envoie-moi la pharmacie de garde du week-end »_,
ou _« Quand la pharmacie de garde change, envoie
`{{triggerEvent.data.name}} — {{triggerEvent.data.phone}}` »_.

### Actions

| Action                            | Champs                                                                      | Sorties                                                                          |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Trouver la pharmacie de garde** | Quand : maintenant, ce soir (21 h), demain (10 h), dimanche prochain (10 h) | `found`, `name`, `address`, `phone`, `distance_km`, `until`, `source`, `map_url` |
| **Actualiser les pharmacies**     | —                                                                           | `found`, `open_count`                                                            |

## Vie privée

- Le tableau saisi ne quitte jamais Gladys.
- OpenStreetMap (Overpass) reçoit la position de la maison **arrondie à
  environ 100 m**, une fois par intervalle d'actualisation. Les distances sont
  calculées sur Gladys, avec la position exacte.
- Le tableau en ligne est un simple téléchargement de l'URL que vous donnez.
- Les données en cache sont dans `/data/state.json`, dans le conteneur.

## Dépannage

| Symptôme                                    | Que faire                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| « Ni position de la maison ni tableau »     | Renseignez la position de la maison dans Gladys, ou les coordonnées                                        |
| Aucune pharmacie ouverte alors qu'il y en a | Horaires absents ou complexes dans OSM : **Tester les sources** donne le nombre « sans horaires lisibles » |
| Une ligne du tableau est ignorée            | **Tester les sources** donne le numéro de ligne et la raison                                               |
| Mauvaise heure de garde                     | Vérifiez le **fuseau horaire**                                                                             |
| « Les sources en ligne ne répondent pas »   | Overpass est parfois surchargé : réessayez, ou changez de serveur                                          |
