export interface Translation {
  readonly landing: {
    readonly eyebrow: string;
    readonly headline: string;
    readonly lede: string;
    readonly cta: string;
    readonly note: string;
    readonly statusLabel: string;
    readonly statusValue: string;
    readonly whitelistLabel: string;
    readonly whitelistValue: string;
    readonly nextStepLabel: string;
    readonly nextStepValue: string;
  };
  readonly workspace: {
    readonly scanner: string;
    readonly unfollowQueue: string;
    readonly filter: string;
    readonly nonFollowers: string;
    readonly followers: string;
    readonly verified: string;
    readonly privateAccounts: string;
    readonly noPic: string;
    readonly clear: string;
    readonly displayed: string;
    readonly totalScanned: string;
    readonly whitelisted: string;
    readonly scanSummary: string;
    readonly pause: string;
    readonly resume: string;
    readonly unfollow: string;
    readonly nonWhitelistedTab: string;
    readonly whitelistedTab: string;
    readonly succeeded: string;
    readonly failed: string;
    readonly allDone: string;
  };
  readonly states: {
    readonly noMatches: string;
    readonly noMatchesDescription: string;
    readonly emptyWhitelist: string;
    readonly emptyWhitelistDescription: string;
    readonly queueStarting: string;
    readonly queueStartingDescription: string;
  };
  readonly toolbar: {
    readonly searchPlaceholder: string;
    readonly copy: string;
    readonly exportJson: string;
    readonly exportCsv: string;
    readonly page: string;
    readonly all: string;
    readonly settings: string;
    readonly toggleTheme: string;
    readonly language: string;
  };
}

export const en: Translation = {
  landing: {
    eyebrow: 'Local account audit',
    headline: 'Find the follows that do not follow back.',
    lede:
      'Scan your Instagram follows, surface risk signals, protect whitelisted accounts, and act only on the users you select. Everything runs in this browser session.',
    cta: 'Run scan',
    note: 'No servers · no auth · no exfiltration',
    statusLabel: 'Status',
    statusValue: 'Idle',
    whitelistLabel: 'Whitelist',
    whitelistValue: 'Protected',
    nextStepLabel: 'Next step',
    nextStepValue: 'Run scan',
  },
  workspace: {
    scanner: 'Scanner',
    unfollowQueue: 'Unfollow queue',
    filter: 'Filter',
    nonFollowers: 'Non-Followers',
    followers: 'Followers',
    verified: 'Verified',
    privateAccounts: 'Private',
    noPic: 'No Pic',
    clear: 'Clear',
    displayed: 'Displayed',
    totalScanned: 'Total scanned',
    whitelisted: 'Whitelisted',
    scanSummary: 'Scan summary',
    pause: 'Pause',
    resume: 'Resume',
    unfollow: 'Unfollow',
    nonWhitelistedTab: 'Non-Whitelisted',
    whitelistedTab: 'Whitelisted',
    succeeded: 'Succeeded',
    failed: 'Failed',
    allDone: 'All done',
  },
  states: {
    noMatches: 'No matching accounts',
    noMatchesDescription:
      'Try widening your filters or clearing the search bar — the current set excludes every scanned account.',
    emptyWhitelist: 'Whitelist is empty',
    emptyWhitelistDescription:
      'Click an avatar in the Non-Whitelisted tab to protect that account from being unfollowed.',
    queueStarting: 'Queue starting',
    queueStartingDescription:
      'Waiting for the first unfollow to land. Entries will stream in here as each request completes.',
  },
  toolbar: {
    searchPlaceholder: 'Search users',
    copy: 'Copy',
    exportJson: 'JSON',
    exportCsv: 'CSV',
    page: 'Page',
    all: 'All',
    settings: 'Settings',
    toggleTheme: 'Toggle theme',
    language: 'Language',
  },
};

export const fr: Translation = {
  landing: {
    eyebrow: 'Audit local de compte',
    headline: 'Trouve les abonnements qui ne te suivent pas en retour.',
    lede:
      'Scanne tes abonnements Instagram, repere les signaux a risque, protege ta liste blanche, et n’agit que sur les comptes selectionnes. Tout s’execute dans cette session navigateur.',
    cta: 'Lancer le scan',
    note: 'Sans serveurs · sans auth · sans exfiltration',
    statusLabel: 'Statut',
    statusValue: 'Au repos',
    whitelistLabel: 'Liste blanche',
    whitelistValue: 'Protegee',
    nextStepLabel: 'Prochaine etape',
    nextStepValue: 'Lancer le scan',
  },
  workspace: {
    scanner: 'Scanner',
    unfollowQueue: 'File d’unfollow',
    filter: 'Filtre',
    nonFollowers: 'Non-abonnes',
    followers: 'Abonnes',
    verified: 'Verifies',
    privateAccounts: 'Prives',
    noPic: 'Sans photo',
    clear: 'Vider',
    displayed: 'Affiches',
    totalScanned: 'Total scanne',
    whitelisted: 'En liste blanche',
    scanSummary: 'Resume du scan',
    pause: 'Pause',
    resume: 'Reprendre',
    unfollow: 'Se desabonner',
    nonWhitelistedTab: 'Hors liste blanche',
    whitelistedTab: 'En liste blanche',
    succeeded: 'Reussis',
    failed: 'Echoues',
    allDone: 'Termine',
  },
  states: {
    noMatches: 'Aucun compte correspondant',
    noMatchesDescription:
      'Elargis les filtres ou vide la recherche — la combinaison actuelle exclut chaque compte scanne.',
    emptyWhitelist: 'Liste blanche vide',
    emptyWhitelistDescription:
      'Clique sur un avatar dans l’onglet Hors liste blanche pour proteger ce compte d’un futur unfollow.',
    queueStarting: 'File en demarrage',
    queueStartingDescription:
      'En attente du premier unfollow. Les entrees apparaitront ici a chaque requete completee.',
  },
  toolbar: {
    searchPlaceholder: 'Rechercher des comptes',
    copy: 'Copier',
    exportJson: 'JSON',
    exportCsv: 'CSV',
    page: 'Page',
    all: 'Tout',
    settings: 'Reglages',
    toggleTheme: 'Theme',
    language: 'Langue',
  },
};

export const dictionaries = { en, fr } as const;

export type Locale = keyof typeof dictionaries;
