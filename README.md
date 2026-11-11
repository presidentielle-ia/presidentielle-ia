# Présidentielle IA — serveur MCP

Serveur [MCP](https://modelcontextprotocol.io) libre pour interroger les **programmes officiels de la présidentielle 2027** depuis n'importe quel assistant IA : Claude, ChatGPT, Le Chat, Perplexity, Cursor, VS Code…

> Projet citoyen **indépendant**, affilié à aucun parti ni aucune campagne. Service public et tutoriels : **https://presidentielle-ia.org**.

## Neutralité, vérifiable

Ce code est public pour que chacun puisse vérifier que tous les candidats sont traités de la même façon :

- seuls les **programmes officiels** publiés par les candidats sont importés, depuis leurs sites, **sans modification** ;
- les résultats sont **regroupés par candidat**, dans l'**ordre alphabétique**, avec le **même nombre maximum de résultats** pour chacun (`src/core/search.ts`) ;
- le serveur transmet à l'IA des **instructions de neutralité** : aucune consigne de vote, citations exactes avec lien, signalement des programmes absents ou partiels (`src/core/server.ts`) ;
- l'état de chaque programme (disponible, publié mais pas encore intégré, pas encore publié) est dans [`programmes/registry.json`](programmes/registry.json).

## Outils exposés

Tous en lecture seule. Identifiants globaux : `lfi:p3c1s7k1` = programme `lfi`, partie 3, chapitre 1, section 7, mesure clé 1 (`m2` = mesure 2, `m2.1` = sous-mesure).

| Outil | Rôle |
|---|---|
| `lister_programmes` | Candidats suivis et état de leur programme |
| `rechercher` | Recherche plein texte dans tous les programmes (ou certains), regroupée par candidat |
| `comparer` | Mesures de chaque programme côte à côte sur un sujet, programmes absents signalés |
| `table_des_matieres` | Plan d'un programme |
| `lire_section` | Texte intégral d'une section ou d'un chapitre |
| `lire_mesures` | Texte exact de mesures par identifiant |
| `mesures_cles` | Mesures mises en avant par un programme |
| `lire_introduction` | Introduction d'un programme ou d'une partie |
| `search` / `fetch` | Mêmes données au format attendu par ChatGPT |

## Lancer son propre serveur

Ce dépôt **ne contient pas** le texte des programmes (ils appartiennent à leurs auteurs). `pnpm scrape` les télécharge depuis les sites officiels.

> Certains sites officiels bloquent les IP de datacenters : lance `pnpm scrape` depuis ta machine, puis construis ou déploie.

```sh
pnpm install
pnpm scrape                 # → data/*.json + data/bundle.json
```

**Node.js ≥ 20**

```sh
pnpm build
PORT=8787 pnpm start        # HTTP : http://localhost:8787/mcp
pnpm stdio                  # ou en local, en stdio
```

Configuration stdio (Claude Desktop, Cursor…) :

```json
{ "mcpServers": { "presidentielle-ia": { "command": "node", "args": ["/chemin/vers/presidentielle-ia/dist/stdio.js"] } } }
```

**Docker**

```sh
docker build -t presidentielle-ia .
docker run -p 8787:8787 --read-only --cap-drop ALL presidentielle-ia
```

**Cloudflare Workers** (gratuit jusqu'à 100 000 requêtes/jour)

```sh
pnpm exec wrangler login
pnpm run deploy
```

## Contribuer

Le plus utile : **ajouter un programme**. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

```sh
pnpm test        # tests sur un jeu fictif + le texte réel s'il a été téléchargé
pnpm typecheck
```

## Licences

- **Code** : [GNU AGPL v3](LICENSE). Si tu héberges une version modifiée accessible à d'autres, tu dois en publier le code source : c'est ce qui garantit que personne ne peut servir en douce des programmes altérés.
- **Programmes** : propriété de leurs auteurs, non redistribués ici. Avant toute mise en ligne publique, vérifie les conditions de réutilisation de chaque programme.

## Sécurité

Voir [SECURITY.md](SECURITY.md).
