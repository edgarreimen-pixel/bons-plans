// Taxonomie partagée entre le collecteur (classement automatique) et
// l'interface (libellés, icônes). Mots-clés sans accents, en minuscules.
// Pour ajouter une catégorie : ajouter une entrée ici, rien d'autre à faire.

export const TAXONOMY = {
  'high-tech': {
    label: 'High-Tech', icon: '💻',
    subs: {
      smartphones: { label: 'Smartphones', kw: ['smartphone', 'iphone', 'galaxy s', 'galaxy a', 'pixel 8', 'pixel 9', 'pixel 10', 'xiaomi redmi', 'oneplus', 'telephone portable', 'mobile 5g', 'fairphone', 'honor magic', 'motorola edge'] },
      ordinateurs: { label: 'Ordinateurs', kw: ['pc portable', 'ordinateur portable', 'laptop', 'notebook', 'ultrabook', 'chromebook', 'pc fixe', 'pc gamer', 'mini pc', 'ordinateur'] },
      mac: { label: 'Mac', kw: ['macbook', 'imac', 'mac mini', 'mac studio', 'mac pro', 'apple m4', 'apple m5'] },
      tablettes: { label: 'Tablettes', kw: ['tablette', 'ipad', 'galaxy tab', 'liseuse', 'kindle', 'kobo'] },
      composants: { label: 'Composants', kw: ['carte graphique', 'rtx', 'radeon', 'processeur', 'ryzen', 'intel core', 'carte mere', 'ram ddr', 'ddr4', 'ddr5', 'ssd', 'nvme', 'alimentation pc', 'boitier pc', 'ventirad', 'watercooling', 'disque dur', 'hdd'] },
      ecrans: { label: 'Écrans', kw: ['ecran pc', 'moniteur', 'ecran gaming', 'ecran 27', 'ecran 24', 'ecran 32', 'ecran oled', 'ecran incurve'] },
      televisions: { label: 'Télévisions', kw: ['tv ', 'televiseur', 'tv oled', 'tv qled', 'tv led', 'smart tv', 'tv 4k', 'tv 55', 'tv 65', 'tv 75', 'mini led'] },
      videoprojecteurs: { label: 'Vidéoprojecteurs', kw: ['videoprojecteur', 'projecteur', 'vp 4k'] },
      photo: { label: 'Photo & vidéo', kw: ['appareil photo', 'hybride', 'reflex', 'objectif', 'gopro', 'camera sport', 'drone', 'dji', 'canon eos', 'sony alpha', 'nikon z', 'fujifilm'] },
      stockage: { label: 'Stockage', kw: ['cle usb', 'carte sd', 'micro sd', 'disque externe', 'nas', 'ssd externe'] },
      reseau: { label: 'Réseau', kw: ['routeur', 'wifi 6', 'wifi 7', 'mesh', 'repeteur', 'switch reseau', 'cpl'] },
      connectes: { label: 'Objets connectés', kw: ['montre connectee', 'apple watch', 'galaxy watch', 'bracelet connecte', 'domotique', 'ampoule connectee', 'camera de surveillance', 'sonnette connectee', 'thermostat connecte', 'prise connectee', 'airtag'] },
      'telephonie-internet': { label: 'Forfaits & box', kw: ['forfait', 'box internet', 'fibre', 'sim', 'esim', 'forfait mobile'] },
      'logiciels-services': { label: 'Logiciels & services', kw: ['vpn', 'antivirus', 'logiciel', 'licence', 'microsoft 365', 'office 365', 'windows 11', 'cloud', 'stockage en ligne'] },
    },
  },
  gaming: {
    label: 'Gaming', icon: '🎮',
    subs: {
      consoles: { label: 'Consoles', kw: ['ps5', 'playstation 5', 'xbox series', 'nintendo switch', 'switch 2', 'steam deck', 'console', 'rog ally', 'legion go'] },
      'jeux-video': { label: 'Jeux vidéo', kw: ['jeu ps5', 'jeu switch', 'jeu xbox', 'sur ps5', 'sur switch', 'sur xbox', 'edition deluxe', 'goty', 'jeu video'] },
      'jeux-pc': { label: 'Jeux PC', kw: ['steam', 'epic games', 'gog', 'jeu pc', 'dematerialise', 'humble bundle', 'fanatical'] },
      manettes: { label: 'Manettes', kw: ['manette', 'dualsense', 'joy con', 'controller', 'pro controller'] },
      'accessoires-gaming': { label: 'Accessoires', kw: ['casque gaming', 'souris gaming', 'clavier gaming', 'tapis de souris', 'volant', 'siege gaming', 'chaise gaming'] },
      abonnements: { label: 'Abonnements', kw: ['game pass', 'ps plus', 'playstation plus', 'nintendo switch online', 'ea play', 'ubisoft+'] },
    },
  },
  'audio-culture': {
    label: 'Audio & Culture', icon: '🎧',
    subs: {
      casques: { label: 'Casques', kw: ['casque audio', 'casque sans fil', 'casque bluetooth', 'reduction de bruit', 'wh 1000', 'airpods max', 'bose quietcomfort', 'casque'] },
      ecouteurs: { label: 'Écouteurs', kw: ['ecouteurs', 'airpods', 'galaxy buds', 'intra auriculaire', 'true wireless'] },
      enceintes: { label: 'Enceintes', kw: ['enceinte', 'barre de son', 'sonos', 'jbl', 'home cinema', 'ampli', 'hifi'] },
      vinyles: { label: 'Vinyles', kw: ['vinyle', 'vinyl', '33 tours'] },
      platines: { label: 'Platines', kw: ['platine vinyle', 'platine', 'tourne disque'] },
      instruments: { label: 'Instruments', kw: ['guitare', 'piano', 'clavier numerique', 'synthetiseur', 'batterie electronique', 'ukulele', 'micro studio', 'interface audio'] },
      livres: { label: 'Livres', kw: ['livre', 'roman', 'ebook', 'bd ', 'manga', 'bande dessinee', 'audible', 'livre audio'] },
      'films-series': { label: 'Films & séries', kw: ['blu ray', 'dvd', '4k uhd', 'coffret integrale', 'netflix', 'disney+', 'prime video', 'canal+'] },
    },
  },
  maison: {
    label: 'Maison', icon: '🏠',
    subs: {
      electromenager: { label: 'Électroménager', kw: ['lave linge', 'lave vaisselle', 'seche linge', 'refrigerateur', 'frigo', 'congelateur', 'four', 'micro ondes', 'plaque induction', 'hotte', 'aspirateur', 'cafetiere', 'machine a cafe', 'expresso', 'bouilloire', 'friteuse', 'airfryer', 'air fryer', 'grille pain', 'climatiseur', 'radiateur', 'deshumidificateur', 'purificateur', 'fer a repasser', 'centrale vapeur', 'blender', 'extracteur de jus'] },
      'robots-aspirateurs': { label: 'Robots aspirateurs', kw: ['robot aspirateur', 'roborock', 'roomba', 'dreame', 'ecovacs', 'robot laveur'] },
      'robots-cuisine': { label: 'Robots de cuisine', kw: ['robot cuiseur', 'thermomix', 'monsieur cuisine', 'companion', 'cookeo', 'robot patissier', 'kitchenaid', 'robot multifonction'] },
      mobilier: { label: 'Mobilier', kw: ['canape', 'table', 'chaise', 'armoire', 'commode', 'etagere', 'meuble', 'buffet', 'fauteuil', 'lit '] },
      decoration: { label: 'Décoration', kw: ['decoration', 'tableau', 'miroir', 'tapis', 'rideau', 'coussin', 'vase', 'bougie', 'cadre photo'] },
      luminaires: { label: 'Luminaires', kw: ['lampe', 'luminaire', 'suspension', 'applique', 'lampadaire', 'ruban led', 'philips hue'] },
      literie: { label: 'Literie', kw: ['matelas', 'sommier', 'oreiller', 'couette', 'drap', 'parure de lit', 'surmatelas'] },
      'cuisine-table': { label: 'Cuisine & arts de la table', kw: ['poele', 'casserole', 'cocotte', 'couteau', 'vaisselle', 'verre', 'tefal', 'le creuset', 'boite de conservation'] },
      'accessoires-maison': { label: 'Accessoires', kw: ['rangement', 'boite', 'panier', 'linge de maison', 'serviette'] },
    },
  },
  bureau: {
    label: 'Bureau', icon: '🖥️',
    subs: {
      chaises: { label: 'Chaises', kw: ['chaise de bureau', 'fauteuil de bureau', 'chaise ergonomique', 'herman miller', 'siege ergonomique'] },
      bureaux: { label: 'Bureaux', kw: ['bureau assis debout', 'bureau reglable', 'standing desk', 'bureau d angle', 'plateau de bureau'] },
      'ecrans-bureau': { label: 'Écrans', kw: ['ecran bureautique', 'moniteur usb c', 'bras ecran', 'support ecran'] },
      peripheriques: { label: 'Périphériques', kw: ['clavier', 'souris', 'webcam', 'dock', 'station d accueil', 'hub usb', 'imprimante', 'scanner', 'micro usb'] },
      'accessoires-bureau': { label: 'Accessoires', kw: ['fourniture', 'papeterie', 'stylo', 'cahier', 'agenda', 'repose pied', 'lampe de bureau', 'cartouche', 'toner'] },
    },
  },
  mode: {
    label: 'Mode & Beauté', icon: '👗',
    subs: {
      vetements: { label: 'Vêtements', kw: ['t shirt', 'tee shirt', 'chemise', 'pull', 'sweat', 'hoodie', 'jean', 'pantalon', 'robe', 'jupe', 'veste', 'manteau', 'doudoune', 'parka', 'short', 'polo', 'lingerie', 'chaussettes', 'pyjama'] },
      chaussures: { label: 'Chaussures', kw: ['chaussures', 'baskets', 'sneakers', 'bottes', 'bottines', 'sandales', 'mocassins', 'escarpins', 'nike air', 'adidas samba', 'new balance'] },
      sacs: { label: 'Sacs', kw: ['sac a dos', 'sac a main', 'valise', 'bagage', 'sacoche', 'pochette', 'portefeuille', 'cabas'] },
      'accessoires-mode': { label: 'Accessoires', kw: ['montre', 'lunettes', 'bijou', 'collier', 'bracelet', 'bague', 'ceinture', 'echarpe', 'bonnet', 'casquette', 'gants'] },
      beaute: { label: 'Beauté', kw: ['parfum', 'eau de toilette', 'eau de parfum', 'maquillage', 'mascara', 'rouge a levres', 'creme', 'serum', 'soin visage', 'shampoing', 'seche cheveux', 'lisseur', 'boucleur', 'rasoir', 'tondeuse', 'brosse a dents', 'epilateur'] },
    },
  },
  voyages: {
    label: 'Voyages', icon: '✈️',
    subs: {
      avion: { label: "Billets d'avion", kw: ['vol ', 'vols ', 'billet d avion', 'aller retour', 'aller simple', 'ryanair', 'easyjet', 'transavia', 'air france', 'vueling', 'erreur tarifaire', 'flight', 'flights', 'roundtrip', 'round trip', 'one way', 'airfare', 'nonstop', 'non stop', 'business class', 'classe affaires', 'return flights', 'billets d avion'] },
      train: { label: 'Billets de train', kw: ['train', 'tgv', 'ouigo', 'sncf', 'eurostar', 'trenitalia', 'billet de train', 'carte avantage'] },
      hotels: { label: 'Hôtels', kw: ['hotel', 'nuit', 'nuits', 'booking', 'chambre double'] },
      locations: { label: 'Locations', kw: ['location vacances', 'gite', 'airbnb', 'mobil home', 'camping'] },
      sejours: { label: 'Séjours', kw: ['sejour', 'week end', 'escapade', 'thalasso', 'spa '] },
      croisieres: { label: 'Croisières', kw: ['croisiere', 'msc', 'costa', 'ferry'] },
      'tout-compris': { label: 'Tout compris', kw: ['tout compris', 'all inclusive', 'club med', 'vol + hotel', 'vol hotel'] },
      voitures: { label: 'Location de voitures', kw: ['location de voiture', 'location voiture', 'loueur', 'hertz', 'europcar', 'sixt'] },
    },
  },
  loisirs: {
    label: 'Loisirs & Sorties', icon: '🎢',
    subs: {
      parcs: { label: "Parcs d'attractions", kw: ['parc d attractions', 'disneyland', 'parc asterix', 'futuroscope', 'puy du fou', 'walibi', 'europa park', 'zoo', 'aquarium'] },
      cinema: { label: 'Cinéma', kw: ['cinema', 'place de cine', 'ugc', 'pathe', 'cine'] },
      concerts: { label: 'Concerts & spectacles', kw: ['concert', 'festival', 'spectacle', 'billet concert', 'theatre', 'humour'] },
      activites: { label: 'Activités', kw: ['escape game', 'karting', 'bowling', 'laser game', 'saut en parachute', 'atelier', 'cours de', 'experience'] },
      sorties: { label: 'Sorties & restaurants', kw: ['restaurant', 'diner', 'brunch', 'bar ', 'thefork', 'smartbox', 'wonderbox', 'coffret cadeau'] },
    },
  },
  sport: {
    label: 'Sport', icon: '🏃',
    subs: {
      equipements: { label: 'Équipements', kw: ['tapis de course', 'velo d appartement', 'rameur', 'halteres', 'banc de musculation', 'kettlebell', 'trottinette', 'raquette', 'ballon', 'tente', 'sac de couchage', 'ski', 'snowboard', 'kayak', 'paddle'] },
      'vetements-sport': { label: 'Vêtements', kw: ['legging', 'brassiere', 'maillot', 'short de sport', 'running', 'veste de pluie', 'softshell', 'decathlon', 'kalenji', 'quechua'] },
      'accessoires-sport': { label: 'Accessoires', kw: ['montre gps', 'garmin', 'polar', 'coros', 'gourde', 'frontale', 'casque velo', 'compteur'] },
      velo: { label: 'Vélo', kw: ['velo', 'vtt', 'vae', 'velo electrique', 'gravel', 'pneu velo'] },
    },
  },
  alimentation: {
    label: 'Alimentation & Courses', icon: '🛒',
    subs: {
      courses: { label: 'Courses', kw: ['drive', 'supermarche', 'carrefour', 'leclerc', 'auchan', 'intermarche', 'lidl', 'aldi', 'monoprix', 'courses'] },
      boissons: { label: 'Boissons', kw: ['vin', 'champagne', 'biere', 'whisky', 'rhum', 'cafe en grains', 'capsules'] },
      epicerie: { label: 'Épicerie', kw: ['chocolat', 'biscuits', 'pates', 'riz', 'huile d olive', 'conserve', 'cereales'] },
      livraison: { label: 'Livraison de repas', kw: ['uber eats', 'deliveroo', 'just eat', 'livraison de repas'] },
    },
  },
  'bebe-enfant': {
    label: 'Bébé, Enfant & Jouets', icon: '🧸',
    subs: {
      jouets: { label: 'Jouets', kw: ['lego', 'playmobil', 'jouet', 'poupee', 'jeu de societe', 'puzzle', 'peluche', 'hot wheels', 'barbie', 'nerf'] },
      puericulture: { label: 'Puériculture', kw: ['poussette', 'siege auto', 'couches', 'pampers', 'biberon', 'babyphone', 'lit parapluie', 'porte bebe'] },
    },
  },
  animaux: {
    label: 'Animaux', icon: '🐾',
    subs: { 'animaux-tout': { label: 'Animaux', kw: ['croquettes', 'litiere', 'chien', 'chat', 'aquarium poisson', 'arbre a chat', 'friandises'] } },
  },
  'auto-moto': {
    label: 'Auto & Moto', icon: '🚗',
    subs: { 'auto-tout': { label: 'Auto & moto', kw: ['pneu', 'pneus', 'autoradio', 'dashcam', 'gps voiture', 'huile moteur', 'casque moto', 'batterie voiture', 'carburant', 'recharge electrique', 'nettoyeur haute pression'] } },
  },
  'bricolage-jardin': {
    label: 'Bricolage & Jardin', icon: '🛠️',
    subs: {
      bricolage: { label: 'Bricolage', kw: ['perceuse', 'visseuse', 'scie', 'meuleuse', 'ponceuse', 'outillage', 'caisse a outils', 'makita', 'dewalt', 'bosch professional', 'ryobi', 'parkside', 'escabeau'] },
      jardin: { label: 'Jardin', kw: ['tondeuse a gazon', 'robot tondeuse', 'taille haie', 'souffleur', 'barbecue', 'plancha', 'salon de jardin', 'piscine', 'arrosage', 'serre', 'jardin'] },
    },
  },
  'sante-bienetre': {
    label: 'Santé & Bien-être', icon: '🌿',
    subs: { 'sante-tout': { label: 'Santé & bien-être', kw: ['tensiometre', 'thermometre', 'pistolet de massage', 'masseur', 'balance connectee', 'complement alimentaire', 'vitamines', 'proteine', 'whey', 'lunettes de vue', 'lentilles'] } },
  },
  autres: { label: 'Autres', icon: '✨', subs: {} },
};

export const DEAL_TYPES = {
  promo:                    { label: 'Promotion' },
  destockage:               { label: 'Déstockage' },
  liquidation:              { label: 'Liquidation' },
  vente_flash:              { label: 'Vente flash' },
  code_promo:               { label: 'Code promo' },
  gratuit:                  { label: 'Gratuit' },
  vente_privee:             { label: 'Vente privée' },
  offre_lancement:          { label: 'Offre de lancement' },
  saisonnier:               { label: 'Événement saisonnier' },
  cumulable:                { label: 'Cumulable (ODR, cashback…)' },
  exclusif:                 { label: 'Offre exclusive' },
  erreur_prix_signalee:     { label: 'Erreur de prix signalée' },
  // étiquettes calculées par la base, uniquement sur réduction vérifiée :
  exceptionnel:             { label: 'Exceptionnel (vérifié)' },
  erreur_prix_possible:     { label: 'Erreur de prix possible (vérifiée)' },
  plus_bas_constate:        { label: 'Plus bas prix constaté' },
  reduction_non_confirmee:  { label: 'Réduction non confirmée' },
};
