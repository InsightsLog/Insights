import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchReleases, type Release } from '../lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO datetime string as a display date, e.g. "Thu, Feb 20 2026". */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format an ISO datetime string as a short time, e.g. "08:30 AM". */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Return a stable YYYY-MM-DD string for grouping. */
function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

interface Section {
  title: string;    // display label, e.g. "Thu, Feb 20 2026"
  dateKey: string;  // YYYY-MM-DD for sorting
  data: Release[];
}

/** Group a flat list of releases into sections ordered by date ascending. */
function groupByDate(releases: Release[]): Section[] {
  const map = new Map<string, Section>();

  for (const release of releases) {
    const key = dateKey(release.release_at);
    if (!map.has(key)) {
      map.set(key, {
        title: formatDate(release.release_at),
        dateKey: key,
        data: [],
      });
    }
    map.get(key)!.data.push(release);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );
}

// ---------------------------------------------------------------------------
// Impact badge
// ---------------------------------------------------------------------------

const IMPACT_COLORS: Record<string, string> = {
  high: '#d9534f',
  medium: '#f0ad4e',
  low: '#5cb85c',
};

function ImpactBadge({ importance }: { importance: 'low' | 'medium' | 'high' }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: IMPACT_COLORS[importance] ?? '#999' },
      ]}
    >
      <Text style={styles.badgeText}>{importance.toUpperCase()}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Release row
// ---------------------------------------------------------------------------

function ReleaseRow({ item }: { item: Release }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.indicatorName}>{item.indicator.name}</Text>
        <Text style={styles.meta}>
          {item.indicator.country_code} · {formatTime(item.release_at)}
        </Text>
      </View>
      <ImpactBadge importance={item.indicator.importance} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// CalendarScreen
// ---------------------------------------------------------------------------

export default function CalendarScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch next 30 days of releases
      const now = new Date();
      const future = new Date(now);
      future.setDate(future.getDate() + 30);

      const result = await fetchReleases({
        from_date: now.toISOString(),
        to_date: future.toISOString(),
        limit: 100,
      });

      setSections(groupByDate(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load releases');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading releases…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⚠ {error}</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ReleaseRow item={item} />}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.subtitle}>No upcoming releases found.</Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor="#007AFF"
        />
      }
      contentContainerStyle={sections.length === 0 ? styles.emptyContent : undefined}
      stickySectionHeadersEnabled
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyContent: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  errorText: {
    fontSize: 15,
    color: '#d9534f',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    backgroundColor: '#f0f0f5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  rowLeft: {
    flex: 1,
  },
  indicatorName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
    marginBottom: 2,
  },
  meta: {
    fontSize: 13,
    color: '#777',
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});

