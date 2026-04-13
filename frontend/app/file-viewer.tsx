import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Octicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { githubApi } from '@/src/utils/api';
import { Colors } from '@/src/constants/theme';

export default function FileViewerScreen() {
  const { owner, name, path, filename } = useLocalSearchParams<{
    owner: string; name: string; path: string; filename: string;
  }>();
  const { token } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    if (token && owner && name && path) {
      fetchFile();
    }
  }, [token, owner, name, path]);

  const fetchFile = async () => {
    try {
      const data = await githubApi(`/repos/${owner}/${name}/contents`, token!, { path: path! });
      if (data.content) {
        const decoded = atob(data.content.replace(/\n/g, ''));
        setContent(decoded);
        setLineCount(decoded.split('\n').length);
      } else if (data.download_url) {
        const res = await fetch(data.download_url);
        const text = await res.text();
        setContent(text);
        setLineCount(text.split('\n').length);
      }
    } catch (e) {
      setContent('Unable to load file content');
    } finally {
      setLoading(false);
    }
  };

  const lines = content.split('\n');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="file-back-button" onPress={() => router.back()} style={styles.backBtn}>
          <Octicons name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerPath} numberOfLines={1}>{path}</Text>
          <Text style={styles.headerMeta}>{lineCount} lines</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondaryAccent} />
        </View>
      ) : (
        <ScrollView style={styles.codeContainer} horizontal={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.codeBlock}>
              <View style={styles.lineNumbers}>
                {lines.map((_, i) => (
                  <Text key={i} style={styles.lineNum}>{i + 1}</Text>
                ))}
              </View>
              <View style={styles.codeContent}>
                {lines.map((line, i) => (
                  <Text key={i} style={styles.codeLine}>{line || ' '}</Text>
                ))}
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerPath: { fontSize: 14, color: Colors.textPrimary, fontFamily: 'monospace', fontWeight: '600' },
  headerMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  codeContainer: { flex: 1, backgroundColor: Colors.surface },
  codeBlock: { flexDirection: 'row', paddingVertical: 8 },
  lineNumbers: { paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: Colors.border },
  lineNum: {
    fontSize: 12, fontFamily: 'monospace', color: Colors.textSecondary,
    lineHeight: 20, textAlign: 'right', minWidth: 30,
  },
  codeContent: { paddingHorizontal: 16 },
  codeLine: {
    fontSize: 12, fontFamily: 'monospace', color: Colors.textPrimary,
    lineHeight: 20,
  },
});
