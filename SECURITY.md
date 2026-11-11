# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique**. Utilise le signalement privé de GitHub (onglet *Security* → *Report a vulnerability*) ou écris à `security@presidentielle-ia.org`.

Nous répondons sous 72 h et publions un correctif dès que possible. Les signalements de bonne foi ne feront l'objet d'aucune poursuite.

## Périmètre

- Le serveur MCP (`/mcp`) public de `presidentielle-ia.org`.
- Le code de ce dépôt et sa chaîne de déploiement (GitHub Actions).

Hors périmètre : attaques par déni de service volumétrique, ingénierie sociale, réponses inexactes d'un assistant IA tiers.

## Conception

- Données publiques en lecture seule : pas de base de données, pas de compte, pas de secret côté serveur, pas de cookie.
- Serveur MCP sans état ; entrées validées et bornées (taille de requête 64 Ko, requêtes de recherche 200 caractères, 50 résultats maximum).
- Dépendances minimales, actions GitHub épinglées par empreinte, mises à jour Dependabot, `pnpm audit` en CI.
