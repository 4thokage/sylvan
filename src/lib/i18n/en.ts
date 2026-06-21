export const en = {
	nav: {
		wants: 'Wants',
		haves: 'Haves',
		trades: 'Trades',
		tools: 'Tools',
		signIn: 'Sign In',
		signOut: 'Sign Out',
		inbox: 'Inbox'
	},
	wants: {
		title: 'My Wants',
		subtitle: 'Cards you are looking for',
		newWishlist: 'New Wishlist',
		myWishlists: 'My Wishlists',
		noWishlists: 'No wishlists yet',
		created: 'Created',
		cards: 'cards',
		cardPlaceholder: '4 Lightning Bolt (CLB) 785\n4 Counterspell\n2 Sol Ring\n1 Thespian Stage',
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
	haves: {
		title: 'My Haves',
		subtitle: 'Cards you own',
		unique: 'unique',
		total: 'total',
		game: 'Game',
		addCards: 'Add cards',
		add: 'Add',
		export: 'Export',
		save: 'Save',
		saving: 'Saving...',
		clear: 'Clear',
		empty: 'Your haves are empty',
		signInRequired: 'Sign in to manage your haves',
		signInDescription: 'You need to be signed in to import and manage your cards.',
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
	tools: {
		title: 'Tools',
		subtitle: 'Utilities for traders',
		scan: {
			title: 'Card Scanner',
			description: 'Scan cards with your camera'
		},
		value: {
			title: 'Collection Value',
			description: 'Calculate total value of your collection',
			inputLabel: 'Paste your collection',
			totalValue: 'Total Value',
			byGame: 'By Game',
			topCards: 'Top 10 Cards',
			noPrices: 'No price data available'
		},
		fairness: {
			title: 'Trade Fairness',
			description: 'Compare two sides of a trade',
			sideA: 'Side A',
			sideB: 'Side B',
			totalA: 'Total A',
			totalB: 'Total B',
			difference: 'Difference',
			fairnessScore: 'Fairness Score',
			balanced: 'Balanced',
			favorsA: 'Favors Side A',
			favorsB: 'Favors Side B'
		},
		life: {
			title: 'Life Counter',
			description: 'Fast life counter for MTG',
			player1: 'Player 1',
			player2: 'Player 2',
			reset: 'Reset',
			startingLife: 'Starting Life'
		}
	},
	inbox: {
		title: 'Inbox',
		unread: 'unread',
		refresh: 'Refresh',
		notifications: 'Notifications',
		messages: 'Messages'
	},
	notifications: {
		markAllRead: 'Mark all read',
		empty: 'No notifications yet'
	},
	messages: {
		empty: 'No messages yet',
		you: 'You',
		viewTrade: 'View trade'
	},
	profile: {
		bio: 'Bio',
		location: 'Location',
		country: 'Country',
		save: 'Save',
		saving: 'Saving...',
		updated: 'Profile updated!',
		bioPlaceholder: 'Tell other traders about yourself...',
		locationPlaceholder: 'Helps find local trade partners'
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
