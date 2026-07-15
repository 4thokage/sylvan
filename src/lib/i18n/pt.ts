import type { Translations } from './en';

export const pt: Translations = {
	nav: {
		wants: 'Quer',
		haves: 'Tem',
		trades: 'Trocas',
		tools: 'Ferramentas',
		signIn: 'Entrar',
		signOut: 'Sair',
		inbox: 'Caixa de Entrada'
	},
	wants: {
		title: 'Meus Quer',
		subtitle: 'Cartas que você procura',
		newWishlist: 'Nova Lista',
		myWishlists: 'Minhas Listas',
		noWishlists: 'Nenhuma lista ainda',
		created: 'Criada',
		cards: 'cartas',
		cardPlaceholder: '4 Lightning Bolt (CLB) 785\n4 Counterspell\n2 Sol Ring\n1 Thespian Stage',
		gameLabel: 'Jogo',
		save: 'Salvar Lista',
		saving: 'Salvando...',
		saved: 'Lista Salva!',
		shareLink: 'Compartilhe este link com amigos',
		copy: 'Copiar',
		createAnother: 'Criar outra lista',
		pasteList: 'Cole sua lista de cartas',
		uniqueCards: 'cartas únicas',
		total: 'total',
		preview: 'Visualizar',
		livePreview: 'Visualização ao vivo',
		fetching: 'Buscando dados das cartas...',
		imagesUnavailable: 'Imagens podem não estar disponíveis, mas você ainda pode salvar sua lista.',
		typeToPreview: 'Cartas aparecerão aqui enquanto você digita'
	},
	haves: {
		title: 'Meus Tem',
		subtitle: 'Cartas que você possui',
		unique: 'únicas',
		total: 'total',
		game: 'Jogo',
		addCards: 'Adicionar cartas',
		add: 'Adicionar',
		export: 'Exportar',
		save: 'Salvar',
		saving: 'Salvando...',
		clear: 'Limpar',
		empty: 'Sua coleção está vazia',
		signInRequired: 'Entre para gerenciar seus tem',
		signInDescription: 'Você precisa estar logado para importar e gerenciar suas cartas.',
		importFormat: {
			text: 'Texto Simples',
			csv: 'CSV',
			deckbox: 'Deckbox'
		},
		help: {
			text: 'Uma carta por linha: "4 Lightning Bolt"',
			csv: 'nome,quantidade por linha',
			deckbox: 'Exportação separada por tabulação do Deckbox.org'
		}
	},
	trades: {
		title: 'Trocas',
		suggestions: 'Sugestões',
		myTrades: 'Minhas Trocas',
		refresh: 'Atualizar',
		noMatches: 'Nenhuma troca encontrada ainda. Crie uma lista de desejos!',
		noActiveTrades: 'Nenhuma troca ativa. Encontre uma correspondência acima!',
		accept: 'Aceitar',
		reject: 'Recusar',
		cancel: 'Cancelar',
		message: 'Mensagem',
		viewWishlist: 'Ver lista',
		match: 'Correspondência',
		theyWant: 'Eles querem:',
		tradeWith: 'Troca com',
		created: 'Criada',
		note: 'Nota',
		findUsers: 'Encontre usuários que querem cartas da sua coleção',
		yourProposals: 'Suas propostas de troca ativas',
		createWishlist: 'Crie uma lista de desejos para ver sugestões de troca!',
		wishlistOf: ' Lista de Desejos',
		propose: 'Propor troca',
		anonymousOwner: 'Listas anônimas não podem receber propostas de troca.'
	},
	tools: {
		title: 'Ferramentas',
		subtitle: 'Utilitários para trocadores',
		value: {
			title: 'Valor da Coleção',
			description: 'Calcule o valor total da sua coleção',
			inputLabel: 'Cole sua coleção',
			totalValue: 'Valor Total',
			byGame: 'Por Jogo',
			topCards: 'Top 10 Cartas',
			noPrices: 'Sem dados de preço disponíveis',
			useMyHaves: 'Valorar meus tem',
			valueCustomList: 'Valorar lista personalizada',
			noHaves: 'Você ainda não tem tem. Cole uma coleção abaixo para estimar seu valor.'
		},
		fairness: {
			title: 'Justiça da Troca',
			description: 'Compare os dois lados de uma troca',
			sideA: 'Lado A',
			sideB: 'Lado B',
			totalA: 'Total A',
			totalB: 'Total B',
			difference: 'Diferença',
			fairnessScore: 'Pontuação de Justiça',
			balanced: 'Equilibrado',
			favorsA: 'Favorece Lado A',
			favorsB: 'Favorece Lado B'
		}
	},
	inbox: {
		title: 'Caixa de Entrada',
		unread: 'não lidas',
		refresh: 'Atualizar',
		notifications: 'Notificações',
		messages: 'Mensagens'
	},
	notifications: {
		markAllRead: 'Marcar todas como lidas',
		empty: 'Nenhuma notificação ainda'
	},
	messages: {
		empty: 'Nenhuma mensagem ainda',
		you: 'Você',
		viewTrade: 'Ver troca'
	},
	profile: {
		bio: 'Biografia',
		location: 'Localização',
		country: 'País',
		save: 'Salvar',
		saving: 'Salvando...',
		updated: 'Perfil atualizado!',
		bioPlaceholder: 'Conte aos outros trocadores sobre você...',
		locationPlaceholder: 'Ajuda a encontrar parceiros de troca locais'
	},
	common: {
		loading: 'Carregando...',
		error: 'Ocorreu um erro',
		success: 'Sucesso',
		close: 'Fechar',
		back: 'Voltar',
		confirm: 'Confirmar',
		cancel: 'Cancelar'
	}
};
