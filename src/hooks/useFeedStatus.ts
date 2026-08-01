import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FeedStatus } from '../components/FeedStatusBadge';

const FEED_CHECK_INTERVAL = 30000;
const FEED_TIMEOUT_MS = 900000;

export function useFeedStatus(): FeedStatus {
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('checking');

  useEffect(() => {
    const checkFeedStatus = async (): Promise<void> => {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - FEED_TIMEOUT_MS).toISOString();

        const { data, error } = await supabase
          .from('detections')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          setFeedStatus('disconnected');
          return;
        }

        if (data && data.created_at >= fifteenMinutesAgo) {
          setFeedStatus('connected');
        } else {
          setFeedStatus('disconnected');
        }
      } catch {
        setFeedStatus('disconnected');
      }
    };

    checkFeedStatus();

    const interval = setInterval(checkFeedStatus, FEED_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return feedStatus;
}
