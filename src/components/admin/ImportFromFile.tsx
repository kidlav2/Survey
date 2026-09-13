import React, { useContext, useState } from 'react';
import { Copy, Check, Download, Upload } from 'lucide-react';
import { AdminLanguageContext } from './AdminLayout';
import Button from '../chrome/Button';
import { supabase } from '../../lib/supabaseClient';
import { AI_SURVEY_PROMPT, EXAMPLE_SURVEY_MD, parseSurveyFile } from '../../lib/surveySpec';
import { downloadExampleJson, downloadTextFile, importSurveySpec } from '../../lib/surveyImport';

const copy: Record<string, Record<'en' | 'ru' | 'fr' | 'es', string>> = {
  heading: {
    en: 'Build with an AI draft',
    ru: 'Собрать черновик с ИИ',
    fr: 'Créer une ébauche avec l’IA',
    es: 'Armar un borrador con IA',
  },
  intro: {
    en: 'Describe the survey to ChatGPT, Claude, or any other model. Download the file it gives you, then upload it here. The app splits sections, marks required questions, and can translate EN / RU / FR / ES.',
    ru: 'Опишите опрос ChatGPT, Claude или другой модели. Скачайте файл, который она выдаст, и загрузите сюда. Приложение само разложит секции, отметит обязательные вопросы и может перевести EN / RU / FR / ES.',
    fr: 'Décrivez l’enquête à ChatGPT, Claude ou un autre modèle. Téléchargez le fichier, puis importez-le ici. L’application sépare les sections, marque les questions obligatoires et peut traduire EN / RU / FR / ES.',
    es: 'Describa la encuesta a ChatGPT, Claude u otro modelo. Descargue el archivo y súbalo aquí. La app separa secciones, marca lo obligatorio y puede traducir EN / RU / FR / ES.',
  },
  step1: {
    en: '1. Copy this prompt',
    ru: '1. Скопируйте промпт',
    fr: '1. Copiez ce prompt',
    es: '1. Copie este prompt',
  },
  step1help: {
    en: 'Paste it into the AI, then add your topic, audience, and what you need to learn. You can paste the whole reply here — extra words around the JSON are fine.',
    ru: 'Вставьте в ИИ, затем допишите тему, аудиторию и что нужно узнать. Сюда можно вставить весь ответ — слова вокруг JSON не мешают.',
    fr: 'Collez-le dans l’IA, puis ajoutez le sujet, le public et ce que vous voulez apprendre. Vous pouvez coller toute la réponse — le texte autour du JSON ne pose pas de problème.',
    es: 'Péguelo en la IA y añada tema, público y qué necesita saber. Puede pegar toda la respuesta: el texto alrededor del JSON no estorba.',
  },
  copyPrompt: {
    en: 'Copy prompt',
    ru: 'Копировать промпт',
    fr: 'Copier le prompt',
    es: 'Copiar prompt',
  },
  copied: {
    en: 'Copied',
    ru: 'Скопировано',
    fr: 'Copié',
    es: 'Copiado',
  },
  step2: {
    en: '2. Save the AI reply',
    ru: '2. Сохраните ответ ИИ',
    fr: '2. Enregistrez la réponse',
    es: '2. Guarde la respuesta',
  },
  step2help: {
    en: 'JSON is best. Markdown also works if each question starts with [required] or [optional]. Download an example if you want to see the shape.',
    ru: 'Лучше JSON. Подойдёт и Markdown, если каждый вопрос начинается с [required] или [optional]. Скачайте пример, чтобы увидеть форму.',
    fr: 'Le JSON est idéal. Le Markdown marche aussi si chaque question commence par [required] ou [optional]. Téléchargez un exemple pour voir la forme.',
    es: 'JSON es lo mejor. Markdown también vale si cada pregunta empieza por [required] o [optional]. Descargue un ejemplo para ver la forma.',
  },
  downloadJson: {
    en: 'Example JSON',
    ru: 'Пример JSON',
    fr: 'Exemple JSON',
    es: 'Ejemplo JSON',
  },
  downloadMd: {
    en: 'Example Markdown',
    ru: 'Пример Markdown',
    fr: 'Exemple Markdown',
    es: 'Ejemplo Markdown',
  },
  step3: {
    en: '3. Upload or paste',
    ru: '3. Загрузите или вставьте',
    fr: '3. Importez ou collez',
    es: '3. Suba o pegue',
  },
  chooseFile: {
    en: 'Choose file',
    ru: 'Выбрать файл',
    fr: 'Choisir un fichier',
    es: 'Elegir archivo',
  },
  paste: {
    en: 'Or paste the AI reply (JSON or Markdown)',
    ru: 'Или вставьте ответ ИИ (JSON или Markdown)',
    fr: 'Ou collez la réponse de l’IA (JSON ou Markdown)',
    es: 'O pegue la respuesta de la IA (JSON o Markdown)',
  },
  translate: {
    en: 'Translate missing languages (EN, RU, FR, ES)',
    ru: 'Перевести недостающие языки (EN, RU, FR, ES)',
    fr: 'Traduire les langues manquantes (EN, RU, FR, ES)',
    es: 'Traducir idiomas que falten (EN, RU, FR, ES)',
  },
  importAction: {
    en: 'Create survey from file',
    ru: 'Создать опрос из файла',
    fr: 'Créer l’enquête depuis le fichier',
    es: 'Crear encuesta desde el archivo',
  },
  appendAction: {
    en: 'Add these questions',
    ru: 'Добавить эти вопросы',
    fr: 'Ajouter ces questions',
    es: 'Añadir estas preguntas',
  },
  working: {
    en: 'Importing…',
    ru: 'Импорт…',
    fr: 'Import…',
    es: 'Importando…',
  },
};

