# Contribuer

## Ajouter un programme

Seuls les **programmes officiels** publiés par un candidat ou son parti sont acceptés (pas de résumés de presse, pas de sites tiers).

1. **Registre** : ajoute le candidat dans `programmes/registry.json` (ordre indifférent, le tri est alphabétique), avec `statut: "publie"`, `etendue` (`complet` ou `partiel`), l'URL officielle dans `source` et les conditions de réutilisation dans `licence` (cite les mentions légales du site).
2. **Import** : écris `scripts/sources/<id>.mjs`, qui produit `data/<id>.json` au format commun (parties → chapitres → sections → mesures ; voir `src/core/data.ts` et les sources existantes). Utilise `scripts/sources/common.mjs` : cache disque, 1 requête par seconde, contrôle du nombre de mesures. Préfère les formats structurés publiés par les campagnes (JSON, RSS, llms.txt) au découpage de HTML.
3. **Fidélité** : texte reproduit **mot pour mot**, sans reformulation ni sélection. Chaque mesure doit pointer vers sa page officielle quand elle existe.
4. Passe le statut à `"integre"`, puis `pnpm scrape && pnpm test`.

Dans la description de la pull request : le nombre de mesures obtenu et la façon dont tu l'as vérifié par rapport au site officiel.

## Règles de neutralité

Toute modification qui traiterait un programme différemment des autres (classement, poids dans la recherche, formulation des instructions) sera refusée. Les instructions données aux IA sont dans `src/core/server.ts` : toute modification doit rester applicable à l'identique à tous les candidats.

## Signaler une erreur dans un texte

Ouvre une issue avec l'identifiant de la mesure (ex. `lfi:p3c1s7k1`) et le lien vers la page officielle.
