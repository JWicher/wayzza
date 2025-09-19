import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { darkMapStyle, lightMapStyle } from '../constants/mapStyles';
import { useTheme } from '../contexts/ThemeContext';
import { CoordinateRecord, getCoordinatesForRoute, getRouteById } from '../lib/database';

export default function MapPage() {
  const { theme, isDark } = useTheme();
  const map = useRef<MapView>(null);
  const { routeId, routeName } = useLocalSearchParams<{ routeId: string; routeName: string }>();

  // State for coordinates and loading
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRouteName, setCurrentRouteName] = useState<string>('');

  // Load route data from database
  const handleEditRoute = () => {
    if (routeId) {
      router.push(`/edit-route?routeId=${routeId}`);
    }
  };

  const loadRouteData = async () => {
    if (!routeId) {
      setError('No route ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const routeIdNumber = parseInt(routeId, 10);

      // Get route info
      const route = await getRouteById(routeIdNumber);
      if (!route) {
        setError('Route not found');
        setLoading(false);
        return;
      }

      setCurrentRouteName(route.name);

      // Get coordinates for the route
      const routeCoordinates = await getCoordinatesForRoute(routeIdNumber);

      if (routeCoordinates.length === 0) {
        setError('No coordinates found for this route');
        setLoading(false);
        return;
      }

      // Convert database coordinates to map coordinates format
      const mapCoordinates = routeCoordinates.map((coord: CoordinateRecord) => ({
        latitude: coord.latitude,
        longitude: coord.longitude
      }));

      setCoordinates(mapCoordinates);
    } catch (error) {
      console.error('Error loading route data:', error);
      setError('Failed to load route data');
      Alert.alert('Error', 'Failed to load route data from database.');
    } finally {
      setLoading(false);
    }
  };

  // Reload data when screen comes into focus (e.g., after returning from edit page)
  useFocusEffect(
    useCallback(() => {
      loadRouteData();
    }, [routeId])
  );

  // Fit map to coordinates when they're loaded
  useEffect(() => {
    if (coordinates.length > 0 && map.current) {
      setTimeout(() => {
        map.current?.fitToCoordinates(coordinates, {
          edgePadding: {
            top: 40,
            right: 40,
            bottom: 40,
            left: 40,
          },
          animated: true,
        });
      }, 100);
    }
  }, [coordinates]);

  if (loading) {
    return (
      <View style={getStyles(theme).container}>
        <View style={getStyles(theme).loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={getStyles(theme).loadingText}>Loading route...</Text>
        </View>
      </View>
    );
  }

  if (error || coordinates.length === 0) {
    return (
      <View style={getStyles(theme).container}>
        <View style={getStyles(theme).errorContainer}>
          <Text style={getStyles(theme).errorText}>
            {error || 'No coordinates available for this route'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={getStyles(theme).container}>
      <View style={getStyles(theme).header}>
        <View style={getStyles(theme).headerContent}>
          <View style={getStyles(theme).routeInfo}>
            <Text style={getStyles(theme).routeTitle}>
              {currentRouteName || routeName || 'Route Map'}
            </Text>
            <Text style={getStyles(theme).coordinateCount}>
              {coordinates.length} points
            </Text>
          </View>
          <TouchableOpacity
            style={getStyles(theme).editButton}
            onPress={handleEditRoute}
          >
            <Ionicons name="create-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <MapView
        ref={map}
        style={getStyles(theme).map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={isDark ? darkMapStyle : lightMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        <Marker
          coordinate={coordinates[0]}
          title='Start'
          pinColor="green"
        />
        <Marker
          coordinate={coordinates[coordinates.length - 1]}
          title='Finish'
          pinColor="red"
        />
        <Polyline
          strokeColor={isDark ? '#60a5fa' : '#dc2626'}
          strokeWidth={3}
          coordinates={coordinates}
        />
      </MapView>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.surface,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.border || '#E5E5E5',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeInfo: {
    flex: 1,
    alignItems: 'center',
  },
  routeTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  coordinateCount: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: theme.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
