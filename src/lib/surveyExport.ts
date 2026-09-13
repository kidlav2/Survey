import {
  answerRowsForResponse,
  filterByDateRange,
  formatDuration,
  isResponseCompleted,
  questionLabel,
  type QuestionRow,
  type ResponseRow,
} from './responseFormat';

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function fileSlug(title?: string) {
  return (title || 'survey').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 48) || 'survey';
}

export function exportResponsesFile(args: {
  type: 'CSV' | 'JSON';
  responses: ResponseRow[];
  questions: QuestionRow[];
  surveyTitle?: string;
  surveyTitles?: Record<string, string>;
  includeResponses: boolean;
  includeContacts: boolean;
  dateRange: string;
  language?: string;
}) {
  const filtered = filterByDateRange(args.responses, args.dateRange);
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = fileSlug(args.surveyTitle);
  const lng = args.language || 'en';

  if (!args.includeResponses && args.includeContacts) {
    const contacts = filtered
      .filter((row) => (row.respondent_email || row.email) && row.opted_in !== false)
      .map((row) => ({
        email: row.respondent_email || row.email,
        date: row.created_at,
        survey: args.surveyTitles?.[row.survey_id] || args.surveyTitle || '',
      }));
    if (args.type === 'CSV') {
      const lines = [ ['Email', 'Date', 'Survey'].map(csvCell).join(',') ];
      for (const contact of contacts) {
        lines.push([contact.email, new Date(contact.date).toISOString(), contact.survey].map(csvCell).join(','));
      }
      downloadBlob(`contacts_${slug}_${stamp}.csv`, `\uFEFF${lines.join('\n')}`, 'text/csv;charset=utf-8');
    } else {
      downloadBlob(`contacts_${slug}_${stamp}.json`, JSON.stringify(contacts, null, 2), 'application/json');
    }
    return;
  }

  if (!args.includeResponses) {
    throw new Error('Select at least one export option');
  }

  const questionsBySurvey = new Map<string, QuestionRow[]>();
  for (const question of args.questions) {
    const key = question.survey_id || '';
    const list = questionsBySurvey.get(key) || [];
    list.push(question);
    questionsBySurvey.set(key, list);
  }
  for (const list of questionsBySurvey.values()) {
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  const surveyIds = [...new Set(filtered.map((row) => row.survey_id))];
  const singleSurvey = surveyIds.length <= 1;
  const wideQuestions = singleSurvey
    ? [...(questionsBySurvey.get(surveyIds[0] || '') || args.questions)].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : [];

  if (args.type === 'CSV') {
    if (singleSurvey) {
      const headers = ['id', 'date', 'survey', 'email', 'status', 'language', 'duration', ...wideQuestions.map((q) => questionLabel(q, lng))];
      const lines = [headers.map(csvCell).join(',')];
      for (const row of filtered) {
        const answers = Object.fromEntries(
          answerRowsForResponse(wideQuestions, row.answers, lng).map((item) => [item.id, item.skipped ? '' : item.answer])
        );
        lines.push(
          [
            row.id,
            new Date(row.created_at).toISOString(),
            args.surveyTitles?.[row.survey_id] || args.surveyTitle || '',
            row.respondent_email || row.email || '',
            isResponseCompleted(row) ? 'completed' : 'in_progress',
            row.language || '',
            formatDuration(row.duration_seconds, ''),
            ...wideQuestions.map((q) => answers[q.id] || ''),
          ]
            .map(csvCell)
            .join(',')
        );
      }
      downloadBlob(`responses_${slug}_${stamp}.csv`, `\uFEFF${lines.join('\n')}`, 'text/csv;charset=utf-8');
      return;
    }

    const lines = [['id', 'date', 'survey', 'email', 'status', 'language', 'duration', 'question', 'answer'].map(csvCell).join(',')];
    for (const row of filtered) {
      const questions = questionsBySurvey.get(row.survey_id) || [];
      const answers = answerRowsForResponse(questions, row.answers, lng);
      const meta = [
        row.id,
        new Date(row.created_at).toISOString(),
        args.surveyTitles?.[row.survey_id] || '',
        row.respondent_email || row.email || '',
        isResponseCompleted(row) ? 'completed' : 'in_progress',
        row.language || '',
        formatDuration(row.duration_seconds, ''),
      ];
      if (!answers.length) {
        lines.push([...meta, '', ''].map(csvCell).join(','));
        continue;
      }
      for (const answer of answers) {
        lines.push([...meta, answer.label, answer.skipped ? '' : answer.answer].map(csvCell).join(','));
      }
    }
    downloadBlob(`responses_${slug}_${stamp}.csv`, `\uFEFF${lines.join('\n')}`, 'text/csv;charset=utf-8');
    return;
  }

  const json = filtered.map((row) => {
    const questions = questionsBySurvey.get(row.survey_id) || args.questions;
    return {
      id: row.id,
      date: row.created_at,
      survey: args.surveyTitles?.[row.survey_id] || args.surveyTitle || '',
      email: row.respondent_email || row.email || null,
      status: isResponseCompleted(row) ? 'completed' : 'in_progress',
      language: row.language || null,
      duration_seconds: row.duration_seconds ?? null,
      answers: Object.fromEntries(
        answerRowsForResponse(questions, row.answers, lng).map((item) => [item.label, item.skipped ? null : item.answer])
      ),
    };
  });
  downloadBlob(`responses_${slug}_${stamp}.json`, JSON.stringify(json, null, 2), 'application/json');
}
