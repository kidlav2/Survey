import React, { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { fetchSurveyShares, inviteToSurvey, removeSurveyShare, type SurveyShare } from '../../lib/supabaseClient';
import Button from '../chrome/Button';
import { adminTranslations } from './adminTranslations';
import type { Lng } from '../../lib/cn';

type Props = {
  isOpen: boolean;
  surveyId: string;
  language: Lng;
  onClose: () => void;
};

export default function ShareSurveyModal({ isOpen, surveyId, language, onClose }: Props) {
  const t = adminTranslations[language];
  const [email, setEmail] = useState('');
  const [shares, setShares] = useState<SurveyShare[]>([]);
  const [owner, setOwner] = useState<{ email: string; name?: string } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSurveyShares(surveyId);
      if (data.error) throw new Error(data.error.message);
      setOwner(data.owner);
      setIsOwner(Boolean(data.isOwner));
      setShares(data.shares || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToShare);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && surveyId) void load();
  }, [isOpen, surveyId]);

  if (!isOpen) return null;

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const result = await inviteToSurvey(surveyId, email);
      if (result.error) throw new Error(result.error.message);
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToShare);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      setError(null);
      const result = await removeSurveyShare(id);
      if (result.error) throw new Error(result.error.message);
      setShares((current) => current.filter((share) => share.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToShare);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md border border-line bg-surface p-5 md:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl font-semibold text-navy">{t.shareSurvey}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t.shareSurveyHint}</p>
          </div>
          <button type="button" className="min-h-11 min-w-11 text-ink-muted" onClick={onClose} aria-label={t.close}>
            <X className="mx-auto size-5" />
          </button>
        </div>

        {isOwner && (
          <form className="mb-5 flex gap-2" onSubmit={handleInvite}>
            <label className="sr-only" htmlFor="share-email">
              {t.inviteEmail}
            </label>
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.inviteEmail}
              className="min-h-12 min-w-0 flex-1 border border-line-strong bg-canvas px-3 text-sm"
              autoComplete="email"
            />
            <Button type="submit" disabled={saving || !email.trim()}>
              <UserPlus className="size-4" />
              {t.sendInvite}
            </Button>
          </form>
        )}

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        {loading ? (
          <p className="text-sm text-ink-muted">{t.loading}</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {owner && (
              <li className="flex items-center justify-between gap-3 border border-line bg-canvas px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {owner.name ? `${owner.name} · ${owner.email}` : owner.email}
                </span>
                <span className="shrink-0 text-xs font-bold tracking-wide text-ink-subtle">{t.ownerLabel}</span>
              </li>
            )}
            {shares.map((share) => (
              <li key={share.id} className="flex items-center justify-between gap-3 border border-line bg-canvas px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{share.name ? `${share.name} · ${share.email}` : share.email}</span>
                  {!share.user_id && <span className="text-xs text-ink-muted">{t.waitingToJoin}</span>}
                </span>
                {isOwner && (
                  <button type="button" className="shrink-0 text-sm font-bold text-danger" onClick={() => void handleRemove(share.id)}>
                    {t.removeAccess}
                  </button>
                )}
              </li>
            ))}
            {!shares.length && <li className="text-sm text-ink-muted">{t.noCollaborators}</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
