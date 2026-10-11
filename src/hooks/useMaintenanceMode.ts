import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MaintenanceMessageConfig, sanitizeMessageConfig } from '@/lib/maintenanceMessage';

interface MaintenanceMode {
  enabled: boolean;
  allowed_emails: string[];
  custom_message?: MaintenanceMessageConfig;
}

const KEY = 'maintenance_mode';

export function useMaintenanceMode() {
  const [maintenance, setMaintenance] = useState<MaintenanceMode>({ enabled: false, allowed_emails: [] });
  const [loading, setLoading] = useState(true);

  const parse = (raw: any): MaintenanceMode => ({
    enabled: raw?.enabled ?? false,
    allowed_emails: Array.isArray(raw?.allowed_emails) ? raw.allowed_emails : [],
    custom_message: raw?.custom_message ? sanitizeMessageConfig(raw.custom_message) : undefined,
  });

  const fetchMaintenance = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', KEY)
        .maybeSingle();

      if (error) throw error;
      if (data?.value) setMaintenance(parse(data.value));
    } catch (err) {
      console.warn('Failed to fetch maintenance mode:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Read the latest stored value, merge a patch into it, and save.
   * Merging against the database copy (not React state) means a save can never
   * drop other fields (whitelist, message) or overwrite another admin's change.
   */
  const writeValue = async (patch: Partial<MaintenanceMode>) => {
    const { data: current, error: readError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();
    if (readError) throw readError;

    const merged = { ...((current?.value as object | null) ?? {}), ...patch };
    const now = new Date().toISOString();

    if (current) {
      const { data: updated, error } = await supabase
        .from('app_settings')
        .update({ value: merged as any, updated_at: now })
        .eq('key', KEY)
        .select('key');
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error('Not allowed to update maintenance settings');
    } else {
      const { error } = await supabase.from('app_settings').insert({ key: KEY, value: merged as any });
      if (error) throw error;
    }
    setMaintenance(parse(merged));
  };

  const toggleMaintenance = (enabled: boolean) => writeValue({ enabled });

  const updateAllowedEmails = (emails: string[]) => writeValue({ allowed_emails: emails });

  const updateCustomMessage = (config: MaintenanceMessageConfig) =>
    writeValue({ custom_message: sanitizeMessageConfig(config) });

  useEffect(() => {
    fetchMaintenance();
  }, [fetchMaintenance]);

  return {
    maintenance,
    loading,
    toggleMaintenance,
    updateAllowedEmails,
    updateCustomMessage,
    refetch: fetchMaintenance,
  };
}
