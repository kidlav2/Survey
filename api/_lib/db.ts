import { neon } from '@neondatabase/serverless';

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}

export const TABLES = ['surveys', 'questions', 'survey_sections', 'responses'] as const;
export type TableName = (typeof TABLES)[number];

export const COLUMNS: Record<TableName, string[]> = {
  surveys: [
    'id',
    'title',
    'description',
    'status',
    'created_at',
    'owner_id',
    'estimated_time',
    'thank_you_message',
    'show_survey_info',
  ],
  questions: [
    'id',
    'survey_id',
    'type',
    'text',
    'options',
    'required',
    'has_other_option',
    'sort_order',
    'created_at',
    'payload',
    'section_id',
    'conditional_logic',
  ],
  survey_sections: ['id', 'survey_id', 'name', 'description', 'order_index', 'created_at'],
  responses: [
    'id',
    'survey_id',
    'respondent_email',
    'answers',
    'created_at',
    'duration_seconds',
    'language',
    'opted_in',
    'completed',
    'lng',
  ],
};

export const JSON_COLUMNS = new Set([
  'options',
  'payload',
  'conditional_logic',
  'answers',
]);

export function isTable(name: string): name is TableName {
  return (TABLES as readonly string[]).includes(name);
}
