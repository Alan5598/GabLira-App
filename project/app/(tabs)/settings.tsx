import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  useColorScheme,
  Switch,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/database';
import { useUserManager } from '@/hooks/useUserManager';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useCache } from '@/hooks/useCache';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');
  const [showUserModal, setShowUserModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const { currentUser, refreshUser } = useUserManager();
  const { get: getCache, set: setCache } = useCache();

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  useEffect(() => {
    loadThemePreference();
  }, []);

  // Set up real-time updates
  useRealtimeUpdates({
    currentUser,
    onUsersListUpdate: () => {
      if (showUserModal) {
        loadUsers();
      }
    },
  });

  useEffect(() => {
    if (showUserModal) {
      // Load users immediately when modal opens
      loadUsers();
    }
  }, [showUserModal]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    try {
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const loadUsers = useCallback(async () => {
    try {
      // Check cache first
      const cachedUsers = getCache<User[]>('users_list');
      if (cachedUsers && !refreshing) {
        setUsers(cachedUsers);
        return;
      }

      if (!refreshing) {
        setLoading(true);
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('device_name');

      if (error) throw error;
      
      const usersData = data || [];
      setUsers(usersData);
      
      // Cache the users list for 1 minute
      setCache('users_list', usersData, 60 * 1000);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      if (!refreshing) {
        setLoading(false);
      }
    }
  }, [getCache, setCache, refreshing]);

  const reducePenalty = async (user: User) => {
    if (!currentUser) return;
    
    // Allow users to reduce penalties for others (removed restriction)
    if (user.penalty_count === 0) {
      Alert.alert('No Penalties', 'This user has no penalties to reduce');
      return;
    }

    if (user.penalty_count === 0) {
      Alert.alert('No Penalties', 'This user has no penalties to reduce');
      return;
    }

    Alert.alert(
      'Reduce Penalty',
      `Reduce one penalty for ${user.device_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reduce',
          onPress: async () => {
            try {
              // Find the most recent unreduced penalty
              const { data: penalty, error: findError } = await supabase
                .from('penalties')
                .select('*')
                .eq('user_id', user.id)
                .is('removed_by', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (findError && findError.code !== 'PGRST116') {
                throw findError;
              }

              if (!penalty) {
                Alert.alert('Error', 'No penalties found to reduce');
                return;
              }

              // Mark penalty as removed
              const { error: updatePenaltyError } = await supabase
                .from('penalties')
                .update({
                  removed_by: currentUser.id,
                  removed_at: new Date().toISOString(),
                })
                .eq('id', penalty.id);

              if (updatePenaltyError) throw updatePenaltyError;

              // Update user penalty count
              const { error: updateUserError } = await supabase
                .from('users')
                .update({
                  penalty_count: Math.max(0, user.penalty_count - 1),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

              if (updateUserError) throw updateUserError;

              Alert.alert('Success', 'Penalty reduced successfully!');
              await loadUsers(); // Refresh the list
              await refreshUser(); // Refresh current user data
            } catch (error) {
              console.error('Error reducing penalty:', error);
              Alert.alert('Error', 'Failed to reduce penalty');
            }
          },
        },
      ]
    );
  };

  const openUserModal = () => {
    loadUsers();
    setShowUserModal(true);
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <View style={[styles.userItem, isDarkMode && styles.userItemDark]}>
      <View style={styles.userInfo}>
        <Text style={[styles.userName, isDarkMode && styles.textDark]}>
          {item.device_name}
        </Text>
        <View style={styles.userStats}>
          <View 
            style={[
              styles.statusDot, 
              item.is_online ? styles.onlineDot : styles.offlineDot
            ]}
          />
          <Text style={[styles.statusText, isDarkMode && styles.textDark]}>
            {item.is_online ? 'Online' : 'Offline'}
          </Text>
          <Text style={[styles.penaltyCount, isDarkMode && styles.textDark]}>
            Penalties: {item.penalty_count}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={[
          styles.reduceButton,
          (item.penalty_count === 0 || item.id === currentUser?.id) && styles.reduceButtonDisabled
        ]}
        onPress={() => reducePenalty(item)}
        disabled={item.penalty_count === 0 || item.id === currentUser?.id}
      >
        <Text style={styles.reduceButtonText}>
          {item.id === currentUser?.id ? 'You' : 'Reduce'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && styles.textDark]}>
          Settings
        </Text>
        <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>
          Customize your GabLira experience
        </Text>
      </View>

      <View style={styles.content}>
        {/* Theme Toggle */}
        <View style={[styles.settingCard, isDarkMode && styles.settingCardDark]}>
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>
                Dark Mode
              </Text>
              <Text style={[styles.settingSubtitle, isDarkMode && styles.textDark]}>
                Toggle between light and dark theme
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E5E7EB', true: '#059669' }}
              thumbColor={isDarkMode ? '#10B981' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* User Management */}
        <TouchableOpacity
          style={[styles.settingCard, isDarkMode && styles.settingCardDark]}
          onPress={openUserModal}
        >
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>
                Manage User Penalties
              </Text>
              <Text style={[styles.settingSubtitle, isDarkMode && styles.textDark]}>
                View all users and reduce their penalties
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </View>
        </TouchableOpacity>

        {/* App Info */}
        <View style={[styles.settingCard, isDarkMode && styles.settingCardDark]}>
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>
                GabLira
              </Text>
              <Text style={[styles.settingSubtitle, isDarkMode && styles.textDark]}>
                Version 2.0.1 - Student Internet Monitor
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* User Management Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDarkMode && styles.textDark]}>
              User Penalties
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowUserModal(false)}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.usersList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, isDarkMode && styles.textDark]}>
                  No users found
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
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
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 10,
  },
  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingCardDark: {
    backgroundColor: '#1F2937',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  arrow: {
    fontSize: 18,
    color: '#6B7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalContainerDark: {
    backgroundColor: '#111827',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#374151',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  usersList: {
    padding: 20,
  },
  userItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userItemDark: {
    backgroundColor: '#1F2937',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  onlineDot: {
    backgroundColor: '#10B981',
  },
  offlineDot: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
  },
  penaltyCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  reduceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  reduceButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  reduceButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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