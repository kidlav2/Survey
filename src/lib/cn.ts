import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Lng = 'en' | 'ru' | 'fr' | 'es';

export const LANGUAGES: { code: Lng; name: string; short: string }[] = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'ru', name: 'Русский', short: 'RU' },
  { code: 'fr', name: 'Français', short: 'FR' },
  { code: 'es', name: 'Español', short: 'ES' },
];

export function isLng(value: string | null | undefined): value is Lng {
  return value === 'en' || value === 'ru' || value === 'fr' || value === 'es';
}
