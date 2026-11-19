import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Linking
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types';
import { COLORS, API_BASE_URL } from '../config';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, theme, toggleTheme, logoutUser, updateUserProfile, deleteUserAccount } = useAuth();
  const palette = COLORS[theme];

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [about, setAbout] = useState(user?.about || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Display name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({ name: name.trim(), about: about.trim() });
      setEditModalOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Eazychat?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logoutUser() }
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account Permanently',
      'This will permanently delete your account, your profile, and remove all your messages from Eazychat. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserAccount();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete account.');
            }
          }
        }
      ]
    );
  };

  const openUrl = (path: string) => {
    Linking.openURL(`${API_BASE_URL}${path}`).catch(() => {});
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: palette.headerBg, borderColor: palette.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Settings & Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={[styles.bigAvatar, { backgroundColor: user?.color || COLORS.primary }]}>
          <Text style={styles.bigAvatarText}>{user?.name?.slice(0, 2).toUpperCase() || 'EC'}</Text>
        </View>
        <Text style={[styles.profileName, { color: palette.text }]}>{user?.name}</Text>
        <Text style={[styles.profileUsername, { color: palette.textSub }]}>@{user?.username}</Text>
        <Text style={[styles.profileAbout, { color: palette.text }]}>"{user?.about || 'Hey there! I am using Eazychat.'}"</Text>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => {
            setName(user?.name || '');
            setAbout(user?.about || '');
            setEditModalOpen(true);
          }}
        >
          <Ionicons name="pencil-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Settings Options */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textSub }]}>Preferences</Text>

        <View style={[styles.rowItem, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="moon-outline" size={22} color={palette.text} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: palette.text }]}>Dark Mode</Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: COLORS.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textSub }]}>Legal & Compliance</Text>

        <TouchableOpacity
          style={[styles.rowItem, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => openUrl('/privacy')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark-outline" size={22} color={palette.text} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: palette.text }]}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textSub} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => openUrl('/terms')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="document-text-outline" size={22} color={palette.text} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: palette.text }]}>Terms of Service</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textSub} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textSub }]}>Account Management</Text>

        <TouchableOpacity
          style={[styles.rowItem, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={handleSignOut}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="log-out-outline" size={22} color={palette.text} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: palette.text }]}>Sign Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textSub} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, { backgroundColor: palette.card, borderColor: palette.border, marginTop: 8 }]}
          onPress={handleDeleteAccount}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="trash-outline" size={22} color={COLORS.light.danger} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: COLORS.light.danger, fontWeight: '700' }]}>Delete Account</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.light.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.footerNote}>
        <Text style={{ fontSize: 12, color: palette.textSub, textAlign: 'center' }}>
          Eazychat Mobile v1.0.0 · Production Ready
        </Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={editModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Edit Profile</Text>

            <View style={{ marginVertical: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: palette.textSub, marginBottom: 4 }}>
                Display Name
              </Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border }]}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: palette.textSub, marginBottom: 4 }}>
                About / Status
              </Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border }]}
                value={about}
                onChangeText={setAbout}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setEditModalOpen(false)} style={{ padding: 12, marginRight: 8 }}>
                <Text style={{ color: palette.textSub, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveProfile} style={styles.saveBtn} disabled={saving}>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  profileCard: {
    margin: 16,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1
  },
  bigAvatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bigAvatarText: { color: '#ffffff', fontSize: 32, fontWeight: '800' },
  profileName: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  profileUsername: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  profileAbout: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginBottom: 16 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20
  },
  editBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6
  },
  rowText: { fontSize: 15, fontWeight: '600' },
  footerNote: { marginVertical: 32, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 24, padding: 22, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 }
});
