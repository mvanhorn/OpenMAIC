'use client';

import { useState, useCallback, useMemo } from 'react';
import { Volume2, Play, Loader2, MonitorSpeaker, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { getTTSVoices } from '@/lib/audio/constants';
import {
  BROWSER_NATIVE_TTS_PROVIDER_ID,
  hasAnyEnabledTTSProvider,
} from '@/lib/audio/provider-enablement';
import { openSettings } from '@/lib/ui/open-settings';
import { useTTSPreview } from '@/lib/audio/use-tts-preview';
import {
  getVoxCPMProviderOptions,
  getVoxCPMVoiceOptions,
  useVoxCPMVoiceProfiles,
} from '@/lib/audio/voxcpm-voices';
import {
  VOXCPM_AUTO_VOICE_ID,
  normalizeVoxCPMBackend,
  voxCPMBackendSupportsReferenceAudio,
} from '@/lib/audio/voxcpm';

/** Extract the English name from voice name format "ChineseName (English)" */
function getVoiceDisplayName(
  id: string,
  name: string,
  lang: string,
  t: (key: string) => string,
): string {
  if (id === VOXCPM_AUTO_VOICE_ID) {
    return t('settings.voxcpmAutoVoice');
  }
  if (lang === 'en-US') {
    const match = name.match(/\(([^)]+)\)/);
    return match ? match[1] : name;
  }
  return name;
}

