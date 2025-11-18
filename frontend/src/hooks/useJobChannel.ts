import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface JobStatusPayload {
  job_id: string;
  status: string;
  timestamp: string;
  message?: string;
}

export interface JobProgressPayload {
  job_id: string;
  total_urls: number;
  processed_urls: number;
  success_count: number;
  error_count: number;
  current_url?: string;
  timestamp: string;
}

export interface ItemExtractedPayload {
  job_id: string;
  item_id: string;
  url: string;
  content_type: string;
  timestamp: string;
}

export type JobEvent =
  | { event: 'status'; payload: JobStatusPayload }
  | { event: 'progress'; payload: JobProgressPayload }
  | { event: 'item_extracted'; payload: ItemExtractedPayload };

export function useJobChannel(jobId: string | null) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const jobChannel = supabase.channel(`jobs.${jobId}`);

    jobChannel
      .on('broadcast', { event: 'status' }, (payload) => {
        setEvents((prev) => [
          ...prev,
          { event: 'status', payload: payload.payload as JobStatusPayload },
        ]);
      })
      .on('broadcast', { event: 'progress' }, (payload) => {
        setEvents((prev) => [
          ...prev,
          { event: 'progress', payload: payload.payload as JobProgressPayload },
        ]);
      })
      .on('broadcast', { event: 'item_extracted' }, (payload) => {
        setEvents((prev) => [
          ...prev,
          { event: 'item_extracted', payload: payload.payload as ItemExtractedPayload },
        ]);
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    setChannel(jobChannel);

    return () => {
      jobChannel.unsubscribe();
      supabase.removeChannel(jobChannel);
    };
  }, [jobId]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { channel, events, connected, clearEvents };
}
