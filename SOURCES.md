# Registre des sources

Généré depuis `config/sources.json` et `config/shops.json`.

**Connectée** = connecteur écrit, testé sur le format documenté de la source, et activé. La preuve qu’elle fonctionne réellement est mesurée à chaque passage et affichée dans l’onglet *Sources* de l’application (dernière réussite, nombre d’offres, erreur éventuelle).

**Prévue** = référencée, **aucune donnée collectée**.

## Connectée

| Source | Pays | Description |
|---|---|---|
| Dealabs | FR | Communauté française de bons plans : offres signalées et votées par les membres (prix communautaires, non vérifiés). |
| hotukdeals | GB | Communauté britannique de bons plans (réseau Pepper). |
| mydealz | DE | Communauté allemande de bons plans (réseau Pepper). |
| Chollometro | ES | Communauté espagnole de bons plans (réseau Pepper). |
| Pepper Italia | IT | Communauté italienne de bons plans (réseau Pepper). |
| Slickdeals | US | Première communauté américaine de bons plans (pages Frontpage et Popular). |
| Secret Flying | INT | Alertes de billets d'avion à prix cassés et erreurs tarifaires signalées. |
| Steam | FR | Promotions de la vitrine Steam (prix officiels du marchand, en euros). |
| Epic Games Store | FR | Jeux offerts et remisés de la semaine (prix et dates officiels). |
| CheapShark (30+ boutiques de jeux PC) | INT | API publique gratuite suivant les prix de Steam, GOG, Humble, Fanatical, GamesPlanet… (prix en dollars). |

## Prévue — clé/compte requis

| Source | Pays | Description |
|---|---|---|
| eBay (API Browse) | FR | API officielle gratuite après inscription développeur. Connecteur à écrire. |
| IsThereAnyDeal | INT | Historique des prix de jeux (vérification). Clé gratuite. Connecteur à écrire. |
| Ticketmaster (Discovery API) | FR | Concerts et spectacles. Clé gratuite. Connecteur à écrire. |
| Amadeus (vols) | INT | Recherche de vols, quota gratuit. Connecteur à écrire. |
| Awin (flux d'affiliation) | FR | Accès aux flux produits/promos de milliers d'enseignes (Fnac, Darty, Boulanger, Sephora…) après validation du compte éditeur. |
| Effiliation | FR | Réseau d'affiliation français : flux promotions et codes. Compte éditeur requis. |
| Kelkoo Group | FR | Flux de comparateur de prix. Compte partenaire requis. |
| Rakuten Advertising | INT | Flux d'affiliation internationaux. Compte éditeur requis. |
| Tradedoubler | FR | Flux produits et vouchers. Compte éditeur requis. |
| Amazon (Product Advertising API) | FR | Réservé aux partenaires Amazon validés (ventes requises). Pas de collecte directe du site (conditions d'utilisation). |
| AliExpress (Affiliate API) | INT | API d'affiliation, compte requis. |
| Booking.com | INT | Programme partenaire requis. |

## Prévue

| Source | Pays | Description |
|---|---|---|
| Fnac / Darty | FR | Pas d'API publique : intégration prévue via flux d'affiliation (Awin). |
| Cdiscount | FR | Intégration prévue via programme d'affiliation. |
| Boulanger | FR | Intégration prévue via flux d'affiliation. |
| Back Market | FR | Reconditionné. Intégration prévue via affiliation. |
| Veepee | FR | Ventes privées réservées aux membres : pas de collecte automatisée possible sans accord. |
| Showroomprivé | FR | Ventes privées réservées aux membres : pas de collecte sans accord. |
| Decathlon | FR | Intégration prévue via affiliation. |
| Zalando | FR | Intégration prévue via affiliation. |
| Sephora | FR | Intégration prévue via affiliation. |
| ManoMano | FR | Intégration prévue via affiliation. |
| IKEA | FR | Pas d'API publique de promotions. |
| SNCF Connect / Ouigo | FR | Pas d'API tarifaire publique ; promotions déjà relayées par Dealabs. |
| Ryanair / easyJet / Transavia | INT | Collecte directe interdite par leurs conditions ; couvert indirectement par Secret Flying et Dealabs. |
| Parcs d'attractions (Disneyland, Astérix…) | FR | Promotions relayées par Dealabs ; intégration directe via affiliation à étudier. |
| Groupon | FR | Intégration prévue via affiliation. |

## Boutiques indépendantes connectées (Shopify / WooCommerce)

La plateforme est détectée à chaque passage. Une boutique qui n’expose pas de catalogue public ou dont le robots.txt l’interdit apparaît **en échec** et ne produit aucune offre.

| Boutique | Domaine | Pays |
|---|---|---|
| Asphalte | www.asphalte.com | FR |
| Hopaal | www.hopaal.com | FR |
| Horace | www.horace.co | FR |
| Merci Handy | www.merci-handy.com | FR |
| Respire | www.respire.co | FR |
| Cabaïa | www.cabaia.com | FR |
| Allbirds | www.allbirds.com | US |
| Bombas | www.bombas.com | US |
| Kith | kith.com | US |
| ColourPop | colourpop.com | US |
