export const en = {
  nav: {
    create: 'Create',
    scan: 'Scan',
    collection: 'Collection',
    trades: 'Trades',
    profile: 'Profile',
    notifications: 'Notifications',
    messages: 'Messages',
    signIn: 'Sign In',
    signOut: 'Sign Out'
  },
  home: {
    title: 'Card Wishlist Creator',
    subtitle: 'Add cards to find trade partners',
    cardPlaceholder: '4 Lightning Bolt\n4 Counterspell\n2 Sol Ring',
    gameLabel: 'Game',
    save: 'Save Wishlist',
    saving: 'Saving...',
    yourName: 'Your name (optional)',
    saved: 'Wishlist Saved!',
    shareLink: 'Share this link with friends',
    copy: 'Copy',
    createAnother: 'Create another wishlist',
    pasteList: 'Paste your card list',
    uniqueCards: 'unique cards',
    total: 'total',
    preview: 'Preview',
    livePreview: 'Live preview',
    fetching: 'Fetching card data...',
    imagesUnavailable: 'Card images may not be available, but you can still save your wishlist.',
    typeToPreview: 'Cards will appear here as you type'
  },
  collection: {
    title: 'My Collection',
    unique: 'unique',
    total: 'total',
    game: 'Game',
    addCards: 'Add cards',
    import: 'Import',
    export: 'Export',
    save: 'Save',
    saving: 'Saving...',
    clear: 'Clear',
    empty: 'Your collection is empty',
    signInRequired: 'Sign in to manage your collection',
    signInDescription: 'You need to be signed in to import and manage your card collection.',
    importFormat: {
      text: 'Plain Text',
      csv: 'CSV',
      deckbox: 'Deckbox'
    },
    help: {
      text: 'One card per line: "4 Lightning Bolt"',
      csv: 'name,quantity per line',
      deckbox: 'Tab-separated export from Deckbox.org'
    }
  },
  trades: {
    title: 'Trades',
    suggestions: 'Suggestions',
    myTrades: 'My Trades',
    refresh: 'Refresh',
    noMatches: 'No trade matches found yet. Create a wishlist to get started!',
    noActiveTrades: 'No active trades yet. Start by finding a match above!',
    accept: 'Accept',
    reject: 'Reject',
    cancel: 'Cancel',
    message: 'Message',
    viewWishlist: 'View wishlist',
    match: 'Match',
    theyWant: 'They want:',
    tradeWith: 'Trade with',
    created: 'Created',
    note: 'Note',
    findUsers: 'Find users who want cards from your collection',
    yourProposals: 'Your active trade proposals',
    createWishlist: 'Create a wishlist to see trade suggestions!',
    wishlistOf: "'s Wishlist"
  },
  profile: {
    title: 'Profile',
    displayName: 'Display Name',
    username: 'Username',
    bio: 'Bio',
    location: 'Location',
    save: 'Save',
    saving: 'Saving...',
    publicProfile: 'Public Profile',
    publicDescription: 'Allow others to view your profile and collection'
  },
  notifications: {
    title: 'Notifications',
    unread: 'unread',
    markAllRead: 'Mark all read',
    empty: 'No notifications yet'
  },
  messages: {
    title: 'Messages',
    refresh: 'Refresh',
    empty: 'No messages yet',
    you: 'You',
    viewTrade: 'View trade'
  },
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    success: 'Success',
    close: 'Close',
    back: 'Back',
    confirm: 'Confirm',
    cancel: 'Cancel'
  }
};

export type Translations = typeof en;
