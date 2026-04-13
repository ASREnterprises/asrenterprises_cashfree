import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Octicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { Colors } from '@/src/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondaryAccent} />
      </View>
    );
  }

  if (user) return null;

  const handleLogin = async () => {
    if (!token.trim()) {
      setError('Please enter your GitHub token');
      return;
    }
    Keyboard.dismiss();
    setError('');
    setLoading(true);
    try {
      await login(token.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Octicons name="mark-github" size={48} color={Colors.textPrimary} />
            </View>
            <Text style={styles.title}>GitHub</Text>
            <Text style={styles.subtitle}>Mobile Client</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardDesc}>
              Enter your GitHub Personal Access Token to get started
            </Text>

            <View style={styles.inputWrapper}>
              <Octicons name="key" size={16} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="token-input"
                style={styles.input}
                placeholder="ghp_xxxxxxxxxxxx"
                placeholderTextColor={Colors.textSecondary}
                value={token}
                onChangeText={setToken}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Octicons name="alert" size={14} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              testID="login-button"
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Octicons name="sign-in" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Sign In with Token</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>How to get a token?</Text>
            <View style={styles.helpStep}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>Go to GitHub Settings → Developer Settings</Text>
            </View>
            <View style={styles.helpStep}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>Personal Access Tokens → Tokens (classic)</Text>
            </View>
            <View style={styles.helpStep}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>Generate new token with 'repo' scope</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: '300', color: Colors.textPrimary, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    padding: 24, marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20, lineHeight: 18 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16,
  },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 14, paddingHorizontal: 12,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    padding: 10, marginBottom: 16,
  },
  errorText: { color: Colors.danger, fontSize: 13, flex: 1 },
  button: {
    backgroundColor: Colors.secondaryAccent, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  helpCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, padding: 20,
  },
  helpTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryAccent, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 },
  helpStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  stepNum: {
    width: 22, height: 22, textAlign: 'center', lineHeight: 22,
    backgroundColor: Colors.border, color: Colors.textPrimary, fontSize: 12, fontWeight: '700',
    overflow: 'hidden',
  },
  stepText: { fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
});
