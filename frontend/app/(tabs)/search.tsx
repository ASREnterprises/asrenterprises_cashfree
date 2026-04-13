import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Keyboard,
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
  Swift: '#F05138', Kotlin: '#A97BFF', 'C++': '#f34b7d', PHP: '#4F5D95',
};

export default function SearchScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const search = useCallback(async (q: string, p = 1) => {
    if (!token || !q.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const data = await githubApi('/search/repos', token, { q: q.trim(), page: p, per_page: 20 });
      if (p === 1) {
        setResults(data.items || []);
      } else {
        setResults(prev => [...prev, ...(data.items || [])]);
      }
      setTotalCount(data.total_count || 0);
      setPage(p);
    } catch (e) {
      console.error('Search error', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const onEndReached = () => {
    if (!loading && results.length < totalCount) search(query, page + 1);
  };

  const renderRepo = ({ item }: { item: any }) => (
    <TouchableOpacity
      testID={`search-result-${item.full_name}`}
      style={styles.repoCard}
      onPress={() => router.push({ pathname: '/repo-detail', params: { owner: item.owner?.login, name: item.name } })}
      activeOpacity={0.7}
    >
      <View style={styles.repoHeader}>
        <Octicons name="repo" size={14} color={Colors.textSecondary} />
        <Text style={styles.repoFullName} numberOfLines={1}>{item.full_name}</Text>
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
        <Text style={styles.headerTitle}>Explore</Text>
      </View>
      <View style={styles.searchBar}>
        <Octicons name="search" size={16} color={Colors.textSecondary} />
        <TextInput
          testID="search-input"
          style={styles.searchInput}
          placeholder="Search repositories..."
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search(query)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity testID="search-clear" onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Octicons name="x" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading && results.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondaryAccent} /></View>
      ) : searched && results.length === 0 ? (
        <View style={styles.center}>
          <Octicons name="search" size={40} color={Colors.border} />
          <Text style={styles.emptyText}>No repositories found</Text>
        </View>
      ) : !searched ? (
        <View style={styles.center}>
          <Octicons name="telescope" size={40} color={Colors.border} />
          <Text style={styles.emptyText}>Search for repositories</Text>
          <Text style={styles.emptySubText}>Find public repos across GitHub</Text>
        </View>
      ) : (
        <>
          <View style={styles.resultCount}>
            <Text style={styles.resultCountText}>{totalCount.toLocaleString()} results</Text>
          </View>
          <FlatList
            testID="search-results"
            data={results}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRepo}
            contentContainerStyle={styles.list}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loading ? <ActivityIndicator color={Colors.secondaryAccent} style={{ padding: 16 }} /> : null}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '300', color: Colors.textPrimary, letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 16 },
  emptySubText: { color: Colors.border, fontSize: 13 },
  resultCount: { paddingHorizontal: 20, paddingVertical: 8 },
  resultCountText: { fontSize: 12, color: Colors.textSecondary },
  list: { padding: 12 },
  repoCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 8,
  },
  repoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  repoFullName: { fontSize: 14, fontWeight: '600', color: Colors.secondaryAccent, flex: 1 },
  repoDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  repoMeta: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  langDot: { width: 10, height: 10, borderRadius: 5 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
});
