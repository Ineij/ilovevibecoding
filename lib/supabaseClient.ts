import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vvlparcfztwnezgjwbma.supabase.co';
const supabaseAnonKey = 'sb_publishable_RFYGQb7iUyY850iRuzHTzg_D4CSilEg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);