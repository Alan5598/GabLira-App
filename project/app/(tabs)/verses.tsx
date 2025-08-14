import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  useColorScheme,
  RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Verse, User } from '@/types/database';

interface VerseWithUser extends Verse {
  users: User | null;
}

export default function VersesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [verses, setVerses] = useState<VerseWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadVerses();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadVerses, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVerses();
    setRefreshing(false);
  };

  const loadVerses = async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      
      const { data, error } = await supabase
        .from('verses')
        .select(`
          *,
          users (
            device_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVerses(data as VerseWithUser[] || []);
    } catch (error) {
      console.error('Error loading verses:', error);
    } finally {
      if (!refreshing) {
        setLoading(false);
      }
    }
  };

  const groupVersesByDay = () => {
    const grouped: { [key: string]: VerseWithUser[] } = {};
    
    verses.forEach(verse => {
      const day = verse.day_name;
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(verse);
    });

    return grouped;
  };

  const renderVerseItem = ({ item }: { item: VerseWithUser }) => (
    <View style={[styles.verseCard, isDark && styles.verseCardDark]}>
      <Text style={[styles.verseText, isDark && styles.textDark]}>
        {item.verse_text}
      </Text>
      <View style={styles.verseFooter}>
        <Text style={[styles.authorText, isDark && styles.textDark]}>
          - {item.users?.device_name || 'Unknown User'}
        </Text>
        <Text style={[styles.dateText, isDark && styles.textDark]}>
          {new Date(item.submitted_date).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  const renderDaySection = (day: string, dayVerses: VerseWithUser[]) => (
    <View key={day} style={styles.daySection}>
      <Text style={[styles.dayHeader, isDark && styles.textDark]}>
        {day}
      </Text>
      {dayVerses.map((verse, index) => (
        <View key={verse.id} style={[styles.verseCard, isDark && styles.verseCardDark]}>
          <Text style={[styles.verseText, isDark && styles.textDark]}>
            {verse.verse_text}
          </Text>
          <View style={styles.verseFooter}>
            <Text style={[styles.authorText, isDark && styles.textDark]}>
              - {verse.users?.device_name || 'Unknown User'}
            </Text>
            <Text style={[styles.dateText, isDark && styles.textDark]}>
              {new Date(verse.submitted_date).toLocaleDateString()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.centered}>
          <Text style={[styles.loadingText, isDark && styles.textDark]}>
            Loading verses...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupedVerses = groupVersesByDay();
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.textDark]}>
          Daily Verses
        </Text>
        <Text style={[styles.subtitle, isDark && styles.textDark]}>
          Bible verses submitted by students
        </Text>
      </View>

      <FlatList
        data={dayOrder.filter(day => groupedVerses[day])}
        renderItem={({ item: day }) => renderDaySection(day, groupedVerses[day])}
        keyExtractor={(day) => day}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isDark && styles.textDark]}>
              No verses have been submitted yet
            </Text>
          </View>
        }
      />
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
  header: {
    padding: 20,
    paddingBottom: 10,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
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
  daySection: {
    marginBottom: 30,
  },
  dayHeader: {
    fontSize: 22,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 15,
    textAlign: 'center',
  },
  verseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verseCardDark: {
    backgroundColor: '#1F2937',
  },
  verseText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  verseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  authorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  textDark: {
    color: '#F9FAFB',
  },
});