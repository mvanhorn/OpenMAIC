/**
 * Cross-component "open the Settings dialog" signal.
 *
 * The Settings dialog is owned by page-level components via local state, so
 * deeply-nested UI (e.g. the TTS toolbar CTA) can't open it directly. They
 * dispatch this event instead; a page-level listener opens the dialog at the
 * requested section.
 */
import type { SettingsSection } from '@/lib/types/settings';

export const OPEN_SETTINGS_EVENT = 'openmaic:open-settings';

export interface OpenSettingsDetail {
  section?: SettingsSection;
}

/** Request the Settings dialog to open, optionally at a specific section. */
export function openSettings(section?: SettingsSection): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OpenSettingsDetail>(OPEN_SETTINGS_EVENT, { detail: { section } }),
  );
}
