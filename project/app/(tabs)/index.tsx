import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUserManager } from '@/hooks/useUserManager';
import { useMonitoringSystem } from '@/hooks/useMonitoringSystem';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useCache } from '@/hooks/useCache';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [currentTime, setCurrentTime] = useState(new Date());
  const [verseText, setVerseText] = useState('');
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const { currentUser, loading, refreshUser } = useUserManager();
  const { isInPenaltyPeriod } = useMonitoringSystem({ 
    currentUser,
    onPenaltyAdded: refreshUser
  });
  const { get: getCache, set: setCache } = useCache();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshUser();
    await checkTodaySubmission();
    setRefreshing(false);
  }, [refreshUser, checkTodaySubmission]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check if user has already submitted verse today
  const checkTodaySubmission = useCallback(async () => {
    if (!currentUser) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `verse_${currentUser.id}_${today}`;
      
      // Check cache first
      const cachedSubmission = getCache<boolean>(cacheKey);
      if (cachedSubmission !== null) {
        setHasSubmittedToday(cachedSubmission);
        return;
      }

      const { data, error } = await supabase
        .from('verses')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('submitted_date', today)
        .single();

      const hasSubmitted = !!data && !error;
      setHasSubmittedToday(hasSubmitted);
      
      // Cache the result for 5 minutes
      setCache(cacheKey, hasSubmitted, 5 * 60 * 1000);
    } catch (error) {
      console.error('Error checking today submission:', error);
    }
  }, [currentUser, getCache, setCache]);

  // Set up real-time updates
  useRealtimeUpdates({
    currentUser,
    onVerseUpdate: () => {
      checkTodaySubmission();
    },
  });

  useEffect(() => {
    if (currentUser) {
      checkTodaySubmission();
    }
  }, [currentUser, checkTodaySubmission]);

  const submitVerse = async () => {
    if (!currentUser || !verseText.trim()) {
      Alert.alert('Error', 'Please enter a Bible verse');
      return;
    }

    if (hasSubmittedToday) {
      Alert.alert('Already Submitted', 'You have already submitted a verse today');
      return;
    }

    // Check if it's past 10:30 PM
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    const cutoffTime = 22 * 60 + 30; // 10:30 PM

    if (currentTime >= cutoffTime) {
      Alert.alert(
        'Too Late!', 
        'Verse submission is not allowed after 10:30 PM. You will receive a penalty.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[now.getDay()];

      const { error } = await supabase
        .from('verses')
        .insert({
          user_id: currentUser.id,
          verse_text: verseText.trim(),
          day_name: dayName,
          submitted_date: now.toISOString().split('T')[0],
        });

      if (error) throw error;

      Alert.alert('Success', 'Bible verse submitted successfully!');
      setVerseText('');
      setHasSubmittedToday(true);
      
      // Update cache
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `verse_${currentUser.id}_${today}`;
      setCache(cacheKey, true, 5 * 60 * 1000);
    } catch (error) {
      console.error('Error submitting verse:', error);
      Alert.alert('Error', 'Failed to submit verse. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (date: Date) => {
    return {
      time: date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.centered}>
          <Text style={[styles.loadingText, isDark && styles.textDark]}>
            Loading GabLira...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { time, date } = formatTime(currentTime);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.deviceName, isDark && styles.textDark]}>
            {currentUser?.device_name || 'Unknown Device'}
          </Text>
          <View style={styles.penaltyContainer}>
            <View 
              style={[
                styles.penaltyBadge, 
                currentUser?.penalty_count === 0 
                  ? styles.penaltyGreen 
                  : styles.penaltyRed
              ]}
            >
              <Text style={styles.penaltyText}>
                {currentUser?.penalty_count || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Real-time Clock */}
        <View style={[styles.clockContainer, isDark && styles.clockContainerDark]}>
          <Text style={[styles.timeText, isDark && styles.textDark]}>
            {time}
          </Text>
          <Text style={[styles.dateText, isDark && styles.textDark]}>
            {date}
          </Text>
          
          {isInPenaltyPeriod && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ PENALTY PERIOD ACTIVE ⚠️
              </Text>
              <Text style={styles.warningSubtext}>
                10:30 PM - 5:30 AM
              </Text>
            </View>
          )}
        </View>

        {/* Verse Submission */}
        <View style={[styles.verseContainer, isDark && styles.verseContainerDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
            Daily Bible Verse
          </Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textDark]}>
            Submit before 10:30 PM to avoid penalties
          </Text>

          {hasSubmittedToday ? (
            <View style={styles.submittedContainer}>
              <Text style={styles.submittedText}>
                ✅ Verse submitted for today!
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                style={[
                  styles.verseInput, 
                  isDark && styles.verseInputDark
                ]}
                placeholder="Enter your Bible verse here..."
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                value={verseText}
                onChangeText={setVerseText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!verseText.trim() || isSubmitting) && styles.submitButtonDisabled
                ]}
                onPress={submitVerse}
                disabled={!verseText.trim() || isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Verse'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Status Indicator */}
        <View style={[styles.statusContainer, isDark && styles.statusContainerDark]}>
          <View style={styles.statusRow}>
            <View 
              style={[
                styles.statusDot, 
                currentUser?.is_online ? styles.onlineDot : styles.offlineDot
              ]}
            />
            <Text style={[styles.statusText, isDark && styles.textDark]}>
              {currentUser?.is_online ? 'Online' : 'Offline'}
            </Text>
          </View>
          <Text style={[styles.lastSeenText, isDark && styles.textDark]}>
            Last seen: {new Date(currentUser?.last_seen || '').toLocaleTimeString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 20,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  penaltyContainer: {
    alignItems: 'center',
  },
  penaltyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    minWidth: 30,
    alignItems: 'center',
  },
  penaltyGreen: {
    backgroundColor: '#10B981',
  },
  penaltyRed: {
    backgroundColor: '#EF4444',
  },
  penaltyText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  clockContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    marginBottom: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  clockContainerDark: {
    backgroundColor: '#1F2937',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  dateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  warningContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    alignItems: 'center',
  },
  warningText: {
    color: '#D97706',
    fontWeight: 'bold',
    fontSize: 14,
  },
  warningSubtext: {
    color: '#92400E',
    fontSize: 12,
    marginTop: 4,
  },
  verseContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  verseContainerDark: {
    backgroundColor: '#1F2937',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  submittedContainer: {
    padding: 20,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    alignItems: 'center',
  },
  submittedText: {
    color: '#065F46',
    fontSize: 16,
    fontWeight: '600',
  },
  verseInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#374151',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 16,
    minHeight: 100,
  },
  verseInputDark: {
    backgroundColor: '#374151',
    color: '#F9FAFB',
    borderColor: '#4B5563',
  },
  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusContainerDark: {
    backgroundColor: '#1F2937',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  onlineDot: {
    backgroundColor: '#10B981',
  },
  offlineDot: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  lastSeenText: {
    fontSize: 14,
    color: '#6B7280',
  },
  textDark: {
    color: '#F9FAFB',
  },
});