export function TtsConfigPopover() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const { previewing, startPreview, stopPreview } = useTTSPreview();

  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const setTTSEnabled = useSettingsStore((s) => s.setTTSEnabled);
  const ttsProviderId = useSettingsStore((s) => s.ttsProviderId);
  const ttsVoice = useSettingsStore((s) => s.ttsVoice);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const setTTSVoice = useSettingsStore((s) => s.setTTSVoice);
  const setTTSProvider = useSettingsStore((s) => s.setTTSProvider);
  const setTTSProviderConfig = useSettingsStore((s) => s.setTTSProviderConfig);
  const { profiles: voxcpmProfiles } = useVoxCPMVoiceProfiles();
  const voxcpmBackend = normalizeVoxCPMBackend(
    ttsProvidersConfig['voxcpm-tts']?.providerOptions?.backend,
  );

  const voices =
    ttsProviderId === 'voxcpm-tts'
      ? getVoxCPMVoiceOptions(voxcpmProfiles, {
          supportsClone: voxCPMBackendSupportsReferenceAudio(voxcpmBackend),
        })
      : getTTSVoices(ttsProviderId);
  const localizedVoices = useMemo(
    () =>
      voices.map((v) => ({
        ...v,
        displayName: getVoiceDisplayName(v.id, v.name, locale, t),
      })),
    [voices, locale, t],
  );

  const pillCls =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer select-none whitespace-nowrap border';
  const canPreview = ttsProviderId !== 'voxcpm-tts' || ttsVoice !== VOXCPM_AUTO_VOICE_ID;

  // No provider enabled/available ⇒ audio is effectively off; show a CTA instead
  // of silently falling back to browser-native (#665).
  const hasEnabledProvider = hasAnyEnabledTTSProvider(ttsProvidersConfig);
  const browserNativeServerDisabled =
    !!ttsProvidersConfig[BROWSER_NATIVE_TTS_PROVIDER_ID]?.serverDisabled;
  const effectiveOn = ttsEnabled && hasEnabledProvider;

  const handleEnableBrowserNative = useCallback(() => {
    setTTSProviderConfig(BROWSER_NATIVE_TTS_PROVIDER_ID, { enabled: true });
    setTTSProvider(BROWSER_NATIVE_TTS_PROVIDER_ID);
    setTTSVoice('default');
    setTTSEnabled(true);
  }, [setTTSProviderConfig, setTTSProvider, setTTSVoice, setTTSEnabled]);

  const handlePreview = useCallback(async () => {
    if (previewing) {
      stopPreview();
      return;
    }
    if (!canPreview) {
      toast.info(t('settings.voxcpmAutoVoiceNoPreview'));
      return;
    }
    try {
      const providerConfig = ttsProvidersConfig[ttsProviderId];
      const providerOptions =
        ttsProviderId === 'voxcpm-tts'
          ? {
              ...(providerConfig?.providerOptions || {}),
              ...(await getVoxCPMProviderOptions(ttsVoice, { role: 'teacher', locale })),
            }
          : undefined;
      await startPreview({
        text: t('settings.ttsTestTextDefault'),
        providerId: ttsProviderId,
        modelId: providerConfig?.modelId,
        voice: ttsVoice,
        speed: ttsSpeed,
        apiKey: providerConfig?.apiKey,
        // Managed providers resolve their base URL server-side; only send the
        // client's own base URL (custom providers).
        baseUrl: providerConfig?.baseUrl || providerConfig?.customDefaultBaseUrl,
        providerOptions,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : t('settings.ttsTestFailed');
      toast.error(message);
    }
  }, [
    previewing,
    canPreview,
    startPreview,
    stopPreview,
    t,
    locale,
    ttsProviderId,
    ttsProvidersConfig,
    ttsSpeed,
    ttsVoice,
  ]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        stopPreview();
      }
      setOpen(nextOpen);
    },
    [stopPreview],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className={cn(
                pillCls,
                effectiveOn
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-700/50'
                  : 'border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60',
              )}
            >
              <Volume2 className="size-3.5" />
              {effectiveOn && (
                <span className="max-w-[60px] truncate">
                  {localizedVoices.find((v) => v.id === ttsVoice)?.displayName || ttsVoice}
                </span>
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('toolbar.ttsHint')}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-[280px] p-0">
        {/* Header with toggle */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border/40">
          <Volume2
            className={cn(
              'size-4 shrink-0',
              effectiveOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          />
          <span
            className={cn('flex-1 text-sm font-medium', !effectiveOn && 'text-muted-foreground')}
          >
            {t('toolbar.ttsTitle')}
          </span>
          <Switch
            checked={ttsEnabled}
            onCheckedChange={setTTSEnabled}
            className="scale-[0.85] origin-right"
          />
        </div>

        {/* Empty state: no provider enabled/available — CTA instead of silent
            fallback (#665). */}
        {!hasEnabledProvider ? (
          <div className="px-3.5 py-3.5 space-y-2.5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('toolbar.ttsNoProviderDesc')}
            </p>
            <button
              type="button"
              onClick={handleEnableBrowserNative}
              disabled={browserNativeServerDisabled}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                browserNativeServerDisabled
                  ? 'cursor-not-allowed bg-muted/50 text-muted-foreground/60'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600/90 dark:hover:bg-emerald-600',
              )}
            >
              <MonitorSpeaker className="size-3.5" />
              {t('toolbar.ttsEnableBrowserNative')}
            </button>
            {browserNativeServerDisabled && (
              <p className="text-[11px] text-muted-foreground/70">
                {t('toolbar.ttsBrowserNativeDisabledByAdmin')}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openSettings('tts');
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Settings2 className="size-3.5" />
              {t('toolbar.ttsConfigureProvider')}
            </button>
          </div>
        ) : ttsEnabled ? (
          <div className="px-3.5 py-3 space-y-3">
            {/* Voice + Preview row */}
            <div className="flex items-center gap-2">
              <Select value={ttsVoice} onValueChange={setTTSVoice}>
                <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {localizedVoices.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={handlePreview}
                disabled={!canPreview}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all shrink-0',
                  !canPreview && 'cursor-not-allowed opacity-50',
                  previewing
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {previewing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Play className="size-3" />
                )}
                {previewing ? t('toolbar.ttsPreviewing') : t('toolbar.ttsPreview')}
              </button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
