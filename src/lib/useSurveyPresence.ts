import { useEffect, useRef, useState } from 'react';

export type PresencePeer = {
  user_id: string;
  email: string;
  name?: string | null;
  area: string;
  question_id?: string | null;
  save_status: string;
  save_epoch: number;
};

const COLORS = ['#31486f', '#c45a28', '#3f6d52', '#6b5c9e', '#8a5a44'];

export function presenceColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i) * (i + 1)) % COLORS.length;
  return COLORS[hash];
}

export function presenceLabel(peer: PresencePeer) {
  const name = (peer.name || '').trim();
  if (name) return name.split(/\s+/)[0];
  return (peer.email || 'Someone').split('@')[0];
}

export function useSurveyPresence(args: {
  surveyId?: string;
  questionId: string | null;
  area: string;
  saveStatus: string;
  saveEpoch: number;
  enabled?: boolean;
  onRemoteSave?: (peer: PresencePeer) => void;
}) {
  const { surveyId, questionId, area, saveStatus, saveEpoch, enabled = true, onRemoteSave } = args;
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const seenEpoch = useRef<Record<string, number>>({});
  const saveCallback = useRef(onRemoteSave);
  saveCallback.current = onRemoteSave;

  useEffect(() => {
    if (!surveyId || !enabled) {
      setPeers([]);
      return;
    }
    let cancelled = false;

    const beat = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/presence', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            survey_id: surveyId,
            question_id: questionId,
            area,
            save_status: saveStatus,
            save_epoch: saveEpoch,
          }),
        });
        const json = await res.json().catch(() => ({ peers: [] }));
        if (cancelled) return;
        const next = (json.peers || []) as PresencePeer[];
        setPeers(next);
        for (const peer of next) {
          const previous = seenEpoch.current[peer.user_id];
          if (previous != null && peer.save_epoch > previous) {
            saveCallback.current?.(peer);
          }
          seenEpoch.current[peer.user_id] = peer.save_epoch;
        }
      } catch {
        /* keep last peers */
      }
    };

    void beat();
    const timer = window.setInterval(() => void beat(), 2500);

    const leave = () => {
      void fetch('/api/presence', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ survey_id: surveyId }),
        keepalive: true,
      });
    };
    window.addEventListener('pagehide', leave);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [surveyId, questionId, area, saveStatus, saveEpoch, enabled]);

  return peers;
}
