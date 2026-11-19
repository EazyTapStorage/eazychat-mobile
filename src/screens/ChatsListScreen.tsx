import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getChats, getUsers, createDirectChat, createGroupChat } from '../services/api';
import { getSocket } from '../services/socket';
import { Chat, User, RootStackParamList } from '../types';
import { COLORS } from '../config';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatsList'>;

export const ChatsListScreen: React.FC<Props> = ({ navigation }) => {
  const { user, theme, toggleTheme } = useAuth();
  const palette = COLORS[theme];

  const [chats, setChats] = useState<Chat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'groups'>('all');

  // New Chat Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState<'direct' | 'group'>('direct');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fetchChats = useCallback(async () => {
    try {
      const data = await getChats();
      setChats(data.chats || []);
    } catch (err: any) {
      // console.warn('Error fetching chats:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessageNew = ({ chatId, message }: { chatId: string; message: any }) => {
      setChats(prev => {
        const idx = prev.findIndex(c => c.id === chatId);
        if (idx >= 0) {
          const updated = [...prev];
          const chat = { ...updated[idx] };
          chat.lastMessage = message;
          chat.updatedAt = message.createdAt;
          if (message.senderId !== user?.id) {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
          }
          updated[idx] = chat;
          updated.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
          return updated;
        } else {
          fetchChats();
          return prev;
        }
      });
    };

    const onPresenceUpdate = ({ userId, online, lastSeen }: { userId: string; online: boolean; lastSeen: string }) => {
      setChats(prev => prev.map(c => {
        if (!c.isGroup && c.otherUserId === userId) {
          return { ...c, online, lastSeen };
        }
        return c;
      }));
    };

    const onChatCreated = (newChat: Chat) => {
      setChats(prev => [newChat, ...prev.filter(c => c.id !== newChat.id)]);
    };

    socket.on('message:new', onMessageNew);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('chat:created', onChatCreated);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('chat:created', onChatCreated);
    };
  }, [user?.id, fetchChats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChats();
    setRefreshing(false);
  };

  const openNewChatModal = async () => {
    setModalVisible(true);
    setLoadingUsers(true);
    try {
      const data = await getUsers();
      setAvailableUsers(data.users || []);
    } catch {
      Alert.alert('Error', 'Unable to load user directory.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const startDirectChat = async (targetUser: User) => {
    try {
      const { chat } = await createDirectChat(targetUser.id);
      setModalVisible(false);
      setChats(prev => [chat, ...prev.filter(c => c.id !== chat.id)]);
      navigation.navigate('Conversation', {
        chatId: chat.id,
        name: targetUser.name,
        isGroup: false,
        otherUserId: targetUser.id,
        color: targetUser.color
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start conversation.');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required', 'Please enter a group name.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      Alert.alert('Required', 'Select at least one member.');
      return;
    }
    setCreatingGroup(true);
    try {
      const { chat } = await createGroupChat(groupName.trim(), selectedMemberIds);
      setModalVisible(false);
      setGroupName('');
      setSelectedMemberIds([]);
      setChats(prev => [chat, ...prev.filter(c => c.id !== chat.id)]);
      navigation.navigate('Conversation', {
        chatId: chat.id,
        name: chat.name,
        isGroup: true,
        color: chat.color
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredChats = chats.filter(c => {
    if (activeTab === 'unread' && (c.unreadCount || 0) <= 0) return false;
    if (activeTab === 'groups' && !c.isGroup) return false;
    if (searchQuery.trim() && !c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Custom Top Navigation Bar */}
      <View style={[styles.topBar, { backgroundColor: palette.headerBg, borderColor: palette.border }]}>
        <View style={styles.topBarLeft}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{user?.name?.slice(0, 2).toUpperCase() || 'EC'}</Text>
          </View>
          <Text style={[styles.appTitle, { color: palette.text }]}>Eazychat</Text>
        </View>
        <View style={styles.topBarActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={palette.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={palette.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      <View style={[styles.searchWrapper, { backgroundColor: palette.headerBg }]}>
        <View style={[styles.searchBox, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
          <Ionicons name="search-outline" size={18} color={palette.textSub} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={palette.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={palette.textSub} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterRow, { borderBottomColor: palette.border }]}>
        {(['all', 'unread', 'groups'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterPill, activeTab === tab && { backgroundColor: 'rgba(0, 168, 132, 0.15)' }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.filterPillText, { color: activeTab === tab ? COLORS.primary : palette.textSub }]}>
              {tab === 'all' ? 'All' : tab === 'unread' ? 'Unread' : 'Groups'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chats FlatList */}
      <FlatList
        data={filteredChats}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={palette.textSub} />
            <Text style={[styles.emptyText, { color: palette.textSub }]}>
              No conversations found.{'\n'}Tap the + button below to start messaging.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const lastMsg = item.lastMessage;
          let preview = 'No messages yet';
          if (lastMsg) {
            if (lastMsg.type === 'image') preview = '📷 Photo';
            else if (lastMsg.type === 'audio') preview = `🎤 Voice Note (${lastMsg.duration ? `${lastMsg.duration}s` : ''})`;
            else preview = lastMsg.text;
          }

          return (
            <TouchableOpacity
              style={[styles.chatItem, { borderBottomColor: palette.border }]}
              onPress={() => navigation.navigate('Conversation', {
                chatId: item.id,
                name: item.name,
                isGroup: item.isGroup,
                otherUserId: item.otherUserId,
                color: item.color
              })}
            >
              <View style={[styles.avatar, { backgroundColor: item.color || COLORS.primary }]}>
                <Text style={styles.avatarText}>{item.name?.slice(0, 2).toUpperCase() || 'EC'}</Text>
                {!item.isGroup && item.online && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.chatDetails}>
                <View style={styles.chatHeader}>
                  <Text style={[styles.chatName, { color: palette.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.timestamp, { color: palette.textSub }]}>
                    {formatTimestamp(lastMsg?.createdAt)}
                  </Text>
                </View>

                <View style={styles.previewRow}>
                  <Text style={[styles.previewText, { color: palette.textSub }]} numberOfLines={1}>
                    {preview}
                  </Text>
                  {(item.unreadCount || 0) > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating Action Button (New Chat) */}
      <TouchableOpacity style={styles.fab} onPress={openNewChatModal}>
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* New Conversation Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>New Conversation</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={palette.textSub} />
              </TouchableOpacity>
            </View>

            <View style={[styles.segmentedRow, { backgroundColor: palette.bgSecondary }]}>
              <TouchableOpacity
                style={[styles.segBtn, modalTab === 'direct' && styles.segBtnActive]}
                onPress={() => setModalTab('direct')}
              >
                <Text style={[styles.segBtnText, modalTab === 'direct' ? styles.segBtnTextActive : { color: palette.textSub }]}>
                  Direct Message
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, modalTab === 'group' && styles.segBtnActive]}
                onPress={() => setModalTab('group')}
              >
                <Text style={[styles.segBtnText, modalTab === 'group' ? styles.segBtnTextActive : { color: palette.textSub }]}>
                  New Group
                </Text>
              </TouchableOpacity>
            </View>

            {loadingUsers ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 32 }} />
            ) : modalTab === 'direct' ? (
              <ScrollView style={{ maxHeight: 360 }}>
                {availableUsers.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.userRow, { borderBottomColor: palette.border }]}
                    onPress={() => startDirectChat(u)}
                  >
                    <View style={[styles.avatarSmall, { backgroundColor: u.color || COLORS.primary }]}>
                      <Text style={styles.avatarSmallText}>{u.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.userName, { color: palette.text }]}>{u.name}</Text>
                      <Text style={{ color: palette.textSub, fontSize: 12 }}>@{u.username} · {u.about || 'Online'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View>
                <TextInput
                  style={[styles.groupNameInput, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border }]}
                  placeholder="Group Name (e.g. Founders Council)"
                  placeholderTextColor={palette.textSub}
                  value={groupName}
                  onChangeText={setGroupName}
                />
                <Text style={[styles.selectMembersLabel, { color: palette.textSub }]}>Select Participants:</Text>
                <ScrollView style={{ maxHeight: 220 }}>
                  {availableUsers.map(u => {
                    const isSelected = selectedMemberIds.includes(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.userRow, { borderBottomColor: palette.border }]}
                        onPress={() => toggleSelectMember(u.id)}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? COLORS.primary : palette.textSub}
                          style={{ marginRight: 10 }}
                        />
                        <View style={[styles.avatarSmall, { backgroundColor: u.color || COLORS.primary }]}>
                          <Text style={styles.avatarSmallText}>{u.name.slice(0, 2).toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.userName, { color: palette.text, marginLeft: 10 }]}>{u.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.createGroupBtn, creatingGroup && { opacity: 0.7 }]}
                  onPress={handleCreateGroup}
                  disabled={creatingGroup}
                >
                  {creatingGroup ? <ActivityIndicator color="#fff" /> : <Text style={styles.createGroupBtnText}>Create Group</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  avatarMiniText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  appTitle: { fontSize: 20, fontWeight: '800' },
  topBarActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 6, marginLeft: 8 },
  searchWrapper: { paddingHorizontal: 16, paddingVertical: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  filterPillText: { fontSize: 12, fontWeight: '700' },
  chatItem: { flexDirection: 'row', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  onlineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  chatDetails: { flex: 1, marginLeft: 14 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '700', flex: 1 },
  timestamp: { fontSize: 11 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewText: { fontSize: 13, flex: 1, marginRight: 8 },
  unreadBadge: { backgroundColor: COLORS.primary, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  unreadCountText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyText: { textAlign: 'center', fontSize: 14, marginTop: 12, lineHeight: 20 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  segmentedRow: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segBtnActive: { backgroundColor: COLORS.primary },
  segBtnText: { fontSize: 12, fontWeight: '600' },
  segBtnTextActive: { color: '#ffffff', fontWeight: '700' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '600' },
  groupNameInput: { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, marginBottom: 12 },
  selectMembersLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  createGroupBtn: { backgroundColor: COLORS.primary, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  createGroupBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' }
});
