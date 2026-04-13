import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Octicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { Colors } from '@/src/constants/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (!user) return null;

  const stats = [
    { label: 'Repos', value: user.public_repos, icon: 'repo' as const },
    { label: 'Followers', value: user.followers, icon: 'people' as const },
    { label: 'Following', value: user.following, icon: 'person-add' as const },
  ];

  const infoItems = [
    user.company && { icon: 'organization' as const, text: user.company },
    user.location && { icon: 'location' as const, text: user.location },
    user.blog && { icon: 'link' as const, text: user.blog, link: true },
    user.twitter_username && { icon: 'mention' as const, text: `@${user.twitter_username}` },
    user.created_at && { icon: 'calendar' as const, text: `Joined ${new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` },
  ].filter(Boolean) as { icon: any; text: string; link?: boolean }[];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{(user.login || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user.name || user.login}</Text>
          <Text style={styles.username}>@{user.login}</Text>
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        </View>

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Octicons name={s.icon} size={18} color={Colors.secondaryAccent} />
              <Text style={styles.statValue}>{s.value?.toLocaleString()}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {infoItems.length > 0 && (
          <View style={styles.infoCard}>
            {infoItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.infoRow}
                disabled={!item.link}
                onPress={() => item.link && Linking.openURL(item.text.startsWith('http') ? item.text : `https://${item.text}`)}
              >
                <Octicons name={item.icon} size={16} color={Colors.textSecondary} />
                <Text style={[styles.infoText, item.link && styles.infoLink]} numberOfLines={1}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          testID="view-github-profile"
          style={styles.githubBtn}
          onPress={() => Linking.openURL(user.html_url)}
          activeOpacity={0.7}
        >
          <Octicons name="link-external" size={16} color={Colors.textPrimary} />
          <Text style={styles.githubBtnText}>View on GitHub</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="logout-button"
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Octicons name="sign-out" size={16} color={Colors.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.secondaryAccent, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarLetter: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '600', color: Colors.textPrimary },
  username: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  bio: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 20 },
  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 16, gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  infoLink: { color: Colors.secondaryAccent },
  githubBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, marginBottom: 12,
  },
  githubBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    paddingVertical: 14,
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: Colors.danger },
});
