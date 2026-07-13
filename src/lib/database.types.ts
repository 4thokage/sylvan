export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: '14.4';
	};
	public: {
		Tables: {
			blocked_users: {
				Row: {
					blocked_id: string;
					blocker_id: string;
					created_at: string | null;
					id: string;
				};
				Insert: {
					blocked_id: string;
					blocker_id: string;
					created_at?: string | null;
					id?: string;
				};
				Update: {
					blocked_id?: string;
					blocker_id?: string;
					created_at?: string | null;
					id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'blocked_users_blocked_id_fkey';
						columns: ['blocked_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'blocked_users_blocker_id_fkey';
						columns: ['blocker_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					}
				];
			};
			card_external_refs: {
				Row: {
					card_id: string;
					created_at: string | null;
					external_id: string;
					id: string;
					identifier_type: string;
					provider_slug: string;
				};
				Insert: {
					card_id: string;
					created_at?: string | null;
					external_id: string;
					id?: string;
					identifier_type: string;
					provider_slug: string;
				};
				Update: {
					card_id?: string;
					created_at?: string | null;
					external_id?: string;
					id?: string;
					identifier_type?: string;
					provider_slug?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'card_external_refs_card_id_fkey';
						columns: ['card_id'];
						isOneToOne: false;
						referencedRelation: 'cards';
						referencedColumns: ['id'];
					}
				];
			};
			card_printings: {
				Row: {
					card_id: string;
					collector_number: string | null;
					created_at: string | null;
					factory_signed: boolean;
					finish: string;
					game_id: string;
					id: string;
					image_url: string | null;
					language: string;
					last_price_update: string | null;
					market_price_eur: number | null;
					market_price_usd: number | null;
					rarity: string | null;
					set_code: string;
					set_name: string;
				};
				Insert: {
					card_id: string;
					collector_number?: string | null;
					created_at?: string | null;
					factory_signed?: boolean;
					finish?: string;
					game_id: string;
					id?: string;
					image_url?: string | null;
					language?: string;
					last_price_update?: string | null;
					market_price_eur?: number | null;
					market_price_usd?: number | null;
					rarity?: string | null;
					set_code: string;
					set_name: string;
				};
				Update: {
					card_id?: string;
					collector_number?: string | null;
					created_at?: string | null;
					factory_signed?: boolean;
					finish?: string;
					game_id?: string;
					id?: string;
					image_url?: string | null;
					language?: string;
					last_price_update?: string | null;
					market_price_eur?: number | null;
					market_price_usd?: number | null;
					rarity?: string | null;
					set_code?: string;
					set_name?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'card_printings_card_id_fkey';
						columns: ['card_id'];
						isOneToOne: false;
						referencedRelation: 'cards';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'card_printings_game_id_fkey';
						columns: ['game_id'];
						isOneToOne: false;
						referencedRelation: 'games';
						referencedColumns: ['id'];
					}
				];
			};
			cards: {
				Row: {
					created_at: string | null;
					game_data: Json | null;
					game_id: string;
					id: string;
					image_url: string | null;
					name: string;
					normalized_name: string;
				};
				Insert: {
					created_at?: string | null;
					game_data?: Json | null;
					game_id: string;
					id?: string;
					image_url?: string | null;
					name: string;
					normalized_name: string;
				};
				Update: {
					created_at?: string | null;
					game_data?: Json | null;
					game_id?: string;
					id?: string;
					image_url?: string | null;
					name?: string;
					normalized_name?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'cards_game_id_fkey';
						columns: ['game_id'];
						isOneToOne: false;
						referencedRelation: 'games';
						referencedColumns: ['id'];
					}
				];
			};
			games: {
				Row: {
					created_at: string | null;
					id: string;
					name: string;
					slug: string;
				};
				Insert: {
					created_at?: string | null;
					id?: string;
					name: string;
					slug: string;
				};
				Update: {
					created_at?: string | null;
					id?: string;
					name?: string;
					slug?: string;
				};
				Relationships: [];
			};
			messages: {
				Row: {
					body: string;
					created_at: string | null;
					id: string;
					read_at: string | null;
					recipient_id: string;
					sender_id: string;
					subject: string | null;
					trade_id: string | null;
				};
				Insert: {
					body: string;
					created_at?: string | null;
					id?: string;
					read_at?: string | null;
					recipient_id: string;
					sender_id: string;
					subject?: string | null;
					trade_id?: string | null;
				};
				Update: {
					body?: string;
					created_at?: string | null;
					id?: string;
					read_at?: string | null;
					recipient_id?: string;
					sender_id?: string;
					subject?: string | null;
					trade_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'messages_recipient_id_fkey';
						columns: ['recipient_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'messages_sender_id_fkey';
						columns: ['sender_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'messages_trade_id_fkey';
						columns: ['trade_id'];
						isOneToOne: false;
						referencedRelation: 'trades';
						referencedColumns: ['id'];
					}
				];
			};
			notifications: {
				Row: {
					body: string | null;
					created_at: string | null;
					data: Json | null;
					id: string;
					read_at: string | null;
					title: string;
					type: string;
					user_id: string;
				};
				Insert: {
					body?: string | null;
					created_at?: string | null;
					data?: Json | null;
					id?: string;
					read_at?: string | null;
					title: string;
					type: string;
					user_id: string;
				};
				Update: {
					body?: string | null;
					created_at?: string | null;
					data?: Json | null;
					id?: string;
					read_at?: string | null;
					title?: string;
					type?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'notifications_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					}
				];
			};
			printing_external_refs: {
				Row: {
					created_at: string | null;
					external_id: string;
					id: string;
					identifier_type: string;
					printing_id: string;
					provider_slug: string;
				};
				Insert: {
					created_at?: string | null;
					external_id: string;
					id?: string;
					identifier_type: string;
					printing_id: string;
					provider_slug: string;
				};
				Update: {
					created_at?: string | null;
					external_id?: string;
					id?: string;
					identifier_type?: string;
					printing_id?: string;
					provider_slug?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'printing_external_refs_printing_id_fkey';
						columns: ['printing_id'];
						isOneToOne: false;
						referencedRelation: 'card_printings';
						referencedColumns: ['id'];
					}
				];
			};
			trade_offer_items: {
				Row: {
					created_at: string | null;
					id: string;
					offer_id: string;
					quantity: number;
					user_card_id: string;
				};
				Insert: {
					created_at?: string | null;
					id?: string;
					offer_id: string;
					quantity?: number;
					user_card_id: string;
				};
				Update: {
					created_at?: string | null;
					id?: string;
					offer_id?: string;
					quantity?: number;
					user_card_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'trade_offer_items_offer_id_fkey';
						columns: ['offer_id'];
						isOneToOne: false;
						referencedRelation: 'trade_offers';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trade_offer_items_user_card_id_fkey';
						columns: ['user_card_id'];
						isOneToOne: false;
						referencedRelation: 'user_cards';
						referencedColumns: ['id'];
					}
				];
			};
			trade_offers: {
				Row: {
					created_at: string | null;
					id: string;
					note: string | null;
					offered_by: string;
					trade_id: string;
				};
				Insert: {
					created_at?: string | null;
					id?: string;
					note?: string | null;
					offered_by: string;
					trade_id: string;
				};
				Update: {
					created_at?: string | null;
					id?: string;
					note?: string | null;
					offered_by?: string;
					trade_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'trade_offers_offered_by_fkey';
						columns: ['offered_by'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trade_offers_trade_id_fkey';
						columns: ['trade_id'];
						isOneToOne: false;
						referencedRelation: 'trades';
						referencedColumns: ['id'];
					}
				];
			};
			trade_ratings: {
				Row: {
					comment: string | null;
					created_at: string | null;
					id: string;
					rated_id: string;
					rater_id: string;
					rating: number;
					trade_id: string;
				};
				Insert: {
					comment?: string | null;
					created_at?: string | null;
					id?: string;
					rated_id: string;
					rater_id: string;
					rating: number;
					trade_id: string;
				};
				Update: {
					comment?: string | null;
					created_at?: string | null;
					id?: string;
					rated_id?: string;
					rater_id?: string;
					rating?: number;
					trade_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'trade_ratings_rated_id_fkey';
						columns: ['rated_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trade_ratings_rater_id_fkey';
						columns: ['rater_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trade_ratings_trade_id_fkey';
						columns: ['trade_id'];
						isOneToOne: false;
						referencedRelation: 'trades';
						referencedColumns: ['id'];
					}
				];
			};
			trades: {
				Row: {
					completed_at: string | null;
					created_at: string | null;
					current_offer_id: string | null;
					id: string;
					proposer_id: string;
					proposer_note: string | null;
					recipient_id: string;
					recipient_note: string | null;
					status: string;
					updated_at: string | null;
				};
				Insert: {
					completed_at?: string | null;
					created_at?: string | null;
					current_offer_id?: string | null;
					id?: string;
					proposer_id: string;
					proposer_note?: string | null;
					recipient_id: string;
					recipient_note?: string | null;
					status?: string;
					updated_at?: string | null;
				};
				Update: {
					completed_at?: string | null;
					created_at?: string | null;
					current_offer_id?: string | null;
					id?: string;
					proposer_id?: string;
					proposer_note?: string | null;
					recipient_id?: string;
					recipient_note?: string | null;
					status?: string;
					updated_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_trades_current_offer';
						columns: ['current_offer_id'];
						isOneToOne: false;
						referencedRelation: 'trade_offers';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trades_proposer_id_fkey';
						columns: ['proposer_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'trades_recipient_id_fkey';
						columns: ['recipient_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					}
				];
			};
			user_cards: {
				Row: {
					aftermarket_signed: boolean;
					card_printing_id: string;
					condition: string;
					created_at: string | null;
					id: string;
					is_altered: boolean;
					is_tradeable: boolean;
					location: string | null;
					notes: string | null;
					quantity: number;
					updated_at: string | null;
					user_id: string;
				};
				Insert: {
					aftermarket_signed?: boolean;
					card_printing_id: string;
					condition?: string;
					created_at?: string | null;
					id?: string;
					is_altered?: boolean;
					is_tradeable?: boolean;
					location?: string | null;
					notes?: string | null;
					quantity?: number;
					updated_at?: string | null;
					user_id: string;
				};
				Update: {
					aftermarket_signed?: boolean;
					card_printing_id?: string;
					condition?: string;
					created_at?: string | null;
					id?: string;
					is_altered?: boolean;
					is_tradeable?: boolean;
					location?: string | null;
					notes?: string | null;
					quantity?: number;
					updated_at?: string | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'user_cards_card_printing_id_fkey';
						columns: ['card_printing_id'];
						isOneToOne: false;
						referencedRelation: 'card_printings';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'user_cards_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					}
				];
			};
			user_sessions: {
				Row: {
					created_at: string | null;
					device_info: Json | null;
					fingerprint: string;
					id: string;
					last_seen_at: string | null;
					user_id: string | null;
				};
				Insert: {
					created_at?: string | null;
					device_info?: Json | null;
					fingerprint: string;
					id?: string;
					last_seen_at?: string | null;
					user_id?: string | null;
				};
				Update: {
					created_at?: string | null;
					device_info?: Json | null;
					fingerprint?: string;
					id?: string;
					last_seen_at?: string | null;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'user_sessions_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					}
				];
			};
			users: {
				Row: {
					clerk_user_id: string;
					created_at: string | null;
					id: string;
					is_admin: boolean | null;
					updated_at: string | null;
					username: string | null;
				};
				Insert: {
					clerk_user_id: string;
					created_at?: string | null;
					id?: string;
					is_admin?: boolean | null;
					updated_at?: string | null;
					username?: string | null;
				};
				Update: {
					clerk_user_id?: string;
					created_at?: string | null;
					id?: string;
					is_admin?: boolean | null;
					updated_at?: string | null;
					username?: string | null;
				};
				Relationships: [];
			};
			wishlist_items: {
				Row: {
					aftermarket_signed: boolean | null;
					card_id: string;
					card_printing_id: string | null;
					condition: string | null;
					created_at: string | null;
					finish: string | null;
					id: string;
					is_altered: boolean | null;
					language: string | null;
					quantity: number;
					wishlist_id: string;
				};
				Insert: {
					aftermarket_signed?: boolean | null;
					card_id: string;
					card_printing_id?: string | null;
					condition?: string | null;
					created_at?: string | null;
					finish?: string | null;
					id?: string;
					is_altered?: boolean | null;
					language?: string | null;
					quantity?: number;
					wishlist_id: string;
				};
				Update: {
					aftermarket_signed?: boolean | null;
					card_id?: string;
					card_printing_id?: string | null;
					condition?: string | null;
					created_at?: string | null;
					finish?: string | null;
					id?: string;
					is_altered?: boolean | null;
					language?: string | null;
					quantity?: number;
					wishlist_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'wishlist_items_card_id_fkey';
						columns: ['card_id'];
						isOneToOne: false;
						referencedRelation: 'cards';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'wishlist_items_card_printing_id_fkey';
						columns: ['card_printing_id'];
						isOneToOne: false;
						referencedRelation: 'card_printings';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'wishlist_items_wishlist_id_fkey';
						columns: ['wishlist_id'];
						isOneToOne: false;
						referencedRelation: 'wishlists';
						referencedColumns: ['id'];
					}
				];
			};
			wishlists: {
				Row: {
					created_at: string | null;
					creator_fingerprint: string | null;
					game_id: string | null;
					id: string;
					owner_name: string | null;
					title: string | null;
					updated_at: string | null;
					user_id: string | null;
					visibility: string;
				};
				Insert: {
					created_at?: string | null;
					creator_fingerprint?: string | null;
					game_id?: string | null;
					id: string;
					owner_name?: string | null;
					title?: string | null;
					updated_at?: string | null;
					user_id?: string | null;
					visibility?: string;
				};
				Update: {
					created_at?: string | null;
					creator_fingerprint?: string | null;
					game_id?: string | null;
					id?: string;
					owner_name?: string | null;
					title?: string | null;
					updated_at?: string | null;
					user_id?: string | null;
					visibility?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'wishlists_game_id_fkey';
						columns: ['game_id'];
						isOneToOne: false;
						referencedRelation: 'games';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'wishlists_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					}
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			available_quantity: {
				Args: { p_exclude_trade_id?: string; p_user_card_id: string };
				Returns: number;
			};
			cancel_trade: {
				Args: { p_trade_id: string; p_user_id: string };
				Returns: undefined;
			};
			create_counter_offer: {
				Args: {
					p_note?: string;
					p_offered_by: string;
					p_offered_items: Json;
					p_requested_items: Json;
					p_trade_id: string;
				};
				Returns: string;
			};
			create_trade: {
				Args: {
					p_note?: string;
					p_offered_items: Json;
					p_proposer_id: string;
					p_recipient_id: string;
					p_requested_items: Json;
				};
				Returns: string;
			};
			create_wishlist: {
				Args: {
					p_creator_fingerprint: string;
					p_game_id: string;
					p_id: string;
					p_items: Json;
					p_owner_name: string;
					p_title: string;
					p_user_id: string;
					p_visibility: string;
				};
				Returns: string;
			};
			current_user_id: { Args: never; Returns: string };
			delete_wishlist: {
				Args: {
					p_fingerprint: string;
					p_user_id: string;
					p_wishlist_id: string;
				};
				Returns: boolean;
			};
			ensure_user: { Args: { p_clerk_user_id: string }; Returns: string };
			is_blocked: { Args: { a: string; b: string }; Returns: boolean };
			respond_to_offer: {
				Args: { p_action: string; p_trade_id: string; p_user_id: string };
				Returns: undefined;
			};
			show_limit: { Args: never; Returns: number };
			show_trgm: { Args: { '': string }; Returns: string[] };
			upgrade_session: {
				Args: { p_fingerprint: string; p_user_id: string };
				Returns: boolean;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {}
	}
} as const;
