import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Octicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAuth } from '@/src/context/AuthContext';
import { githubApi } from '@/src/utils/api';
import { Colors } from '@/src/constants/theme';

const TABS = ['Overview', 'Code', 'Commits', 'Issues', 'PRs'] as const;
type Tab = typeof TABS[number];

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
};

export default function RepoDetailScreen() {
  const { owner, name } = useLocalSearchParams<{ owner: string; name: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [repo, setRepo] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && owner && name) {
      githubApi(`/repos/${owner}/${name}`, token)
        .then(setRepo)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [token, owner, name]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.secondaryAccent} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
          <Octicons name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerOwner}>{owner}</Text>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
        </View>
      </View>

      {/* Stats */}
      {repo && (
        <View style={styles.statsBar}>
          <StatBadge icon="star" value={repo.stargazers_count} color={Colors.primaryAccent} />
          <StatBadge icon="repo-forked" value={repo.forks_count} color={Colors.textSecondary} />
          <StatBadge icon="eye" value={repo.watchers_count} color={Colors.textSecondary} />
          {repo.language && (
            <View style={styles.statBadge}>
              <View style={[styles.langDot, { backgroundColor: LANG_COLORS[repo.language] || Colors.textSecondary }]} />
              <Text style={styles.statText}>{repo.language}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            testID={`tab-${t.toLowerCase()}`}
            style={[styles.tabItem, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      {tab === 'Overview' && <OverviewTab owner={owner!} name={name!} token={token!} repo={repo} />}
      {tab === 'Code' && <CodeTab owner={owner!} name={name!} token={token!} router={router} />}
      {tab === 'Commits' && <CommitsTab owner={owner!} name={name!} token={token!} />}
      {tab === 'Issues' && <IssuesTab owner={owner!} name={name!} token={token!} />}
      {tab === 'PRs' && <PullsTab owner={owner!} name={name!} token={token!} />}
    </SafeAreaView>
  );
}

function StatBadge({ icon, value, color }: { icon: any; value: number; color: string }) {
  return (
    <View style={styles.statBadge}>
      <Octicons name={icon} size={14} color={color} />
      <Text style={styles.statText}>{value?.toLocaleString()}</Text>
    </View>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────
function OverviewTab({ owner, name, token, repo }: any) {
  const [readme, setReadme] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    githubApi(`/repos/${owner}/${name}/readme`, token)
      .then(d => setReadme(d.html || ''))
      .catch(() => setReadme(''))
      .finally(() => setLoading(false));
  }, [owner, name, token]);

  const htmlContent = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0A0A0A;color:#FAFAFA;font-family:-apple-system,system-ui,sans-serif;font-size:14px;padding:16px;line-height:1.6}
h1,h2,h3{color:#FAFAFA;margin:16px 0 8px;border-bottom:1px solid #27272A;padding-bottom:8px}
p{margin:8px 0;color:#A1A1AA}a{color:#3B82F6}code{background:#111113;color:#FBBF24;padding:2px 6px;font-size:13px;font-family:monospace}
pre{background:#111113;border:1px solid #27272A;padding:12px;overflow-x:auto;margin:12px 0}
pre code{padding:0;background:none}img{max-width:100%;height:auto}ul,ol{padding-left:20px;color:#A1A1AA}
li{margin:4px 0}blockquote{border-left:3px solid #3B82F6;padding-left:12px;color:#A1A1AA;margin:8px 0}
table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #27272A;padding:8px;text-align:left;color:#A1A1AA}
th{background:#111113;color:#FAFAFA}</style></head><body>${readme}</body></html>`;

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.secondaryAccent} /></View>;

  return (
    <View style={styles.tabContent}>
      {repo?.description && <Text style={styles.repoDesc}>{repo.description}</Text>}
      {repo?.topics?.length > 0 && (
        <View style={styles.topicsRow}>
          {repo.topics.map((t: string) => (
            <View key={t} style={styles.topicBadge}><Text style={styles.topicText}>{t}</Text></View>
          ))}
        </View>
      )}
      {readme ? (
        <View style={styles.readmeContainer}>
          <View style={styles.readmeHeader}>
            <Octicons name="book" size={14} color={Colors.textSecondary} />
            <Text style={styles.readmeTitle}>README.md</Text>
          </View>
          <WebView
            testID="readme-webview"
            source={{ html: htmlContent }}
            style={styles.webview}
            scrollEnabled={true}
            nestedScrollEnabled={true}
          />
        </View>
      ) : (
        <Text style={styles.emptyText}>No README found</Text>
      )}
    </View>
  );
}

// ─── Code Tab ───────────────────────────────────────────────────────
function CodeTab({ owner, name, token, router }: any) {
  const [contents, setContents] = useState<any[]>([]);
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => { fetchContents(path); }, [path]);

  const fetchContents = async (p: string) => {
    setLoading(true);
    try {
      const data = await githubApi(`/repos/${owner}/${name}/contents`, token, p ? { path: p } : {});
      const sorted = Array.isArray(data) ? data.sort((a: any, b: any) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      }) : [];
      setContents(sorted);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const navigateToDir = (dirPath: string) => {
    setHistory(prev => [...prev, path]);
    setPath(dirPath);
  };

  const goBack = () => {
    const prev = history[history.length - 1] ?? '';
    setHistory(h => h.slice(0, -1));
    setPath(prev);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.secondaryAccent} /></View>;

  return (
    <View style={styles.tabContent}>
      {path !== '' && (
        <TouchableOpacity testID="code-back" style={styles.pathBack} onPress={goBack}>
          <Octicons name="arrow-left" size={14} color={Colors.secondaryAccent} />
          <Text style={styles.pathText}>{path || '/'}</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={contents}
        keyExtractor={item => item.sha || item.name}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`file-item-${item.name}`}
            style={styles.fileItem}
            onPress={() => {
              if (item.type === 'dir') navigateToDir(item.path);
              else router.push({ pathname: '/file-viewer', params: { owner, name, path: item.path, filename: item.name } });
            }}
          >
            <Octicons
              name={item.type === 'dir' ? 'file-directory-fill' : 'file'}
              size={16}
              color={item.type === 'dir' ? Colors.secondaryAccent : Colors.textSecondary}
            />
            <Text style={styles.fileName}>{item.name}</Text>
            {item.type !== 'dir' && <Text style={styles.fileSize}>{formatSize(item.size)}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Empty directory</Text>}
      />
    </View>
  );
}

// ─── Commits Tab ────────────────────────────────────────────────────
function CommitsTab({ owner, name, token }: any) {
  const [commits, setCommits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    githubApi(`/repos/${owner}/${name}/commits`, token, { per_page: 30 })
      .then(setCommits)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [owner, name, token]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.secondaryAccent} /></View>;

  return (
    <FlatList
      data={commits}
      keyExtractor={item => item.sha}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item, index }) => (
        <View style={styles.commitItem}>
          <View style={styles.commitTimeline}>
            <View style={styles.commitDot} />
            {index < commits.length - 1 && <View style={styles.commitLine} />}
          </View>
          <View style={styles.commitContent}>
            <Text style={styles.commitMsg} numberOfLines={2}>{item.commit?.message}</Text>
            <View style={styles.commitMeta}>
              <Text style={styles.commitAuthor}>{item.commit?.author?.name}</Text>
              <View style={styles.shaBadge}>
                <Text style={styles.shaText}>{item.sha?.substring(0, 7)}</Text>
              </View>
              <Text style={styles.commitDate}>{timeAgo(item.commit?.author?.date)}</Text>
            </View>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No commits found</Text>}
    />
  );
}

// ─── Issues Tab ─────────────────────────────────────────────────────
function IssuesTab({ owner, name, token }: any) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<'open' | 'closed'>('open');

  useEffect(() => {
    setLoading(true);
    githubApi(`/repos/${owner}/${name}/issues`, token, { state, per_page: 30 })
      .then(data => setIssues(data.filter((i: any) => !i.pull_request)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [owner, name, token, state]);

  return (
    <View style={styles.tabContent}>
      <View style={styles.stateToggle}>
        <TouchableOpacity testID="issues-open" style={[styles.stateBtn, state === 'open' && styles.stateBtnActive]} onPress={() => setState('open')}>
          <Octicons name="issue-opened" size={14} color={state === 'open' ? Colors.success : Colors.textSecondary} />
          <Text style={[styles.stateText, state === 'open' && styles.stateTextActive]}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="issues-closed" style={[styles.stateBtn, state === 'closed' && styles.stateBtnActive]} onPress={() => setState('closed')}>
          <Octicons name="issue-closed" size={14} color={state === 'closed' ? Colors.danger : Colors.textSecondary} />
          <Text style={[styles.stateText, state === 'closed' && styles.stateTextActive]}>Closed</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={Colors.secondaryAccent} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={issues}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.issueItem}>
              <Octicons
                name={item.state === 'open' ? 'issue-opened' : 'issue-closed'}
                size={16}
                color={item.state === 'open' ? Colors.success : Colors.danger}
              />
              <View style={styles.issueContent}>
                <Text style={styles.issueTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.issueMeta}>#{item.number} · {item.user?.login} · {timeAgo(item.created_at)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No {state} issues</Text>}
        />
      )}
    </View>
  );
}

// ─── Pull Requests Tab ──────────────────────────────────────────────
function PullsTab({ owner, name, token }: any) {
  const [pulls, setPulls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<'open' | 'closed'>('open');

  useEffect(() => {
    setLoading(true);
    githubApi(`/repos/${owner}/${name}/pulls`, token, { state, per_page: 30 })
      .then(setPulls)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [owner, name, token, state]);

  return (
    <View style={styles.tabContent}>
      <View style={styles.stateToggle}>
        <TouchableOpacity testID="pulls-open" style={[styles.stateBtn, state === 'open' && styles.stateBtnActive]} onPress={() => setState('open')}>
          <Octicons name="git-pull-request" size={14} color={state === 'open' ? Colors.success : Colors.textSecondary} />
          <Text style={[styles.stateText, state === 'open' && styles.stateTextActive]}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="pulls-closed" style={[styles.stateBtn, state === 'closed' && styles.stateBtnActive]} onPress={() => setState('closed')}>
          <Octicons name="git-merge" size={14} color={state === 'closed' ? Colors.secondaryAccent : Colors.textSecondary} />
          <Text style={[styles.stateText, state === 'closed' && styles.stateTextActive]}>Merged/Closed</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={Colors.secondaryAccent} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={pulls}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.issueItem}>
              <Octicons
                name={item.merged_at ? 'git-merge' : 'git-pull-request'}
                size={16}
                color={item.merged_at ? Colors.secondaryAccent : Colors.success}
              />
              <View style={styles.issueContent}>
                <Text style={styles.issueTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.issueMeta}>#{item.number} · {item.user?.login} · {timeAgo(item.created_at)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No {state} pull requests</Text>}
        />
      )}
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`;
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerOwner: { fontSize: 12, color: Colors.textSecondary },
  headerName: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  statsBar: {
    flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  langDot: { width: 10, height: 10, borderRadius: 5 },
  statText: { fontSize: 12, color: Colors.textSecondary },
  tabBar: { borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 44 },
  tabBarContent: { paddingHorizontal: 12 },
  tabItem: { paddingHorizontal: 16, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.secondaryAccent },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.secondaryAccent },
  tabContent: { flex: 1 },
  repoDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topicsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 16, paddingTop: 0 },
  topicBadge: { backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 10, paddingVertical: 4 },
  topicText: { fontSize: 11, color: Colors.secondaryAccent, fontWeight: '600' },
  readmeContainer: { flex: 1 },
  readmeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  readmeTitle: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  webview: { flex: 1, backgroundColor: Colors.background },
  pathBack: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pathText: { fontSize: 13, color: Colors.secondaryAccent, fontFamily: 'monospace' },
  fileItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  fileName: { fontSize: 14, color: Colors.textPrimary, flex: 1, fontFamily: 'monospace' },
  fileSize: { fontSize: 11, color: Colors.textSecondary },
  commitItem: { flexDirection: 'row', gap: 12, paddingBottom: 0 },
  commitTimeline: { alignItems: 'center', width: 20 },
  commitDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.secondaryAccent, zIndex: 1 },
  commitLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginTop: -1 },
  commitContent: { flex: 1, paddingBottom: 20 },
  commitMsg: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500', lineHeight: 20 },
  commitMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  commitAuthor: { fontSize: 12, color: Colors.textSecondary },
  shaBadge: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 6, paddingVertical: 2 },
  shaText: { fontSize: 10, color: Colors.primaryAccent, fontFamily: 'monospace', fontWeight: '700' },
  commitDate: { fontSize: 11, color: Colors.textSecondary },
  stateToggle: { flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  stateBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.secondaryAccent },
  stateText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  stateTextActive: { color: Colors.textPrimary },
  issueItem: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  issueContent: { flex: 1 },
  issueTitle: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500', lineHeight: 20 },
  issueMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40, fontSize: 14 },
});
