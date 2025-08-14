import { useEffect, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/database';

interface UseMonitoringSystemProps {
  currentUser: User | null;
  onPenaltyAdded?: () => void;
}

export function useMonitoringSystem({ currentUser, onPenaltyAdded }: UseMonitoringSystemProps) {
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const penaltyCheckRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastPingRef = useRef<number>(0);

  const isInPenaltyPeriod = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute; // Convert to minutes
    
    // 10:30 PM = 22:30 = 1350 minutes
    // 5:30 AM = 05:30 = 330 minutes
    const penaltyStart = 22 * 60 + 30; // 1350
    const penaltyEnd = 5 * 60 + 30; // 330
    
    // Check if current time is between 10:30 PM and 5:30 AM
    return currentTime >= penaltyStart || currentTime <= penaltyEnd;
  }, []);

  const addPenalty = useCallback(async () => {
    if (!currentUser || !isInPenaltyPeriod() || !isMountedRef.current) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if penalty already exists for today
      const { data: existingPenalty, error: checkError } = await supabase
        .from('penalties')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('penalty_date', today)
        .is('removed_by', null)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (!existingPenalty) {
        // Add new penalty
        const { error: insertError } = await supabase
          .from('penalties')
          .insert({
            user_id: currentUser.id,
            penalty_date: today,
          });

        if (insertError) throw insertError;

        // Update user penalty count
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            penalty_count: currentUser.penalty_count + 1 
          })
          .eq('id', currentUser.id);

        if (updateError) throw updateError;

        if (isMountedRef.current) {
          onPenaltyAdded?.();
        }
      }
    } catch (error) {
      console.error('Error adding penalty:', error);
    }
  }, [currentUser, isInPenaltyPeriod, onPenaltyAdded]);

  const pingServer = useCallback(async () => {
    if (!currentUser || !isMountedRef.current) return;

    // Prevent too frequent pings
    const now = Date.now();
    if (now - lastPingRef.current < 15000) { // Minimum 15 seconds between pings
      return;
    }
    lastPingRef.current = now;

    try {
      const startTime = Date.now();
      
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected && netInfo.isInternetReachable;
      
      if (isConnected) {
        // Ping supabase to check connectivity
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('id', currentUser.id)
          .single();

        const responseTime = Date.now() - startTime;

        // Log activity (only if significant change or error)
        if (error || responseTime > 1000) {
          await supabase
            .from('user_activity')
            .insert({
              user_id: currentUser.id,
              ping_timestamp: new Date().toISOString(),
              response_time: responseTime,
              is_online: !error,
            });
        }

        // Update user online status only if changed
        if (error !== null) {
          await supabase
            .from('users')
            .update({ 
              is_online: false,
              last_seen: new Date().toISOString() 
            })
            .eq('id', currentUser.id);
        } else {
          await supabase
            .from('users')
            .update({ 
              is_online: true,
              last_seen: new Date().toISOString() 
            })
            .eq('id', currentUser.id);
        }

        // Check if user should be penalized
        if (!error && isInPenaltyPeriod()) {
          await addPenalty();
        }
      } else {
        // User is offline
        await supabase
          .from('users')
          .update({ 
            is_online: false,
            last_seen: new Date().toISOString() 
          })
          .eq('id', currentUser.id);
      }
    } catch (error) {
      console.error('Ping error:', error);
    }
  }, [currentUser, isInPenaltyPeriod, addPenalty]);

  const startMonitoring = useCallback(() => {
    // Clear existing intervals
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (penaltyCheckRef.current) {
      clearInterval(penaltyCheckRef.current);
    }

    // Start ping monitoring every 30 seconds (increased from 10)
    pingIntervalRef.current = setInterval(pingServer, 30000);
    
    // Check penalty period every 2 minutes (increased from 1)
    penaltyCheckRef.current = setInterval(() => {
      if (isInPenaltyPeriod()) {
        addPenalty();
      }
    }, 120000);

    // Initial ping
    pingServer();
  }, [pingServer, addPenalty, isInPenaltyPeriod]);

  const stopMonitoring = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (penaltyCheckRef.current) {
      clearInterval(penaltyCheckRef.current);
      penaltyCheckRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!currentUser) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        startMonitoring();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        stopMonitoring();
      }
    };

    // Start monitoring when user is available
    startMonitoring();

    // Listen to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      stopMonitoring();
      subscription?.remove();
      isMountedRef.current = false;
    };
  }, [currentUser, startMonitoring, stopMonitoring]);

  return {
    isInPenaltyPeriod: isInPenaltyPeriod(),
    startMonitoring,
    stopMonitoring,
  };
}