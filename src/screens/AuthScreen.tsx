import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, API_BASE_URL } from '../config';

export const AuthScreen: React.FC = () => {
  const { loginUser, registerUser, theme } = useAuth();
  const palette = COLORS[theme];

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    setErrorMsg('');
    const u = username.trim().toLowerCase();
    const p = password.trim();

    if (!u || !p) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setErrorMsg('Please enter your display name.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await loginUser(u, p);
      } else {
        await registerUser(name.trim(), u, p);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const openLegal = (path: string) => {
    Linking.openURL(`${API_BASE_URL}${path}`).catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: palette.bgSecondary }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>EC</Text>
          </View>
          <Text style={[styles.title, { color: palette.text }]}>Eazychat</Text>
          <Text style={[styles.subtitle, { color: palette.textSub }]}>Simple, secure, real-time messaging</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {/* Mode Switcher */}
          <View style={[styles.tabBar, { backgroundColor: palette.bgSecondary }]}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => { setMode('login'); setErrorMsg(''); }}
            >
              <Text style={[styles.tabText, mode === 'login' ? styles.tabTextActive : { color: palette.textSub }]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'register' && styles.tabActive]}
              onPress={() => { setMode('register'); setErrorMsg(''); }}
            >
              <Text style={[styles.tabText, mode === 'register' ? styles.tabTextActive : { color: palette.textSub }]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Form */}
          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: palette.textSub }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border }]}
                placeholder="e.g. Aarav Mehta"
                placeholderTextColor={palette.textSub}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: palette.textSub }]}>Username or Phone</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border }]}
              placeholder="e.g. aarav or +919876543210"
              placeholderTextColor={palette.textSub}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: palette.textSub }]}>Password</Text>
            <View style={[styles.passwordWrapper, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: palette.text }]}
                placeholder="At least 6 characters"
                placeholderTextColor={palette.textSub}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={{ color: palette.textSub, fontSize: 13, fontWeight: '600' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'login' ? 'Sign In to Eazychat' : 'Create My Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Legal Links */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => openLegal('/privacy')}>
            <Text style={[styles.legalLink, { color: COLORS.primary }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={{ color: palette.textSub }}> · </Text>
          <TouchableOpacity onPress={() => openLegal('/terms')}>
            <Text style={[styles.legalLink, { color: COLORS.primary }]}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  header: {
    alignItems: 'center',
    marginBottom: 28
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  logoText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600'
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  errorBox: {
    backgroundColor: 'rgba(234, 0, 56, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ea0038'
  },
  errorText: {
    color: '#ea0038',
    fontSize: 12,
    fontWeight: '600'
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15
  },
  passwordWrapper: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14
  },
  passwordInput: {
    flex: 1,
    fontSize: 15
  },
  eyeBtn: {
    padding: 6
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '600'
  }
});
