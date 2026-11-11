# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Textes : ceux de data/ (après `pnpm scrape` en local), sinon téléchargés ici.
RUN node scripts/build.mjs --fetch && pnpm build && pnpm prune --prod

FROM node:22-alpine
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
COPY package.json ./
# Fichiers en lecture seule pour l'utilisateur d'exécution (non root).
RUN chmod -R a+rX,go-w /app
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "dist/node.js"]
