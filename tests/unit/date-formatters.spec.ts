import { expect, test } from '@playwright/test';
import { dateFormatter, refreshDateFormatters } from '../../src/utils/dateFormatters';

test('shares equivalent date formatters while preserving locale and options', () => {
  refreshDateFormatters();
  const first = dateFormatter({ month: 'short', day: 'numeric' }, 'en-US');
  expect(dateFormatter({ day: 'numeric', month: 'short' }, 'en-US')).toBe(first);
  expect(dateFormatter({ month: 'short', day: 'numeric' }, 'pt-PT')).not.toBe(first);
  expect(dateFormatter({ month: 'long', day: 'numeric' }, 'en-US')).not.toBe(first);
  expect(first.format(new Date(2026, 0, 15))).toBe('Jan 15');
});

test('refreshes default-locale formatters after a locale lifecycle change', () => {
  const first = dateFormatter({ month: 'short', day: 'numeric' });
  refreshDateFormatters();
  const next = dateFormatter({ month: 'short', day: 'numeric' });
  expect(next).not.toBe(first);
  expect(next.format(new Date(2026, 0, 15))).toBe(first.format(new Date(2026, 0, 15)));
});
