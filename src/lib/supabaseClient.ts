type Filter = { type: 'eq' | 'in'; col: string; val: unknown };
type QueryResult = { data: any; error: { message: string; code?: string } | null; count?: number | null };
type AuthUser = {
  id: string;
  email: string;
  user_metadata?: { full_name?: string; organization?: string };
};
type Session = { user: AuthUser } | null;
type AuthChangeCallback = (event: string, session: Session) => void;

const listeners = new Set<AuthChangeCallback>();

async function post<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return json;
}

async function fetchSession(): Promise<Session> {
  const res = await fetch('/api/auth/session', { credentials: 'include' });
  const json = await res.json().catch(() => ({ session: null }));
  return json.session ?? (json.user ? { user: json.user } : null);
}

function notify(event: string, session: Session) {
  listeners.forEach((cb) => cb(event, session));
}

class QueryBuilder implements PromiseLike<QueryResult> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private spec = '*';
  private filters: Filter[] = [];
  private orderBy?: { col: string; ascending?: boolean };
  private payload?: Record<string, unknown> | Record<string, unknown>[];
  private asSingle = false;
  private asMaybeSingle = false;
  private rowLimit?: number;
  private countMode?: 'exact';
  private head = false;

  constructor(private table: string) {}

  select(spec = '*', opts?: { count?: 'exact'; head?: boolean }) {
    this.spec = spec;
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.head = true;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = 'insert';
    this.payload = data;
    return this;
  }

  update(data: Record<string, unknown>) {
    this.op = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }

  in(col: string, val: unknown) {
    this.filters.push({ type: 'in', col, val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending };
    return this;
  }

  limit(n: number) {
    this.rowLimit = n;
    return this;
  }

  single() {
    this.asSingle = true;
    return this;
  }

  maybeSingle() {
    this.asMaybeSingle = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.exec().then(onfulfilled, onrejected);
  }

  private async exec(): Promise<QueryResult> {
    try {
      const result = await post<QueryResult>('/api/query', {
        table: this.table,
        op: this.op,
        select: this.spec,
        filters: this.filters,
        order: this.orderBy,
        data: this.payload,
        single: this.asSingle,
        maybeSingle: this.asMaybeSingle,
        limit: this.rowLimit,
        count: this.countMode,
        head: this.head,
      });
      return {
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Request failed' } };
    }
  }
}

export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  channel() {
    return {
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    };
  },
  removeChannel() {},
  async rpc(name: string) {
    if (name === 'delete_user_account') {
      const result = await post<{ error?: { message: string } }>('/api/auth/delete');
      return { data: result.error ? null : true, error: result.error ?? null };
    }
    return { data: null, error: { message: `Unknown rpc ${name}` } };
  },
  auth: {
    async getSession() {
      try {
        const session = await fetchSession();
        return { data: { session }, error: null };
      } catch (error) {
        return { data: { session: null }, error: { message: error instanceof Error ? error.message : 'Session failed' } };
      }
    },
    async getUser() {
      try {
        const session = await fetchSession();
        if (!session?.user) return { data: { user: null }, error: { message: 'Not authenticated' } };
        return { data: { user: session.user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: { message: error instanceof Error ? error.message : 'Auth failed' } };
      }
    },
    onAuthStateChange(cb: AuthChangeCallback) {
      listeners.add(cb);
      fetchSession().then((session) => cb('INITIAL_SESSION', session));
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const result = await post<{ user?: AuthUser; session?: Session; error?: { message: string } }>(
        '/api/auth/login',
        { email, password }
      );
      if (result.error) return { data: { user: null, session: null }, error: result.error };
      const session = result.session ?? (result.user ? { user: result.user } : null);
      notify('SIGNED_IN', session);
      return { data: { user: result.user, session }, error: null };
    },
    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: { full_name?: string } };
    }) {
      const result = await post<{ user?: AuthUser; error?: { message: string } }>('/api/auth/register', {
        email,
        password,
        name: options?.data?.full_name,
      });
      if (result.error) return { data: { user: null, session: null }, error: result.error };
      const session = result.user ? { user: result.user } : null;
      notify('SIGNED_IN', session);
      return { data: { user: result.user, session }, error: null };
    },
    async signOut() {
      await post('/api/auth/logout');
      notify('SIGNED_OUT', null);
      return { error: null };
    },
    async resetPasswordForEmail(email: string) {
      const result = await post<{ error?: { message: string } }>('/api/auth/update', { email });
      return { data: {}, error: result.error ?? null };
    },
    async updateUser(payload: {
      password?: string;
      email?: string;
      data?: { full_name?: string; organization?: string };
    }) {
      const result = await post<{ user?: AuthUser; error?: { message: string } }>('/api/auth/update', {
        password: payload.password,
        email: payload.email,
        name: payload.data?.full_name,
        organization: payload.data?.organization,
      });
      if (result.error) return { data: { user: null }, error: result.error };
      if (result.user) notify('USER_UPDATED', { user: result.user });
      return { data: { user: result.user }, error: null };
    },
  },
};

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
  const { data, error } = await supabase.from('surveys').select('*').order('created_at', { ascending: false });
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
  if (!user) throw new Error('Not authenticated');

  const payload = {
    owner_id: user.id,
    title: input.title,
    description: input.description ?? null,
    status: input.status === 'active' ? 'active' : 'draft',
  };

  const { data, error } = await supabase.from('surveys').insert(payload).select('*').single();
  if (error) throw error;
  return data as Survey;
}

export async function deleteSurveyById(id: string): Promise<void> {
  const { error } = await supabase.from('surveys').delete().eq('id', id);
  if (error) throw error;
}

export type SurveyShare = {
  id: string;
  email: string;
  user_id: string | null;
  role: string;
  created_at: string;
  name?: string | null;
};

export type SurveySharesResponse = {
  owner: { id: string; email: string; name?: string } | null;
  isOwner: boolean;
  shares: SurveyShare[];
  error?: { message: string };
};

export async function fetchSurveyShares(surveyId: string): Promise<SurveySharesResponse> {
  const res = await fetch(`/api/shares?survey_id=${encodeURIComponent(surveyId)}`, { credentials: 'include' });
  return (await res.json()) as SurveySharesResponse;
}

export async function inviteToSurvey(surveyId: string, email: string) {
  const res = await fetch('/api/shares', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ survey_id: surveyId, email }),
  });
  return (await res.json()) as { share?: SurveyShare; pending?: boolean; error?: { message: string } };
}

export async function removeSurveyShare(id: string) {
  const res = await fetch('/api/shares', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  return (await res.json()) as { ok?: boolean; error?: { message: string } };
}
