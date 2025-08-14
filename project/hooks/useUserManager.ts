import { useState, useEffect, useCallback } from 'react';
import { useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/database';
import { useDeviceInfo } from './useDeviceInfo';
import { useCache } from './useCache';

export function useUserManager() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const { deviceName } = useDeviceInfo();
  const { get: getCache, set: setCache } = useCache();

  const initializeUser = useCallback(async () => {
    if (!deviceName || deviceName === 'Unknown Device') return;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      // Check cache first
      const cacheKey = `user_${deviceName}`;
      const cachedUser = getCache<User>(cacheKey);
      
      if (cachedUser) {
        if (isMountedRef.current) {
          setCurrentUser(cachedUser);
          setLoading(false);
        }
        return;
      }
      
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('device_name', deviceName)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingUser) {
        // Update last_seen and is_online
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ 
            last_seen: new Date().toISOString(),
            is_online: true 
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) throw updateError;
        
        // Cache the user data
        setCache(cacheKey, updatedUser, 2 * 60 * 1000); // 2 minutes cache
        
        if (isMountedRef.current) {
          setCurrentUser(updatedUser);
        }
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            device_name: deviceName,
            is_online: true,
            last_seen: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;
        
        // Cache the new user data
        setCache(cacheKey, newUser, 2 * 60 * 1000); // 2 minutes cache
        
        if (isMountedRef.current) {
          setCurrentUser(newUser);
        }
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [deviceName, getCache, setCache]);

  const updateUserStatus = useCallback(async (isOnline: boolean) => {
    if (!currentUser) return;

    try {
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ 
          is_online: isOnline,
          last_seen: new Date().toISOString() 
        })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) throw error;
      
      // Update cache
      const cacheKey = `user_${currentUser.device_name}`;
      setCache(cacheKey, updatedUser, 2 * 60 * 1000);
      
      if (isMountedRef.current) {
        setCurrentUser(updatedUser);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  }, [currentUser, setCache]);

  const refreshUser = useCallback(async () => {
    // Clear cache and reinitialize
    const cacheKey = `user_${deviceName}`;
    setCache(cacheKey, null, 0);
    await initializeUser();
  }, [deviceName, setCache, initializeUser]);

  useEffect(() => {
    isMountedRef.current = true;
    initializeUser();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [initializeUser]);

  return {
    currentUser,
    loading,
    updateUserStatus,
    refreshUser,
  };
}