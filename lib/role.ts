import { supabase } from './supabaseClient';
export type Role = 'admin' | 'teacher_readonly' | null;

export async function fetchRole(): Promise<Role> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return null;

  const { data } = await supabase
    .from('sb_users')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  return (data?.role as Role) ?? null;
}
