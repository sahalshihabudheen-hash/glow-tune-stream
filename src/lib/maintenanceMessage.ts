import type { CSSProperties } from 'react';

/**
 * Custom message shown on the maintenance screen.
 * Stored inside the existing `app_settings` row (key = 'maintenance_mode') as
 * `value.custom_message`, so no database migration is needed.
 */
export type MessageAlign = 'left' | 'center' | 'right';
export type MessageFont = 'sans' | 'serif' | 'mono';

export interface MaintenanceMessageConfig {
  title: string;
  message: string;
  titleSize: number; // px
  messageSize: number; // px
  titleColor: string; // '' = theme default
  messageColor: string; // '' = theme default
  align: MessageAlign;
  bold: boolean;
  italic: boolean;
  font: MessageFont;
}

export const DEFAULT_TITLE = 'Under Maintenance';
export const DEFAULT_MESSAGE_LINES = [
  'JARVIS is working faster than you think',
  "We're upgrading our systems to serve you better. Please check back soon.",
];

export const MAX_TITLE_LENGTH = 80;
export const MAX_MESSAGE_LENGTH = 600;
export const TITLE_SIZE_RANGE = { min: 20, max: 64 };
export const MESSAGE_SIZE_RANGE = { min: 12, max: 36 };

export const DEFAULT_MESSAGE_CONFIG: MaintenanceMessageConfig = {
  title: '',
  message: '',
  titleSize: 36,
  messageSize: 18,
  titleColor: '',
  messageColor: '',
  align: 'center',
  bold: false,
  italic: false,
  font: 'sans',
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
};

/** Turns anything read from the database into a safe, fully-populated config. */
export function sanitizeMessageConfig(raw: unknown): MaintenanceMessageConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const color = (v: unknown) => (typeof v === 'string' && HEX_COLOR.test(v) ? v : '');
  const d = DEFAULT_MESSAGE_CONFIG;

  return {
    title: str(r.title, MAX_TITLE_LENGTH),
    message: str(r.message, MAX_MESSAGE_LENGTH),
    titleSize: clamp(r.titleSize, TITLE_SIZE_RANGE.min, TITLE_SIZE_RANGE.max, d.titleSize),
    messageSize: clamp(r.messageSize, MESSAGE_SIZE_RANGE.min, MESSAGE_SIZE_RANGE.max, d.messageSize),
    titleColor: color(r.titleColor),
    messageColor: color(r.messageColor),
    align: r.align === 'left' || r.align === 'right' || r.align === 'center' ? r.align : d.align,
    bold: r.bold === true,
    italic: r.italic === true,
    font: r.font === 'serif' || r.font === 'mono' || r.font === 'sans' ? r.font : d.font,
  };
}

export function isSameConfig(a: MaintenanceMessageConfig, b: MaintenanceMessageConfig) {
  return JSON.stringify(sanitizeMessageConfig(a)) === JSON.stringify(sanitizeMessageConfig(b));
}

const FONT_FAMILY: Record<MessageFont, string> = {
  sans: 'inherit',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export function titleStyle(c: MaintenanceMessageConfig): CSSProperties {
  return {
    fontSize: `${c.titleSize}px`,
    lineHeight: 1.15,
    color: c.titleColor || undefined,
    textAlign: c.align,
    fontFamily: FONT_FAMILY[c.font],
    fontStyle: c.italic ? 'italic' : undefined,
    overflowWrap: 'anywhere',
  };
}

export function messageStyle(c: MaintenanceMessageConfig): CSSProperties {
  return {
    fontSize: `${c.messageSize}px`,
    lineHeight: 1.5,
    color: c.messageColor || undefined,
    textAlign: c.align,
    fontFamily: FONT_FAMILY[c.font],
    fontWeight: c.bold ? 700 : undefined,
    fontStyle: c.italic ? 'italic' : undefined,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  };
}
