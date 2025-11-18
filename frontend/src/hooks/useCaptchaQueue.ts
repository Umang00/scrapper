import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface CaptchaPayload {
  captcha_id: string;
  job_id: string;
  captcha_type: string;
  source_platform: string;
  url: string;
  screenshot_url?: string;
  site_key?: string;
  timeout_at: string;
  timestamp: string;
}

export function useCaptchaQueue() {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [captchas, setCaptchas] = useState<CaptchaPayload[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const captchaChannel = supabase.channel('captcha_queue');

    captchaChannel
      .on('broadcast', { event: 'new_captcha' }, (payload) => {
        setCaptchas((prev) => [...prev, payload.payload as CaptchaPayload]);
      })
      .on('broadcast', { event: 'captcha_solved' }, (payload) => {
        const { captcha_id } = payload.payload as { captcha_id: string };
        setCaptchas((prev) => prev.filter((c) => c.captcha_id !== captcha_id));
      })
      .on('broadcast', { event: 'captcha_timeout' }, (payload) => {
        const { captcha_id } = payload.payload as { captcha_id: string };
        setCaptchas((prev) => prev.filter((c) => c.captcha_id !== captcha_id));
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    setChannel(captchaChannel);

    return () => {
      captchaChannel.unsubscribe();
      supabase.removeChannel(captchaChannel);
    };
  }, []);

  return { channel, captchas, connected };
}
