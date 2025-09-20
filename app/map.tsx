import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { DeleteConfirmationModal, EditRouteModal, showThemedAlert } from '../components/modals';
import { darkMapStyle, lightMapStyle } from '../constants/mapStyles';
import { useTheme } from '../contexts/ThemeContext';
import { CoordinateRecord, deleteRoute, getCoordinatesForRoute, getRouteById, updateRoute } from '../lib/database';

export default function MapPage() {
  const { theme, isDark } = useTheme();
  const map = useRef<MapView>(null);
  const { routeId, routeName } = useLocalSearchParams<{ routeId: string; routeName: string }>();

  // State for coordinates and loading
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRouteName, setCurrentRouteName] = useState<string>('');

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRouteName, setEditRouteName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit route modal functions
  const openEditModal = () => {
    if (!routeId) return;
    setEditRouteName(currentRouteName || routeName || '');
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!routeId) return;

    const trimmedName = editRouteName.trim();
    if (!trimmedName) {
      showThemedAlert('Invalid Name', 'Please enter a route name.', [
        { text: 'OK' }
      ], 'warning-outline', '#f59e0b');
      return;
    }

    if (trimmedName === currentRouteName) {
      // No changes made
      setShowEditModal(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateRoute(parseInt(routeId), trimmedName);
      setCurrentRouteName(trimmedName);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating route:', error);
      showThemedAlert('Error', 'Failed to update route. The name might already exist.', [
        { text: 'OK' }
      ], 'alert-circle-outline', '#f87171');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmEditDelete = async () => {
    if (!routeId) return;

    setShowDeleteConfirm(false);
    setShowEditModal(false);
    try {
      await deleteRoute(parseInt(routeId));
      router.replace('/');
    } catch (error) {
      console.error('Error deleting route:', error);
      showThemedAlert('Error', 'Failed to delete route.', [
        { text: 'OK' }
      ], 'alert-circle-outline', '#f87171');
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
      showThemedAlert('Error', 'Failed to load route data from database.', [
        { text: 'OK' }
      ], 'alert-circle-outline', '#f87171');
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
            onPress={openEditModal}
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

      {/* Edit Route Modal */}
      <EditRouteModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleEditSave}
        onDelete={handleEditDelete}
        routeName={editRouteName}
        setRouteName={setEditRouteName}
        isSaving={isSaving}
        isDark={isDark}
        theme={theme}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmEditDelete}
        title="Delete Route"
        message={`Are you sure you want to delete "${currentRouteName || routeName}"? This will also delete all coordinates for this route.`}
        isDark={isDark}
        theme={theme}
      />
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  modalContainer: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalSaveButton: {
    backgroundColor: theme.primary,
  },
  modalCancelButtonText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaveButtonText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  deleteButtonText: {
    color: theme.error,
    fontSize: 16,
    fontWeight: '500',
  },
  // Confirmation modal styles
  confirmationModalContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  confirmationIcon: {
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  destructiveButton: {
    backgroundColor: theme.error,
  },
  destructiveButtonText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
