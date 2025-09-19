import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import {
  CoordinateRecord,
  getCoordinatesForRoute,
  getRoutes,
  initializeDatabase
} from '../lib/database';

// Enhanced route interface with calculated data
interface DisplayRoute {
  id: number;
  name: string;
  date: string;
  distance: string;
  coordinateCount: number;
}

// Utility function to calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Calculate total distance for a route from coordinates
const calculateRouteDistance = (coordinates: CoordinateRecord[]): number => {
  if (coordinates.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistance(
      coordinates[i - 1].latitude,
      coordinates[i - 1].longitude,
      coordinates[i].latitude,
      coordinates[i].longitude
    );
  }
  return totalDistance;
};

// Format distance for display
const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

// Format date for display
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export default function Index() {
  const router = useRouter();
  const { theme } = useTheme();

  // State management
  const [routes, setRoutes] = useState<DisplayRoute[]>([]);
  const [loading, setLoading] = useState(true);

  // Load routes with enhanced data
  const loadRoutes = async () => {
    try {
      setLoading(true);
      const dbRoutes = await getRoutes();

      const enhancedRoutes: DisplayRoute[] = await Promise.all(
        dbRoutes.map(async (route) => {
          const coordinates = await getCoordinatesForRoute(route.id!);
          const distance = calculateRouteDistance(coordinates);
          const firstCoordinate = coordinates[0];

          return {
            id: route.id!,
            name: route.name,
            date: firstCoordinate ? formatDate(firstCoordinate.timestamp) : 'No data',
            distance: formatDistance(distance),
            coordinateCount: coordinates.length
          };
        })
      );

      // Sort routes by most recent first (based on first coordinate timestamp)
      enhancedRoutes.sort((a, b) => {
        if (a.date === 'No data' && b.date === 'No data') return 0;
        if (a.date === 'No data') return 1;
        if (b.date === 'No data') return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setRoutes(enhancedRoutes);
    } catch (error) {
      console.error('Error loading routes:', error);
      Alert.alert('Error', 'Failed to load routes from database.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize database and load routes when app starts
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initializeDatabase();
        console.log('Database initialized successfully from index');
        await loadRoutes();
      } catch (error) {
        console.error('Error initializing database:', error);
        Alert.alert('Initialization Error', 'Failed to initialize the database.');
      }
    };

    initializeApp();
  }, []);

  // Reload routes when screen comes into focus (e.g., returning from settings)
  useFocusEffect(
    useCallback(() => {
      console.log('Index screen focused, reloading routes...');
      loadRoutes();
    }, [])
  );

  const navigateToSettings = () => {
    router.push('/settings');
  };

  const navigateToTracking = () => {
    router.push('/tracking');
  };

  const renderRouteItem = ({ item }: { item: DisplayRoute }) => (
    <TouchableOpacity
      style={getStyles(theme).routeItem}
      onPress={() => {
        router.push(`/map?routeId=${item.id}&routeName=${encodeURIComponent(item.name)}`);
      }}
    >
      <View style={getStyles(theme).routeHeader}>
        <Text style={getStyles(theme).routeName}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
      </View>
      <View style={getStyles(theme).routeDetails}>
        <Text style={getStyles(theme).routeDate}>{item.date}</Text>
        <Text style={getStyles(theme).routeDistance}>{item.distance}</Text>
      </View>
      <View style={getStyles(theme).routeStats}>
        <Text style={getStyles(theme).routeStatsText}>
          {item.coordinateCount} points
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={getStyles(theme).container}>
        <View style={getStyles(theme).content}>
          {/* Header with buttons */}
          <View style={getStyles(theme).headerButtons}>
            <TouchableOpacity
              style={[getStyles(theme).button, getStyles(theme).settingsButton]}
              onPress={navigateToSettings}
            >
              <Ionicons name="settings-outline" size={24} color="white" />
              <Text style={getStyles(theme).buttonText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[getStyles(theme).button, getStyles(theme).trackingButton]}
              onPress={navigateToTracking}
            >
              <Ionicons name="play-circle" size={24} color="white" />
              <Text style={getStyles(theme).buttonText}>Start Tracking</Text>
            </TouchableOpacity>
          </View>


          {/* Routes List */}
          <View style={getStyles(theme).routesSection}>
            <Text style={getStyles(theme).sectionTitle}>Your Routes</Text>
            {loading ? (
              <View style={getStyles(theme).loadingContainer}>
                <Text style={getStyles(theme).loadingText}>Loading routes...</Text>
              </View>
            ) : routes.length === 0 ? (
              <View style={getStyles(theme).emptyContainer}>
                <Ionicons name="location-outline" size={48} color={theme.textTertiary} />
                <Text style={getStyles(theme).emptyTitle}>No routes yet</Text>
                <Text style={getStyles(theme).emptyText}>
                  Start tracking your first route to see it here
                </Text>
              </View>
            ) : (
              <FlatList
                data={routes}
                renderItem={renderRouteItem}
                keyExtractor={(item) => item.id.toString()}
                style={getStyles(theme).routesList}
                showsVerticalScrollIndicator={false}
                refreshing={loading}
                onRefresh={loadRoutes}
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.background,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 15,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  buttonStart: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  settingsButton: {
    backgroundColor: theme.primary,
  },
  mapButton: {
    backgroundColor: theme.accent,
  },
  trackingButton: {
    backgroundColor: theme.secondary,
  },
  buttonText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '600',
  },
  routesSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 20,
  },
  routesList: {
    flex: 1,
    backgroundColor: theme.background,
  },
  routeItem: {
    backgroundColor: theme.surface,
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routeDate: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  routeDistance: {
    fontSize: 14,
    color: theme.accent,
    fontWeight: '500',
  },
  routeStats: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border || '#E5E5E5',
  },
  routeStatsText: {
    fontSize: 12,
    color: theme.textTertiary,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
