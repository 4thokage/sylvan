import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onhkeokldtpnjeudhawg.supabase.co';
const supabaseAnonKey = 'sb_publishable_tM8BrB4leUVVGbB_C9SsVw_3yS5UUh3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
