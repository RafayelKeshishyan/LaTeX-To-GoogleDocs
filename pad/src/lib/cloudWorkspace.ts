import type { PadLibrary } from './document';
import { normalizeLibrary } from './document';
import { getSupabase } from './supabase';

export async function loadCloudLibrary(userId: string): Promise<PadLibrary | null> {
  const { data, error } = await getSupabase()
    .from('personal_workspaces')
    .select('content')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const library = normalizeLibrary(data.content);
  if (!library) throw new Error('Saved workspace data is not valid.');
  return library;
}

export async function saveCloudLibrary(
  userId: string,
  library: PadLibrary,
): Promise<void> {
  const { error } = await getSupabase()
    .from('personal_workspaces')
    .upsert({ user_id: userId, content: library }, { onConflict: 'user_id' });
  if (error) throw error;
}
