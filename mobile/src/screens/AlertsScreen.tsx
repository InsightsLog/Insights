import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchWatchlistAlerts, type Release } from '../lib/api';

// ---------------------------------------------------------------------------
// Helpers  (mirrors CalendarScreen)
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
  title: string;
  dateKey: string;
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
// Impact badge  (mirrors CalendarScreen)
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
// AlertsScreen
// ---------------------------------------------------------------------------

export default function AlertsScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsSignedIn(!!user);

      if (!user) {
        setSections([]);
        return;
      }

      const releases = await fetchWatchlistAlerts(7);
      setSections(groupByDate(releases));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
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
        <Text style={styles.loadingText}>Loading alerts…</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.gateTitle}>Sign in required</Text>
        <Text style={styles.gateSubtitle}>
          Sign in to see upcoming releases for your watchlisted indicators.
        </Text>
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
          <Text style={styles.emptyTitle}>No upcoming releases</Text>
          <Text style={styles.emptySubtitle}>
            No releases scheduled in the next 7 days for your watchlisted indicators.
          </Text>
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
  gateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  gateSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
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
