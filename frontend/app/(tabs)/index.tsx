import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Octicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { githubApi } from '@/src/utils/api';
import { Colors } from '@/src/constants/theme';

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  Swift: '#F05138', Kotlin: '#A97BFF', C: '#555555', 'C++': '#f34b7d',
  'C#': '#178600', PHP: '#4F5D95', HTML: '#e34c26', CSS: '#563d7c',
  Shell: '#89e051', Dart: '#00B4AB', Vue: '#41b883', Scala: '#c22d40',
};

export default function HomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchRepos = useCallback(async (p = 1, refresh = false) => {
    if (!token) return;
    try {
      const data = await githubApi('/user/repos', token, { page: p, per_page: 20, sort: 'updated' });
      if (refresh || p === 1) {
        setRepos(data);
      } else {
        setRepos(prev => [...prev, ...data]);
      }
      setHasMore(data.length === 20);
      setPage(p);
    } catch (e) {
      console.error('Fetch repos error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchRepos(); }, [fetchRepos]);

  const onRefresh = () => { setRefreshing(true); fetchRepos(1, true); };
  const onEndReached = () => { if (hasMore && !loading) fetchRepos(page + 1); };

  const navigateToRepo = (owner: string, name: string) => {
    router.push({ pathname: '/repo-detail', params: { owner, name } });
  };

  const renderRepo = ({ item }: { item: any }) => (
    <TouchableOpacity
      testID={`repo-card-${item.name}`}
      style={styles.repoCard}
      onPress={() => navigateToRepo(item.owner?.login, item.name)}
      activeOpacity={0.7}
    >
      <View style={styles.repoHeader}>
        <Octicons name={item.private ? 'lock' : 'repo'} size={16} color={Colors.textSecondary} />
        <Text style={styles.repoName} numberOfLines={1}>{item.name}</Text>
        {item.private && <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>Private</Text></View>}
      </View>
      {item.description ? <Text style={styles.repoDesc} numberOfLines={2}>{item.description}</Text> : null}
      <View style={styles.repoMeta}>
        {item.language ? (
          <View style={styles.metaItem}>
            <View style={[styles.langDot, { backgroundColor: LANG_COLORS[item.language] || Colors.textSecondary }]} />
            <Text style={styles.metaText}>{item.language}</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Octicons name="star" size={13} color={Colors.primaryAccent} />
          <Text style={styles.metaText}>{item.stargazers_count?.toLocaleString()}</Text>
        </View>
        <View style={styles.metaItem}>
          <Octicons name="repo-forked" size={13} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{item.forks_count?.toLocaleString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Repositories</Text>
        <Text style={styles.headerCount}>{user?.public_repos ?? ''}</Text>
      </View>
      {loading && repos.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondaryAccent} /></View>
      ) : (
        <FlatList
          testID="repo-list"
          data={repos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRepo}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondaryAccent} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={styles.emptyText}>No repositories found</Text>}
          ListFooterComponent={hasMore && repos.length > 0 ? <ActivityIndicator color={Colors.secondaryAccent} style={{ padding: 16 }} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 24, fontWeight: '300', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerCount: { fontSize: 14, color: Colors.textSecondary, backgroundColor: Colors.surface, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12 },
  repoCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 8,
  },
  repoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  repoName: { fontSize: 15, fontWeight: '600', color: Colors.secondaryAccent, flex: 1 },
  privateBadge: { backgroundColor: Colors.border, paddingHorizontal: 6, paddingVertical: 2 },
  privateBadgeText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  repoDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  repoMeta: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  langDot: { width: 10, height: 10, borderRadius: 5 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40, fontSize: 14 },
});
