import { fetchSurveyShares, supabase } from './supabaseClient';

export function isPreviewRequest(search: string) {
  const value = new URLSearchParams(search).get('preview');
  return value === '1' || value === 'true';
}

export function withPreviewParam(path: string, preview: boolean) {
  if (!preview) return path;
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('preview', '1');
  const next = params.toString();
  return next ? `${base}?${next}` : `${base}?preview=1`;
}

export function publicSurveyPath(surveyId: string) {
  return `/survey/${surveyId}`;
}

export function publicSurveyUrl(surveyId: string) {
  return `${window.location.origin}${publicSurveyPath(surveyId)}`;
}

export function previewSurveyUrl(surveyId: string) {
  return `${window.location.origin}/survey/${surveyId}/welcome?preview=1`;
}

export async function canPreviewInactiveSurvey(surveyId: string, ownerId?: string | null) {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return false;
  if (ownerId && user.id === ownerId) return true;
  try {
    const shares = await fetchSurveyShares(surveyId);
    if (shares.isOwner) return true;
    const email = String(user.email || '').toLowerCase();
    return (shares.shares || []).some(
      (share) => share.user_id === user.id || String(share.email || '').toLowerCase() === email
    );
  } catch {
    return false;
  }
}