type Props = {
  mode: 'create' | 'append';
  surveyId?: string;
  onImported: (surveyId: string) => void;
};

export default function ImportFromFile({ mode, surveyId, onImported }: Props) {
  const { language } = useContext(AdminLanguageContext);
  const t = (key: keyof typeof copy) => copy[key][language] || copy[key].en;
  const [draft, setDraft] = useState('');
  const [filename, setFilename] = useState('paste.txt');
  const [translate, setTranslate] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(AI_SURVEY_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setDraft(await file.text());
    setError('');
  };

  const handleImport = async () => {
    setError('');
    setBusy(true);
    setProgress(t('working'));
    try {
      const spec = parseSurveyFile(draft, filename);
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) throw new Error('Not signed in');
      const result = await importSurveySpec({
        spec,
        ownerId: data.user.id,
        surveyId: mode === 'append' ? surveyId : undefined,
        translate,
        onProgress: setProgress,
      });
      onImported(result.surveyId);
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-serif text-2xl font-semibold text-navy">{t('heading')}</h3>
        <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ink-muted">{t('intro')}</p>
      </div>

      <section>
        <h4 className="text-sm font-bold text-ink">{t('step1')}</h4>
        <p className="mt-1 text-sm text-ink-muted">{t('step1help')}</p>
        <pre className="mt-3 max-h-48 overflow-auto border border-line bg-canvas px-3 py-3 text-xs leading-relaxed whitespace-pre-wrap text-ink">
          {AI_SURVEY_PROMPT.trim()}
        </pre>
        <Button variant="secondary" className="mt-3" onClick={handleCopy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t('copied') : t('copyPrompt')}
        </Button>
      </section>

      <section>
        <h4 className="text-sm font-bold text-ink">{t('step2')}</h4>
        <p className="mt-1 text-sm text-ink-muted">{t('step2help')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadExampleJson}>
            <Download className="size-4" />
            {t('downloadJson')}
          </Button>
          <Button variant="secondary" onClick={() => downloadTextFile('survey-example.md', EXAMPLE_SURVEY_MD)}>
            <Download className="size-4" />
            {t('downloadMd')}
          </Button>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-bold text-ink">{t('step3')}</h4>
        <label className="mt-3 inline-flex min-h-12 cursor-pointer items-center gap-2 border border-line-strong bg-surface px-4 text-sm font-bold">
          <Upload className="size-4" />
          {t('chooseFile')}
          <input
            type="file"
            accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
        {filename && draft && <p className="mt-2 text-xs text-ink-subtle">{filename}</p>}
        <label htmlFor="survey-paste" className="mt-4 block text-sm font-bold text-ink">
          {t('paste')}
        </label>
        <textarea
          id="survey-paste"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          className="mt-2 w-full border border-line-strong bg-surface px-3 py-3 font-mono text-sm"
        />
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={translate}
            onChange={(e) => setTranslate(e.target.checked)}
            className="mt-0.5 size-4 accent-navy"
          />
          <span>{t('translate')}</span>
        </label>
      </section>

      {error && (
        <p role="alert" className="border border-danger bg-danger-soft px-3 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {progress && (
        <p role="status" className="text-sm text-ink-muted">
          {progress}
        </p>
      )}

      <Button onClick={handleImport} disabled={busy || !draft.trim()} className="w-full sm:w-auto">
        {busy ? t('working') : mode === 'append' ? t('appendAction') : t('importAction')}
      </Button>
    </div>
  );
}
