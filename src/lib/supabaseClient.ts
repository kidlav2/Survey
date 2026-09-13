import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function missingSchemaColumn(error: { message?: string } | null | undefined): string | null {
  const match = String(error?.message || '').match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

export async function insertIgnoringUnknownColumns(table: string, row: Record<string, unknown>) {
  const current: Record<string, unknown> = { ...row };
  for (let i = 0; i < 8; i++) {
    const { data, error } = await supabase.from(table).insert(current).select('*').single();
    if (!error) {
      if (!data) throw new Error(`No row returned from ${table}`);
      return data as { id: string } & Record<string, unknown>;
    }
    const column = missingSchemaColumn(error);
    if (!column || !(column in current)) throw error;
    delete current[column];
  }
  throw new Error(`Could not insert into ${table}`);
}

export async function updateIgnoringUnknownColumns(
  table: string,
  row: Record<string, unknown>,
  id: string
) {
  const current: Record<string, unknown> = { ...row };
  for (let i = 0; i < 8; i++) {
    const { error } = await supabase.from(table).update(current).eq('id', id);
    if (!error) return;
    const column = missingSchemaColumn(error);
    if (!column || !(column in current)) throw error;
    delete current[column];
  }
  throw new Error(`Could not update ${table}`);
}

export type SurveyStatus = 'draft' | 'active';

export type Survey = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  created_at: string;
};

export async function fetchSurveys(): Promise<Survey[]> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Survey[];
}

export async function createSurvey(input: {
  title: string;
  description?: string;
  status?: SurveyStatus;
}): Promise<Survey> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const user = authData?.user;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const payload = {
    owner_id: user.id,
    title: input.title,
    description: input.description ?? null,
    status: input.status === 'active' ? 'active' : 'draft',  };

  const { data, error } = await supabase
    .from('surveys')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as Survey;
}

export async function deleteSurveyById(id: string): Promise<void> {
  const { error } = await supabase
    .from('surveys')
    .delete()
    .eq('id', id);

  if (error) throw error;
}