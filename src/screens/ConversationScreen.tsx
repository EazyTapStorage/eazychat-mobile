import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { getChatMessages, uploadImage, uploadAudio, blockUser, reportAbuse } from '../services/api';
import { getSocket } from '../services/socket';
import { Message, RootStackParamList, ReplyTo } from '../types';
import { COLORS, API_BASE_URL } from '../config';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const ConversationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { chatId, name, isGroup, otherUserId, color } = route.params;
  const { user, theme } = useAuth();
  const palette = COLORS[theme];

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  // In-chat search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Audio recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimerRef = useRef<any>(null);

  // Active audio player state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);

  // Report modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportingMsgId, setReportingMsgId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Audio session setup
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true
    }).catch(() => {});

    return () => {
      if (soundObject) {
        soundObject.unloadAsync().catch(() => {});
      }
    };
  }, [soundObject]);

  // Load message history
  useEffect(() => {
    getChatMessages(chatId)
      .then(res => setMessages(res.messages || []))
      .catch(() => {});

    const socket = getSocket();
    if (socket) {
      socket.emit('message:read', { chatId });
    }
  }, [chatId]);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (payload: { chatId: string; message: Message }) => {
      if (payload.chatId === chatId) {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
        if (payload.message.senderId !== user?.id) {
          socket.emit('message:read', { chatId });
        }
      }
    };

    const onStatusUpdate = ({ chatId: cid, messageIds, status }: { chatId: string; messageIds: string[]; status: 'delivered' | 'read' }) => {
      if (cid === chatId) {
        setMessages(prev => prev.map(m => messageIds.includes(m.id) ? { ...m, status } : m));
      }
    };

    const onTypingUpdate = ({ chatId: cid, userName, isTyping: typing }: { chatId: string; userName: string; isTyping: boolean }) => {
      if (cid === chatId) {
        setTypingUser(typing ? userName : null);
      }
    };

    const onReactionUpdate = ({ chatId: cid, message }: { chatId: string; message: Message }) => {
      if (cid === chatId) {
        setMessages(prev => prev.map(m => m.id === message.id ? message : m));
      }
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:status', onStatusUpdate);
    socket.on('typing:update', onTypingUpdate);
    socket.on('message:updated', onReactionUpdate);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:status', onStatusUpdate);
      socket.off('typing:update', onTypingUpdate);
      socket.off('message:updated', onReactionUpdate);
    };
  }, [chatId, user?.id]);

  const handleTyping = (text: string) => {
    setInputText(text);
    const socket = getSocket();
    if (!socket) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing:start', { chatId });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing:stop', { chatId });
    }, 1500);
  };

  const sendMessage = (type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string, dur?: number) => {
    const socket = getSocket();
    if (!socket) return;

    if (type === 'text' && !inputText.trim()) return;

    socket.emit('message:send', {
      chatId,
      type,
      text: type === 'text' ? inputText.trim() : '',
      imageUrl: type === 'image' ? mediaUrl : '',
      audioUrl: type === 'audio' ? mediaUrl : '',
      duration: dur || 0,
      replyTo: replyingTo
    }, (ack: any) => {
      if (ack?.error) {
        Alert.alert('Message Blocked', ack.error);
      }
    });

    if (type === 'text') setInputText('');
    setReplyingTo(null);
  };

  // Image Upload
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Please allow camera roll access to send photos.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8
    });

    if (!res.canceled && res.assets[0]?.uri) {
      try {
        const upload = await uploadImage(res.assets[0].uri);
        sendMessage('image', upload.imageUrl);
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message);
      }
    }
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Microphone access is required to record voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const newRec = new Audio.Recording();
      await newRec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRec.startAsync();

      setRecording(newRec);
      setIsRecording(true);
      setRecordDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordDuration(d => d + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert('Recording Failed', err.message);
    }
  };

  const cancelRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {}
    }
    setRecording(null);
    setIsRecording(false);
    setRecordDuration(0);
  };

  const sendRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const dur = recordDuration;
      setRecording(null);
      setIsRecording(false);
      setRecordDuration(0);

      if (uri) {
        const res = await uploadAudio(uri);
        sendMessage('audio', res.audioUrl, dur);
      }
    } catch (err: any) {
      Alert.alert('Voice Note Failed', err.message);
    }
  };

  // Play audio note
  const playAudioNote = async (msgId: string, url: string) => {
    if (playingAudioId === msgId && soundObject) {
      await soundObject.pauseAsync();
      setPlayingAudioId(null);
      return;
    }

    if (soundObject) {
      await soundObject.unloadAsync();
    }

    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const { sound } = await Audio.Sound.createAsync({ uri: fullUrl });
    setSoundObject(sound);
    setPlayingAudioId(msgId);

    sound.setOnPlaybackStatusUpdate(status => {
      if (status.isLoaded && status.didJustFinish) {
        setPlayingAudioId(null);
      }
    });

    await sound.playAsync();
  };

  // Reactions
  const handleReact = (msgId: string, emoji: string) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('message:react', { chatId, messageId: msgId, emoji });
    }
  };

  // Block & Report actions
  const handleBlockUser = () => {
    if (!otherUserId) return;
    Alert.alert(
      'Block Contact',
      `Are you sure you want to block ${name}? They will not be able to message or call you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(otherUserId);
              Alert.alert('Blocked', `${name} has been blocked.`);
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const submitReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for the report.');
      return;
    }
    try {
      await reportAbuse(otherUserId, reportingMsgId || undefined, reportReason.trim());
      setReportModalOpen(false);
      setReportReason('');
      setReportingMsgId(null);
      Alert.alert('Report Submitted', 'Thank you. Our moderation team will investigate.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const tickIcon = (status: string) => {
    if (status === 'read') {
      return <Ionicons name="checkmark-done" size={16} color={COLORS.blueCheck} />;
    } else if (status === 'delivered') {
      return <Ionicons name="checkmark-done" size={16} color={palette.textSub} />;
    }
    return <Ionicons name="checkmark" size={16} color={palette.textSub} />;
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.headerBg, borderColor: palette.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 6 }}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>

        <View style={[styles.headerAvatar, { backgroundColor: color || COLORS.primary }]}>
          <Text style={styles.headerAvatarText}>{name?.slice(0, 2).toUpperCase() || 'EC'}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.headerName, { color: palette.text }]} numberOfLines={1}>{name}</Text>
          <Text style={{ fontSize: 11, color: typingUser ? COLORS.primary : palette.textSub }}>
            {typingUser ? `${typingUser} is typing...` : isGroup ? 'Group' : 'Tap for options'}
          </Text>
        </View>

        <TouchableOpacity onPress={() => setSearchOpen(!searchOpen)} style={{ padding: 6 }}>
          <Ionicons name="search" size={20} color={palette.text} />
        </TouchableOpacity>

        {!isGroup && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Conversation Options', name, [
                { text: 'Block User', style: 'destructive', onPress: handleBlockUser },
                { text: 'Report Abuse', onPress: () => { setReportingMsgId(null); setReportModalOpen(true); } },
                { text: 'Cancel', style: 'cancel' }
              ]);
            }}
            style={{ padding: 6, marginLeft: 4 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={palette.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* In-Chat Search Bar */}
      {searchOpen && (
        <View style={[styles.searchBar, { backgroundColor: palette.headerBg, borderColor: palette.border }]}>
          <Ionicons name="search" size={16} color={palette.textSub} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search inside conversation..."
            placeholderTextColor={palette.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <Text style={{ fontSize: 12, color: palette.textSub, marginRight: 8 }}>
            {filteredMessages.length} match{filteredMessages.length === 1 ? '' : 'es'}
          </Text>
          <TouchableOpacity onPress={() => { setSearchOpen(false); setSearchQuery(''); }}>
            <Ionicons name="close" size={20} color={palette.textSub} />
          </TouchableOpacity>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const fromMe = item.senderId === user?.id;
          const reactions = (Object.entries(item.reactions || {}).filter(([, uids]) => Array.isArray(uids) && uids.length > 0) as [string, string[]][]);

          return (
            <View style={[styles.msgRow, fromMe ? styles.msgRowRight : styles.msgRowLeft]}>
              <View
                style={[
                  styles.bubble,
                  fromMe ? { backgroundColor: palette.bubbleOut } : { backgroundColor: palette.bubbleIn },
                  { borderColor: palette.border }
                ]}
              >
                {/* Replying banner */}
                {item.replyTo && (
                  <View style={[styles.replyQuote, { borderLeftColor: COLORS.primary }]}>
                    <Text style={[styles.replyAuthor, { color: COLORS.primary }]}>{item.replyTo.senderName}</Text>
                    <Text style={{ fontSize: 12, color: palette.textSub }} numberOfLines={1}>{item.replyTo.text}</Text>
                  </View>
                )}

                {/* Group sender name */}
                {isGroup && !fromMe && (
                  <Text style={[styles.senderName, { color: COLORS.primary }]}>{item.senderName}</Text>
                )}

                {/* Content */}
                {item.type === 'image' && item.imageUrl && (
                  <Image
                    source={{ uri: item.imageUrl.startsWith('http') ? item.imageUrl : `${API_BASE_URL}${item.imageUrl}` }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                )}

                {item.type === 'audio' && item.audioUrl && (
                  <View style={styles.audioRow}>
                    <TouchableOpacity
                      onPress={() => playAudioNote(item.id, item.audioUrl!)}
                      style={styles.playBtn}
                    >
                      <Ionicons
                        name={playingAudioId === item.id ? 'pause' : 'play'}
                        size={20}
                        color="#ffffff"
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>Voice Note</Text>
                      <Text style={{ fontSize: 11, color: palette.textSub }}>{item.duration ? `${item.duration}s` : 'Audio'}</Text>
                    </View>
                  </View>
                )}

                {Boolean(item.text) && (
                  <Text style={[styles.messageText, { color: palette.text }]}>{item.text}</Text>
                )}

                {/* Status & Time */}
                <View style={styles.statusRow}>
                  <Text style={[styles.timeText, { color: palette.textSub }]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {fromMe && <View style={{ marginLeft: 4 }}>{tickIcon(item.status)}</View>}
                </View>

                {/* Reactions badge */}
                {reactions.length > 0 && (
                  <View style={styles.reactionsBadge}>
                    {reactions.map(([emoji, uids]) => (
                      <Text key={emoji} style={styles.reactionEmoji}>
                        {emoji} {uids.length > 1 ? uids.length : ''}
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              {/* Quick actions popup on tap */}
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Message Options', '', [
                    { text: 'Reply', onPress: () => setReplyingTo({ id: item.id, senderName: item.senderName, text: item.text || 'Media' }) },
                    ...REACTIONS.map(e => ({ text: e, onPress: () => handleReact(item.id, e) })),
                    { text: 'Report Abuse', onPress: () => { setReportingMsgId(item.id); setReportModalOpen(true); } },
                    { text: 'Cancel', style: 'cancel' }
                  ]);
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="happy-outline" size={16} color={palette.textSub} />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* Reply Banner */}
      {replyingTo && (
        <View style={[styles.replyBanner, { backgroundColor: palette.headerBg, borderColor: palette.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary }}>Replying to {replyingTo.senderName}</Text>
            <Text style={{ fontSize: 12, color: palette.textSub }} numberOfLines={1}>{replyingTo.text}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close" size={20} color={palette.textSub} />
          </TouchableOpacity>
        </View>
      )}

      {/* Composer Footer */}
      <View style={[styles.footer, { backgroundColor: palette.headerBg, borderColor: palette.border }]}>
        {isRecording ? (
          <View style={styles.recordingRow}>
            <View style={styles.recDot} />
            <Text style={styles.recTimerText}>
              {Math.floor(recordDuration / 60)}:{String(recordDuration % 60).padStart(2, '0')}
            </Text>
            <Text style={{ color: '#ea0038', fontSize: 13, flex: 1, marginLeft: 8 }}>Recording voice note...</Text>
            <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecBtn}>
              <Text style={{ color: '#ea0038', fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={sendRecording} style={styles.sendRecBtn}>
              <Ionicons name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TouchableOpacity onPress={pickImage} style={styles.attachBtn}>
              <Ionicons name="camera-outline" size={24} color={palette.textSub} />
            </TouchableOpacity>

            <TextInput
              style={[styles.composerInput, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border }]}
              placeholder="Type a message"
              placeholderTextColor={palette.textSub}
              value={inputText}
              onChangeText={handleTyping}
              multiline
            />

            {inputText.trim() ? (
              <TouchableOpacity onPress={() => sendMessage('text')} style={styles.sendBtn}>
                <Ionicons name="send" size={20} color="#ffffff" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startRecording} style={styles.micBtn}>
                <Ionicons name="mic" size={22} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Report Modal */}
      <Modal visible={reportModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Report Abuse / Content</Text>
            <Text style={{ fontSize: 13, color: palette.textSub, marginVertical: 8 }}>
              Please describe the safety concern or policy violation:
            </Text>
            <TextInput
              style={[styles.reportInput, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border }]}
              placeholder="e.g. Inappropriate language, spam, harassment..."
              placeholderTextColor={palette.textSub}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
              <TouchableOpacity onPress={() => setReportModalOpen(false)} style={{ padding: 10, marginRight: 10 }}>
                <Text style={{ color: palette.textSub, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitReport} style={styles.submitReportBtn}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  headerName: { fontSize: 16, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1
  },
  searchInput: { flex: 1, marginHorizontal: 8, fontSize: 14 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  replyQuote: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6 },
  replyAuthor: { fontSize: 12, fontWeight: '700' },
  senderName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  messageImage: { width: 220, height: 160, borderRadius: 10, marginBottom: 4 },
  audioRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  messageText: { fontSize: 15, lineHeight: 20 },
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 },
  timeText: { fontSize: 10 },
  reactionsBadge: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e9edef'
  },
  reactionEmoji: { fontSize: 12, marginRight: 4 },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1
  },
  footer: { paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  attachBtn: { padding: 6, marginRight: 4 },
  composerInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  },
  recordingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ea0038', marginRight: 8 },
  recTimerText: { fontSize: 14, fontWeight: '700', color: '#ea0038' },
  cancelRecBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  sendRecBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  reportInput: { height: 90, borderRadius: 12, borderWidth: 1, padding: 12, textAlignVertical: 'top' },
  submitReportBtn: { backgroundColor: '#ea0038', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }
});
