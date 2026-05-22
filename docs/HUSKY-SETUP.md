# Husky Setup — Étape manuelle finale

> **Couche 1 industrialisation qualité KOVAS** — les hooks Git `.husky/*` sont bloqués par sandbox d'écriture. À appliquer manuellement après merge de la PR Couche 1.

## Contexte

Husky `v9.1.7` + lint-staged `v17` sont installés en `devDependencies` racine. Le script `prepare: "husky"` est ajouté dans `package.json`. Mais les fichiers hooks (`pre-commit`, `pre-push`) doivent être créés à la main une fois — le sandbox de l'agent ne peut pas écrire dans `.husky/`.

## Étapes à exécuter localement

```bash
# 1. Installer les hooks (créera .husky/_)
pnpm install

# 2. Écraser .husky/pre-commit (créé par défaut par `husky init` avec `pnpm test`)
cat > .husky/pre-commit <<'EOF'
#!/usr/bin/env sh
pnpm lint-staged
EOF

# 3. Créer .husky/pre-push
cat > .husky/pre-push <<'EOF'
#!/usr/bin/env sh
pnpm --filter @kovas/web typecheck
EOF

# 4. Rendre exécutables
chmod +x .husky/pre-commit .husky/pre-push

# 5. Test
git add .
git commit -m "test husky" --allow-empty
# → doit lancer biome check --write sur staged files via lint-staged
```

## Validation

```bash
# Lint-staged doit s'exécuter au commit
echo "// test" >> apps/web/src/app/layout.tsx
git add apps/web/src/app/layout.tsx
git commit -m "test"
# → output : "✔ Running tasks for staged files..."
# → biome check applique les fixes auto
```

## Comportement attendu

| Hook | Quand | Action | Bloque commit/push si... |
|---|---|---|---|
| `pre-commit` | `git commit` | `pnpm lint-staged` → biome check + format sur staged | Biome retourne EXIT != 0 |
| `pre-push` | `git push` | `pnpm --filter @kovas/web typecheck` | TSC retourne EXIT != 0 |

## Bypass d'urgence

```bash
git commit --no-verify -m "..."  # skip pre-commit
git push --no-verify             # skip pre-push
```

**À utiliser uniquement** pour hotfix prod, avec post-mortem obligatoire.
