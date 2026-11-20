# Bons Plans — moteur autonome de bonnes affaires

Application web (iPhone, iPad, Mac, PC — sans installation) qui centralise
promotions, déstockages, ventes flash et codes promo, avec **vérification des prix**.

**Fonctionnement 100 % autonome, 0 € par mois** : aucune IA, aucune clé Claude.
Consulter l'application ne consomme aucun crédit.

```
 GitHub Actions (toutes les 2 h)          Supabase (base commune)          Navigateur
 ┌───────────────────────────┐   écrit   ┌────────────────────────┐  lit  ┌──────────────────┐
 │ collector/ : 7 connecteurs├──────────►│ offres, historique prix │◄──────┤ web/ (GitHub     │
 │ normalisation, robots.txt │           │ vérification (SQL)      │       │ Pages)           │
 └────────────▲──────────────┘           │ expiration (pg_cron)    │       └───────┬──────────┘
              │  déclenchement si données > 90 min                 │               │
              └──────────────────────────┤ request_refresh()       │◄──────────────┘
                                         └────────────────────────┘   à l'ouverture
```

## Ce qui est réellement développé

| Élément | Où |
|---|---|
| Connecteurs : Dealabs, hotukdeals, mydealz, Chollometro, Pepper IT, Slickdeals, Secret Flying (voyages), Steam, Epic Games, CheapShark (30+ boutiques de jeux), boutiques Shopify / WooCommerce | `collector/connectors/` |
| Normalisation, dédoublonnage, classement automatique (15 univers, 80 sous-catégories), détection déstockage / flash / code / ODR… | `collector/lib/` |
| Respect de robots.txt, délai entre requêtes, robot identifié | `collector/lib/http.mjs` |
| Vérification des prix (règle des 30 jours), expiration, désactivation | `supabase/migrations/001_schema.sql` |
| Actualisation planifiée + à l'ouverture de l'appli, anti-abus | `.github/workflows/collect.yml`, `002_refresh.sql` |
| Interface Liquid Glass, recherche libre, 16 filtres combinables, fiche détaillée avec historique de prix, favoris, page des sources, hors ligne | `web/` |
| 16 tests automatiques (exécutés avant chaque collecte) | `tests/` |

Voir `SOURCES.md` pour la liste des sources **connectées** et **prévues**.

---

## Mise en ligne pas à pas (≈ 30 minutes, gratuit)

### 1. Supabase (la base de données)
1. Créez un compte sur https://supabase.com puis **New project** (offre Free, région Europe).
2. **SQL Editor → New query** : collez tout `supabase/migrations/001_schema.sql`, **Run**.
3. Nouvelle requête : collez `supabase/migrations/002_refresh.sql`, **Run**.
4. **Project Settings → API** : notez l'**URL**, la clé **anon** (publique) et la clé **service_role** (secrète, jamais dans l'appli).

### 2. GitHub (le moteur et l'hébergement)
1. Créez un compte sur https://github.com puis un dépôt **public** nommé `bonsplans`
   (public = minutes d'automatisation et hébergement Pages illimités et gratuits ; les clés restent secrètes).
2. Envoyez-y le contenu de ce dossier (bouton **Add file → Upload files**, glissez tous les fichiers et dossiers, y compris `.github`).

### 3. Secrets du collecteur
**Settings → Secrets and variables → Actions → New repository secret** :
- `SUPABASE_URL` = l'URL du projet
- `SUPABASE_SERVICE_ROLE_KEY` = la clé service_role

### 4. Variables de l'application
Même page, onglet **Variables → New repository variable** :
- `SUPABASE_URL` = l'URL du projet
- `SUPABASE_ANON_KEY` = la clé anon

### 5. Publication
1. **Settings → Pages → Source : GitHub Actions**.
2. **Actions → Publication de l'application → Run workflow**.
   L'adresse de l'appli s'affiche (`https://votre-compte.github.io/bonsplans/`) : c'est le lien à envoyer à vos proches.

### 6. Première collecte
**Actions → Collecte des offres → Run workflow**. Après 2 à 5 minutes, les offres apparaissent,
puis le moteur tourne seul toutes les 2 heures. L'onglet **Sources** de l'appli montre, pour chaque
source, si elle a réellement fonctionné.

### 7. Actualisation à l'ouverture (recommandé)
1. GitHub → photo de profil → **Settings → Developer settings → Fine-grained tokens → Generate new token** :
   accès au seul dépôt `bonsplans`, permission **Actions : Read and write**, expiration 1 an.
2. Supabase → SQL Editor :
   ```sql
   select vault.create_secret('github_pat_…votre_jeton…', 'github_token');
   select vault.create_secret('votre-compte/bonsplans', 'github_repo');
   ```
Dès qu'un visiteur ouvre l'appli avec des données de plus de 90 minutes, une collecte démarre
(au plus une toutes les 20 minutes, quel que soit le nombre de visiteurs). Supabase relance aussi
la collecte toutes les 3 heures si GitHub a pris du retard, et fait expirer les offres toutes les heures.

---

## Ajouter des sources
- **Une boutique indépendante** : `npm run probe -- www.boutique.fr "Nom" mode` (teste la boutique, vérifie robots.txt et l'ajoute à `config/shops.json`). Ou ajoutez une ligne à la main dans `config/shops.json`.
- **Un flux RSS de bons plans** : une entrée `"kind": "rss"` dans `config/sources.json`.
- **Une nouvelle API** : un fichier dans `collector/connectors/` (modèle : `steam.mjs`) déclaré dans `registry.mjs`.

## Tester sur un ordinateur
```bash
npm install
npm test                 # tests automatiques
npm run collect:dry      # vraie collecte, résultat dans out/dry-run.json, rien n'est écrit en base
```

## Limites connues (honnêtes)
- Les prix **communautaires** (Dealabs…) sont ceux indiqués par les membres ; ils sont étiquetés comme tels.
- Une réduction ne devient **vérifiée** qu'après au moins 7 jours d'historique : les premiers jours, la plupart des remises seront « annoncées ».
- Les grandes enseignes (Fnac, Darty, Cdiscount, Amazon…) n'offrent pas d'accès libre : elles passeront par les réseaux d'affiliation (inscription gratuite, validation requise).
- Les quotas gratuits (Supabase 500 Mo, GitHub Actions) suffisent largement pour plusieurs dizaines de milliers d'offres.

## Évolutions prévues dans l'architecture
Comptes (Supabase Auth, déjà inclus), favoris synchronisés et alertes : il suffira d'ajouter
les tables `profiles`, `favorites`, `alerts` et une étape d'envoi d'e-mails dans le collecteur.
