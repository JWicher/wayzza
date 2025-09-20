import { Ionicons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeleteConfirmationModal, showThemedAlert } from '../components/modals';
import { useTheme } from '../contexts/ThemeContext';
import {
  CoordinateRecord,
  deleteRoute,
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
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<DisplayRoute | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  // Load routes with enhanced data
  const loadRoutes = async (retryCount = 0) => {
    // Prevent concurrent loadRoutes calls
    if (isLoadingRoutes) {
      console.log('loadRoutes already in progress, skipping...');
      return;
    }

    try {
      setIsLoadingRoutes(true);
      setLoading(true);

      console.log('Starting to load routes...');
      const dbRoutes = await getRoutes();
      console.log(`Retrieved ${dbRoutes.length} routes from database`);

      // If no routes found, set empty array and finish
      if (!dbRoutes || dbRoutes.length === 0) {
        console.log('No routes found in database');
        setRoutes([]);
        console.log('Setting loading to false - no routes found');
        setLoading(false);
        setIsLoadingRoutes(false);
        return;
      }

      const enhancedRoutes: DisplayRoute[] = [];

      // Process routes individually to avoid complete failure if one route fails
      for (const route of dbRoutes) {
        try {
          // Validate route has valid ID
          if (!route.id || typeof route.id !== 'number') {
            console.warn(`Skipping route with invalid ID:`, route);
            continue;
          }

          const coordinates = await getCoordinatesForRoute(route.id);
          const distance = calculateRouteDistance(coordinates);
          const firstCoordinate = coordinates[0];

          const enhancedRoute: DisplayRoute = {
            id: route.id,
            name: route.name || 'Unnamed Route',
            date: firstCoordinate ? formatDate(firstCoordinate.timestamp) : 'No data',
            distance: formatDistance(distance),
            coordinateCount: coordinates.length
          };

          enhancedRoutes.push(enhancedRoute);
          console.log(`Processed route: ${enhancedRoute.name} (${enhancedRoute.coordinateCount} points)`);
        } catch (routeError) {
          console.error(`Error processing route ${route.name} (ID: ${route.id}):`, routeError);

          // Skip routes that fail to load (likely deleted routes) instead of showing them with error state
          // This prevents deleted routes from briefly appearing in the list
          console.log(`Skipping route ${route.name} (ID: ${route.id}) due to load error - likely deleted`);
          continue;
        }
      }

      // Sort routes by most recent first (based on first coordinate timestamp)
      enhancedRoutes.sort((a, b) => {
        if (a.date === 'No data' && b.date === 'No data') return 0;
        if (a.date === 'No data') return 1;
        if (b.date === 'No data') return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      console.log(`Successfully loaded ${enhancedRoutes.length} routes`);
      setRoutes(enhancedRoutes);
      console.log('Setting loading to false after successful route load');
    } catch (error) {
      console.error('Error loading routes (attempt', retryCount + 1, '):', error);

      // Retry once on failure
      if (retryCount < 1) {
        console.log('Retrying loadRoutes...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        return loadRoutes(retryCount + 1);
      }

      // Show error after retry attempt
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showThemedAlert(
        'Database Error',
        `Failed to load routes from database.\n\nError: ${errorMessage}\n\nPlease try restarting the app if this persists.`,
        [{ text: 'OK' }],
        'alert-circle-outline',
        '#f87171'
      );
    } finally {
      console.log('Setting loading to false in finally block');
      setLoading(false);
      setIsLoadingRoutes(false);
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
        showThemedAlert('Initialization Error', 'Failed to initialize the database.', [
          { text: 'OK' }
        ], 'warning-outline', '#f59e0b');

        // Reset loading states so UI shows "No routes yet" instead of staying on "Loading..."
        console.log('Setting loading to false due to database initialization error');
        setLoading(false);
        setIsLoadingRoutes(false);
        setRoutes([]);
      }
    };

    initializeApp();
  }, []);

  // Reload routes when screen comes into focus (e.g., returning from settings)
  // Skip initial focus to avoid race condition with useEffect
  const [isInitialMount, setIsInitialMount] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (isInitialMount) {
        console.log('Initial focus detected, skipping reload to avoid race condition');
        setIsInitialMount(false);
        return;
      }
      console.log('Index screen focused, reloading routes...');

      // Add a small delay to ensure any cleanup operations from other screens have completed
      // This prevents race conditions with route deletions
      setTimeout(() => {
        loadRoutes();
      }, 100); // Short 100ms delay - just enough to ensure cleanup completes
    }, [isInitialMount])
  );

  useEffect(() => {

    if (deleteModalVisible) {
      NavigationBar.setVisibilityAsync("hidden");
    } else {
      NavigationBar.setVisibilityAsync("visible");
    }
  }, [deleteModalVisible])

  const navigateToSettings = () => {
    router.push('/settings');
  };

  const navigateToTracking = () => {
    router.push('/tracking');
  };

  const handleLongPress = (route: DisplayRoute) => {
    console.log('Long press detected for route:', route.name);
    setRouteToDelete(route);
    setDeleteModalVisible(true);
    NavigationBar.setVisibilityAsync("hidden");

  };

  const handleDeleteRoute = async () => {
    if (!routeToDelete) return;

    try {
      setLoading(true);
      await deleteRoute(routeToDelete.id);
      console.log(`Deleted route: ${routeToDelete.name}`);

      // Close modal and clear selection
      setDeleteModalVisible(false);
      setRouteToDelete(null);

      // Reload routes to reflect the deletion
      await loadRoutes();
    } catch (error) {
      console.error('Error deleting route:', error);
      showThemedAlert('Error', 'Failed to delete the route. Please try again.', [
        { text: 'OK' }
      ], 'alert-circle-outline', '#f87171');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalVisible(false);
    setRouteToDelete(null);
  };

  const renderRouteItem = ({ item }: { item: DisplayRoute }) => (
    <Pressable
      style={({ pressed }) => [
        getStyles(theme).routeItem,
        pressed && { opacity: 0.7, backgroundColor: theme.border }
      ]}
      onPress={() => {
        router.push(`/map?routeId=${item.id}&routeName=${encodeURIComponent(item.name)}`);
      }}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={300}
      onPressIn={() => console.log('Press started on route:', item.name)}
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
    </Pressable>
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
                refreshing={false}
                onRefresh={undefined}
                scrollEnabled={true}
              />
            )}
          </View>
        </View>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          visible={deleteModalVisible}
          onClose={handleCancelDelete}
          onConfirm={handleDeleteRoute}
          title="Delete Route"
          message={`Are you sure you want to delete "${routeToDelete?.name}"?`}
          warning="This action cannot be undone. All tracking data for this route will be permanently deleted."
          theme={theme}
        />
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: theme.text,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalWarning: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.textTertiary + '20',
    borderWidth: 1,
    borderColor: theme.textTertiary + '40',
  },
  deleteButton: {
    backgroundColor: theme.error,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.white || '#FFFFFF',
  },
});
