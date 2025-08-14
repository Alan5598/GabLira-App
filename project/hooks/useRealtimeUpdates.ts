import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/database';

interface UseRealtimeUpdatesProps {
  currentUser: User | null;
  onUserUpdate?: (user: User) => void;
  onUsersListUpdate?: () => void;
  onVerseUpdate?: () => void;
}

export function useRealtimeUpdates({
  currentUser,
  onUserUpdate,
  onUsersListUpdate,
  onVerseUpdate,
}: UseRealtimeUpdatesProps) {
  const subscriptionsRef = useRef<any[]>([]);

  const setupSubscriptions = useCallback(() => {
    // Clear existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];

    // Subscribe to user updates
    const userSubscription = supabase
      .channel('user_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedUser = payload.new as User;
            if (currentUser && updatedUser.id === currentUser.id) {
              onUserUpdate?.(updatedUser);
            }
            onUsersListUpdate?.();
          } else if (payload.eventType === 'INSERT') {
            onUsersListUpdate?.();
          }
        }
      )
      .subscribe();

    // Subscribe to verse updates
    const verseSubscription = supabase
      .channel('verse_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'verses',
        },
        () => {
          onVerseUpdate?.();
        }
      )
      .subscribe();

    // Subscribe to penalty updates
    const penaltySubscription = supabase
      .channel('penalty_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'penalties',
        },
        () => {
          onUsersListUpdate?.();
          if (currentUser) {
            onUserUpdate?.({ ...currentUser });
          }
        }
      )
      .subscribe();

    subscriptionsRef.current = [userSubscription, verseSubscription, penaltySubscription];
  }, [currentUser, onUserUpdate, onUsersListUpdate, onVerseUpdate]);

  useEffect(() => {
    setupSubscriptions();

    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    };
  }, [setupSubscriptions]);

  return {
    subscriptions: subscriptionsRef.current,
  };
}