import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as NavigationBar from 'expo-navigation-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeleteConfirmationModal, EditRouteModal, showThemedAlert } from '../components/modals';
import { darkMapStyle, lightMapStyle } from '../constants/mapStyles';
import { usePermissions } from '../contexts/PermissionContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    addCoordinateRecord,
    createRoute,
    deleteRoute,
    getCoordinatesForRoute,
    getRouteById,
    getTrackingSettings,
    initializeDatabase,
    RouteRecord,
    updateRoute
} from '../lib/database';

interface Coordinate {
    latitude: number;
    longitude: number;
    timestamp: number;
}

// Default tracking intervals (will be overridden by settings)
const DEFAULT_TRACKING_INTERVAL_SECONDS = 5;
const DEFAULT_TRACKING_INTERVAL_M = 10;

// Background location task name
const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Track if background task is defined
let isTaskDefined = false;

// Define the background location task only when needed
const defineBackgroundLocationTask = () => {
    if (isTaskDefined) return;

    try {
        TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
            if (error) {
                console.error('Background location task error:', error);
                return;
            }

            if (data) {
                const { locations }: any = data;
                console.log('Received background location update:', locations.length, 'locations');

                // Handle background location data
                for (const location of locations) {
                    try {
                        // We need to get the current route ID from AsyncStorage since we can't access React state here
                        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                        const currentRouteData = await AsyncStorage.getItem('currentTrackingRoute');

                        if (currentRouteData) {
                            const routeInfo = JSON.parse(currentRouteData);

                            // Import database functions (they should work in background task)
                            const { addCoordinateRecord, initializeDatabase } = require('../lib/database');

                            // Ensure database is initialized
                            await initializeDatabase();

                            // Save the location
                            await addCoordinateRecord(
                                routeInfo.id,
                                location.coords.latitude,
                                location.coords.longitude,
                                location.timestamp || Date.now()
                            );

                            console.log('Background location saved for route:', routeInfo.id);
                        }
                    } catch (err) {
                        console.error('Error processing background location:', err);
                    }
                }
            }
        });
        isTaskDefined = true;
        console.log('Background task defined successfully');
    } catch (error) {
        console.error('Error defining background task:', error);
    }
};

const biskupinCoords = {
    latitude: 52.793000, // Default to Warsaw, Poland
    longitude: 17.734000,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
}

export default function TrackingPage() {
    console.log('[TrackingPage] Component rendering...');

    const { theme, isDark } = useTheme();
    console.log('[TrackingPage] Theme loaded:', isDark ? 'dark' : 'light');

    const { foregroundPermissionGranted, backgroundPermissionGranted } = usePermissions();
    console.log('[TrackingPage] Permissions:', { foreground: foregroundPermissionGranted, background: backgroundPermissionGranted });

    const { routeId, routeName } = useLocalSearchParams<{ routeId?: string; routeName?: string }>();
    console.log('[TrackingPage] URL params:', { routeId, routeName });

    const [isTracking, setIsTracking] = useState(false);
    const [accuracy, setAccuracy] = useState<number>();
    const [initializationError, setInitializationError] = useState<string | null>(null);

    const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
    const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
    const mapRef = useRef<MapView>(null);

    // Current route state
    const [currentRoute, setCurrentRoute] = useState<RouteRecord | null>(null);

    // Auto-created route management
    const [hasEverStartedTracking, setHasEverStartedTracking] = useState(false);

    // Dynamic tracking intervals loaded from settings
    const [trackingIntervalSeconds, setTrackingIntervalSeconds] = useState(DEFAULT_TRACKING_INTERVAL_SECONDS);
    const [trackingIntervalM, setTrackingIntervalM] = useState(DEFAULT_TRACKING_INTERVAL_M);

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editRouteName, setEditRouteName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Ref to store current route for cleanup function
    const currentRouteRef = useRef<RouteRecord | null>(null);

    // Ref to track if we've saved any coordinates (to prevent premature cleanup)
    const hasSavedCoordinates = useRef<boolean>(false);


    // Load tracking settings from database
    const loadTrackingSettings = async () => {
        try {
            const settings = await getTrackingSettings();
            setTrackingIntervalSeconds(settings.intervalSeconds);
            setTrackingIntervalM(settings.intervalM);
            console.log(`Loaded tracking settings: ${settings.intervalSeconds}s, ${settings.intervalM}m`);
        } catch (error) {
            console.error('Error loading tracking settings:', error);
            // Keep default values if loading fails
        }
    };

    // Initialize auto route and request permissions on component mount
    useEffect(() => {
        const initializeTrackingPage = async () => {
            try {
                console.log('Initializing tracking page...');

                // Initialize database first (doesn't require permissions)
                try {
                    await initializeDatabase();
                    console.log('Database initialized successfully');
                } catch (dbError) {
                    console.error('Critical: Database initialization failed:', dbError);
                    setInitializationError('Database initialization failed. Please reinstall the app.');
                    showThemedAlert('Database Error', 'Failed to initialize database. Please reinstall the app.', [
                        { text: 'OK' }
                    ], 'alert-circle-outline', '#f87171');
                    return;
                }

                // Load settings
                try {
                    await loadTrackingSettings();
                    console.log('Settings loaded successfully');
                } catch (settingsError) {
                    console.error('Warning: Failed to load tracking settings, using defaults:', settingsError);
                    // Continue with defaults
                }

                // Load existing route or create auto route
                try {
                    await loadOrCreateRoute();
                    console.log('Tracking page initialization complete');
                } catch (routeError) {
                    console.error('Warning: Failed to load/create route:', routeError);
                    // Non-critical, can be created later
                }

            } catch (error) {
                console.error('Error initializing tracking page:', error);
                setInitializationError('Failed to initialize tracking. Please restart the app.');
                showThemedAlert('Initialization Error', 'Failed to initialize tracking. Please restart the app.', [
                    { text: 'OK' }
                ], 'warning-outline', '#f59e0b');
            }
        };

        // Delay initialization to ensure contexts are ready
        const timer = setTimeout(initializeTrackingPage, 100);
        return () => {
            clearTimeout(timer);

            console.log('TrackingPage: Component unmounting, running cleanup...');

            // Stop location tracking
            if (locationSubscription) {
                locationSubscription.remove();
                console.log('TrackingPage: Location subscription removed');
            }

            // Stop background location tracking
            const stopBackgroundLocation = async () => {
                try {
                    const isBackgroundTaskRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
                    if (isBackgroundTaskRunning) {
                        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                        console.log('TrackingPage: Background location tracking stopped');
                    }
                    await AsyncStorage.removeItem('currentTrackingRoute');
                } catch (error) {
                    console.error('TrackingPage: Error stopping background location:', error);
                }
            };
            stopBackgroundLocation();

            // Cleanup unused route only if it was auto-created and never used
            // Don't cleanup routes that were loaded from URL params (continuing existing routes)
            console.log('[CLEANUP] Starting cleanup check...');

            const route = currentRouteRef.current;
            const hasCoordinates = hasSavedCoordinates.current;

            console.log('[CLEANUP] Route:', route?.id, route?.name);
            console.log('[CLEANUP] Has coordinates flag:', hasCoordinates);
            console.log('[CLEANUP] From URL params:', !!routeId);

            // ZMIENIONE: Bardziej ostrożny cleanup - czekamy dłużej przed usunięciem
            // Only cleanup if this was NOT a route loaded from URL params AND we haven't saved any coordinates
            // I TYLKO jeśli tracking NIE był aktywny (nie usuwaj jeśli user startował tracking)
            if (route?.id && !routeId && !hasCoordinates && !isTracking) {
                console.log('[CLEANUP] Checking if route should be deleted...');

                // Dodatkowe opóźnienie - daj szansę na zapisanie pierwszej współrzędnej
                setTimeout(() => {
                    // Double-check database to be safe
                    getCoordinatesForRoute(route.id!)
                        .then(coordinates => {
                            console.log('[CLEANUP] Database check: found', coordinates.length, 'coordinates');
                            if (coordinates.length === 0 && route.id) {
                                console.log('[CLEANUP] ⚠️ Deleting empty route:', route.name);
                                return deleteRoute(route.id);
                            } else {
                                console.log('[CLEANUP] ✓ Keeping route with', coordinates.length, 'coordinates');
                            }
                        })
                        .then(() => {
                            console.log('[CLEANUP] Cleanup completed');
                        })
                        .catch(error => {
                            console.error('[CLEANUP] ❌ Error during cleanup:', error);
                        });
                }, 2000); // 2 second delay to allow first coordinate to save
            } else {
                if (routeId) {
                    console.log('[CLEANUP] ✓ Skipping - route from URL params');
                } else if (hasCoordinates) {
                    console.log('[CLEANUP] ✓ Skipping - has saved coordinates');
                } else if (isTracking) {
                    console.log('[CLEANUP] ✓ Skipping - tracking is active, don\'t delete!');
                } else {
                    console.log('[CLEANUP] ℹ️ No route to cleanup');
                }
            }
        };
    }, [foregroundPermissionGranted, backgroundPermissionGranted, routeId]);

    // Update map view when coordinates change
    useEffect(() => {
        if (coordinates.length > 0 && mapRef.current) {
            const latLngCoordinates = coordinates.map(coord => ({
                latitude: coord.latitude,
                longitude: coord.longitude,
            }));

            mapRef.current.fitToCoordinates(latLngCoordinates, {
                edgePadding: {
                    top: 50,
                    right: 50,
                    bottom: 50,
                    left: 50,
                },
                animated: true,
            });
        }
    }, [coordinates]);

    // Update the ref whenever currentRoute changes
    useEffect(() => {
        currentRouteRef.current = currentRoute;
    }, [currentRoute]);

    // Periodically reload coordinates from database during tracking
    // This ensures we see coordinates saved by background task
    useEffect(() => {
        if (!isTracking || !currentRoute?.id) return;

        const intervalId = setInterval(async () => {
            try {
                const dbCoordinates = await getCoordinatesForRoute(currentRoute.id!);
                const formattedCoordinates = dbCoordinates.map(coord => ({
                    latitude: coord.latitude,
                    longitude: coord.longitude,
                    timestamp: coord.timestamp
                }));
                setCoordinates(formattedCoordinates);
            } catch (error) {
                console.error('Error reloading coordinates during tracking:', error);
            }
        }, 3000); // Reload every 3 seconds

        return () => clearInterval(intervalId);
    }, [isTracking, currentRoute?.id]);



    const loadCoordinatesForRoute = async (routeId: number) => {
        try {
            const dbCoordinates = await getCoordinatesForRoute(routeId);
            const formattedCoordinates = dbCoordinates.map(coord => ({
                latitude: coord.latitude,
                longitude: coord.longitude,
                timestamp: coord.timestamp
            }));
            setCoordinates(formattedCoordinates);

            // Mark that we have coordinates if any were loaded
            if (formattedCoordinates.length > 0) {
                hasSavedCoordinates.current = true;
            }
        } catch (error) {
            console.error('Error loading coordinates for route:', error);
        }
    };

    const loadOrCreateRoute = async () => {
        // If routeId is provided via URL params, load that existing route
        if (routeId) {
            console.log('Loading existing route with ID:', routeId, 'Name:', routeName);
            try {
                const routeIdNumber = parseInt(routeId, 10);
                const route = await getRouteById(routeIdNumber);

                if (route) {
                    setCurrentRoute(route);
                    // Load existing coordinates for this route
                    await loadCoordinatesForRoute(routeIdNumber);
                    console.log('Loaded existing route successfully:', route);
                } else {
                    console.error('Route not found with ID:', routeId);
                    // Fallback to creating a new route
                    await createAutoRoute();
                }
            } catch (error) {
                console.error('Error loading existing route:', error);
                // Fallback to creating a new route
                await createAutoRoute();
            }
        } else {
            // No routeId provided, create a new auto route
            await createAutoRoute();
        }
    };

    const createAutoRoute = async () => {
        console.log('Creating auto route...');
        try {
            // Generate a unique name with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const date = timestamp.split('T')[0];
            const time = timestamp.split('T')[1].substring(0, 8).replace(/-/g, ':');

            const autoRouteName = `${date} ${time}`;
            console.log('Auto route name:', autoRouteName);

            const route = await createRoute(autoRouteName);

            setCurrentRoute(route);
            setCoordinates([]); // Clear coordinates for new route
            hasSavedCoordinates.current = false; // Reset flag for new route

            console.log('Auto-created route successfully:', route);
        } catch (error) {
            console.error('Error creating auto route:', error);
            // Don't show alert for auto-creation failure, just log it
        }
    };

    const cleanupUnusedRoute = async () => {
        // Delete the current route if it has no coordinates
        // Use ref to get the current value instead of closure-captured value
        const route = currentRouteRef.current;
        console.log('cleanupUnusedRoute: Checking route for cleanup:', route?.id, route?.name);

        if (route?.id) {
            try {
                const routeCoordinates = await getCoordinatesForRoute(route.id);
                console.log('cleanupUnusedRoute: Route has', routeCoordinates.length, 'coordinates');
                if (routeCoordinates.length === 0) {
                    console.log('cleanupUnusedRoute: Deleting unused route:', route.name, '(ID:', route.id, ')');
                    await deleteRoute(route.id);
                    console.log('cleanupUnusedRoute: Successfully deleted unused route');
                    setCurrentRoute(null);
                    setCoordinates([]);
                } else {
                    console.log('cleanupUnusedRoute: Route has coordinates, keeping it');
                }
            } catch (error) {
                console.error('cleanupUnusedRoute: Error cleaning up unused route:', error);
            }
        } else {
            console.log('cleanupUnusedRoute: No route to cleanup');
        }
    };

    const openEditModal = async () => {
        NavigationBar.setVisibilityAsync("hidden");
        console.log('Edit button clicked, currentRoute:', currentRoute);

        let routeToEdit = currentRoute;

        // Create a new route if one doesn't exist
        if (!routeToEdit) {
            try {
                console.log('No current route, creating new route for editing...');
                // Generate a unique name with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const date = timestamp.split('T')[0];
                const time = timestamp.split('T')[1].substring(0, 8).replace(/-/g, ':');
                const autoRouteName = `${date} ${time}`;

                const newRoute = await createRoute(autoRouteName);
                setCurrentRoute(newRoute);
                setCoordinates([]);
                routeToEdit = newRoute;
                console.log('Created new route for editing:', newRoute);
            } catch (error) {
                console.error('Error creating route for editing:', error);
                showThemedAlert('Route Creation Failed', 'Unable to create a new route.', [
                    { text: 'OK' }
                ], 'alert-circle-outline', '#f87171');
                return;
            }
        }

        setEditRouteName(routeToEdit.name);
        setShowEditModal(true);
    };

    const handleEditSave = async () => {
        if (!currentRoute) return;

        const trimmedName = editRouteName.trim();
        if (!trimmedName) {
            showThemedAlert('Invalid Name', 'Please enter a route name.', [
                { text: 'OK' }
            ], 'warning-outline', '#f59e0b');
            return;
        }

        if (trimmedName === currentRoute.name) {
            // No changes made
            setShowEditModal(false);
            return;
        }

        setIsSaving(true);
        try {
            await updateRoute(currentRoute.id!, trimmedName);
            setCurrentRoute({ ...currentRoute, name: trimmedName });
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
        if (!currentRoute) return;

        setShowDeleteConfirm(false);
        setShowEditModal(false);
        try {
            await deleteRoute(currentRoute.id!);
            setCurrentRoute(null);
            setCoordinates([]);
            router.replace('/');
        } catch (error) {
            console.error('Error deleting route:', error);
            showThemedAlert('Error', 'Failed to delete route.', [
                { text: 'OK' }
            ], 'alert-circle-outline', '#f87171');
        }
    };

    // Reload route data when returning from edit page
    useFocusEffect(
        useCallback(() => {
            const reloadCurrentRoute = async () => {
                if (currentRoute?.id) {
                    try {
                        const dbCoordinates = await getCoordinatesForRoute(currentRoute.id);
                        const formattedCoordinates = dbCoordinates.map(coord => ({
                            latitude: coord.latitude,
                            longitude: coord.longitude,
                            timestamp: coord.timestamp
                        }));
                        setCoordinates(formattedCoordinates);
                    } catch (error) {
                        console.error('Error reloading coordinates:', error);
                    }
                }
            };
            reloadCurrentRoute();
        }, [currentRoute?.id])
    );

    // Reload tracking settings when returning from settings page
    useFocusEffect(
        useCallback(() => {
            loadTrackingSettings();
        }, [])
    );





    const startTracking = async () => {
        // Check if foreground permissions are granted
        if (!foregroundPermissionGranted) {
            showThemedAlert(
                'Permission Required',
                'Location permissions are required to track your trip. Please restart the app and grant permissions.',
                [{ text: 'OK' }],
                'location-outline'
            );
            return;
        }

        // Define the background task before using it
        defineBackgroundLocationTask();

        let routeToUse = currentRoute;

        // Create a new route if one doesn't exist
        if (!routeToUse) {
            try {
                console.log('No current route, creating new route for tracking...');
                // Generate a unique name with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const date = timestamp.split('T')[0];
                const time = timestamp.split('T')[1].substring(0, 8).replace(/-/g, ':');
                const autoRouteName = `${date} ${time}`;

                const newRoute = await createRoute(autoRouteName);
                setCurrentRoute(newRoute);
                setCoordinates([]);
                routeToUse = newRoute;
                console.log('Created new route for tracking:', newRoute);
            } catch (error) {
                console.error('Error creating route for tracking:', error);
                showThemedAlert('Route Creation Failed', 'Unable to create a new route for tracking.', [
                    { text: 'OK' }
                ], 'alert-circle-outline', '#f87171');
                return;
            }
        }

        if (!routeToUse?.id) {
            showThemedAlert('Route Error', 'Unable to create or access a route for tracking.', [
                { text: 'OK' }
            ], 'alert-circle-outline', '#f87171');
            return;
        }

        console.log('[TRACKING] ========== STARTING TRACKING ==========');
        console.log('[TRACKING] Route ID:', routeToUse.id);
        console.log('[TRACKING] Route Name:', routeToUse.name);

        setIsTracking(true);
        setHasEverStartedTracking(true);

        try {
            // Store route information in AsyncStorage for background task access
            await AsyncStorage.setItem('currentTrackingRoute', JSON.stringify({
                id: routeToUse.id,
                name: routeToUse.name
            }));
            console.log('[TRACKING] Route info saved to AsyncStorage');

            // Use the background permission status from context
            // TYMCZASOWO WYŁĄCZONE - TEST CZY TO POWODUJE CRASH
            const canUseBackground = false; // BYŁO: backgroundPermissionGranted;
            console.log('[TRACKING] Background tracking DISABLED for testing');
            console.log('[TRACKING] Will use FOREGROUND tracking only');

            if (canUseBackground) {
                console.log('Starting background location tracking...');

                // Start background location tracking
                await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                    accuracy: Location.Accuracy.High,
                    timeInterval: trackingIntervalSeconds * 1000,
                    distanceInterval: trackingIntervalM,
                    deferredUpdatesInterval: 1000, // Batch updates every second
                    showsBackgroundLocationIndicator: true, // iOS only
                    foregroundService: {
                        notificationTitle: 'Where I Was',
                        notificationBody: 'Tracking your location in the background',
                    },
                });
                console.log('Background location tracking started');
            } else {
                console.log('[TRACKING] Background permissions not granted, using foreground tracking only');
            }

            // Also start foreground tracking for immediate UI updates
            console.log('[TRACKING] Starting foreground location tracking...');
            console.log('[TRACKING] Config:', {
                accuracy: 'High',
                timeInterval: trackingIntervalSeconds * 1000,
                distanceInterval: trackingIntervalM
            });

            const subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: trackingIntervalSeconds * 1000,
                    distanceInterval: trackingIntervalM,
                },
                async (location) => {
                    const newCoordinate: Coordinate = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        timestamp: Date.now(),
                    };
                    console.log('[TRACKING] ✓ New coordinate received:', newCoordinate);
                    console.log('[TRACKING] Accuracy:', location.coords.accuracy, 'm');

                    try {
                        // Save to database
                        console.log('[TRACKING] Saving to database, route ID:', routeToUse.id);
                        await addCoordinateRecord(
                            routeToUse.id!,
                            newCoordinate.latitude,
                            newCoordinate.longitude,
                            newCoordinate.timestamp
                        );
                        console.log('[TRACKING] ✓ Saved to database successfully!');

                        // Mark that we've saved coordinates (prevents premature cleanup)
                        hasSavedCoordinates.current = true;
                        console.log('[TRACKING] hasSavedCoordinates flag set to true');

                        // Update state array for UI
                        setCoordinates(prev => {
                            const updated = [...prev, newCoordinate];
                            console.log('[TRACKING] UI updated, total coordinates:', updated.length);
                            return updated;
                        });
                        setAccuracy(location.coords.accuracy || 0);
                    } catch (error) {
                        console.error('[TRACKING] ❌ ERROR saving coordinate:', error);
                    }
                }
            );

            setLocationSubscription(subscription);
            console.log('[TRACKING] ✓ Foreground tracking started successfully!');
            console.log('[TRACKING] Subscription active:', !!subscription);
            console.log('[TRACKING] ========== TRACKING IS ACTIVE ==========');

            // Show success message to user
            showThemedAlert(
                'Tracking Started',
                `Tracking your location. Stay on this screen to record your route.`,
                [{ text: 'OK' }],
                'checkmark-circle-outline',
                '#10b981'
            );
        } catch (error) {
            console.error('[TRACKING] ❌ ERROR starting location tracking:', error);
            setIsTracking(false);
            showThemedAlert(
                'Tracking Error',
                `Failed to start tracking: ${error}`,
                [{ text: 'OK' }],
                'alert-circle-outline',
                '#ef4444'
            );
        }
    };

    const stopTracking = async () => {
        setIsTracking(false);

        try {
            // Stop foreground location subscription
            if (locationSubscription) {
                locationSubscription.remove();
                setLocationSubscription(null);
            }

            // Stop background location tracking
            const isBackgroundTaskRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
            if (isBackgroundTaskRunning) {
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                console.log('Background location tracking stopped');
            }

            // Clear the route information from AsyncStorage
            await AsyncStorage.removeItem('currentTrackingRoute');
        } catch (error) {
            console.error('Error stopping location tracking:', error);
        }
    };

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const getLastCoordinates = () => {
        return coordinates.slice(-3).reverse(); // Get last 5 and reverse to show newest first
    };

    const renderCoordinateItem = ({ item, index }: { item: Coordinate; index: number }) => (
        <View style={getStyles(theme).coordinateItem}>
            <Text style={getStyles(theme).coordinateTime}>{formatTimestamp(item.timestamp)}</Text>
            <Text style={getStyles(theme).coordinateText}>
                Lat: {item.latitude.toFixed(6)}
            </Text>
            <Text style={getStyles(theme).coordinateText}>
                Lng: {item.longitude.toFixed(6)}
            </Text>
        </View>
    );



    // Show error state if initialization failed
    if (initializationError) {
        return (
            <SafeAreaView style={getStyles(theme).container}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Ionicons
                        name="warning-outline"
                        size={64}
                        color={theme.error}
                        style={{ marginBottom: 20 }}
                    />
                    <Text style={{ color: theme.error, fontSize: 18, textAlign: 'center' }}>
                        {initializationError}
                    </Text>
                    <TouchableOpacity
                        style={{
                            backgroundColor: theme.primary,
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            borderRadius: 8,
                            marginTop: 20
                        }}
                        onPress={() => {
                            setInitializationError(null);
                            // Try to re-initialize
                            router.replace('/tracking');
                        }}
                    >
                        <Text style={{ color: theme.white, fontSize: 16, fontWeight: '600' }}>
                            Retry
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    console.log('[TrackingPage] Rendering UI...');

    return (
        <SafeAreaView style={getStyles(theme).container}>

            {/* First Section - Route Management and Tracking Controls */}
            <View style={getStyles(theme).section}>

                <View style={getStyles(theme).buttonContainer}>

                    {/* Tracking Button */}
                    <TouchableOpacity
                        style={[
                            getStyles(theme).button,
                            isTracking ? getStyles(theme).stopButton : getStyles(theme).startButton,
                        ]}
                        onPress={isTracking ? stopTracking : startTracking}
                    >
                        <Ionicons
                            name={isTracking ? "stop-circle" : "play-circle"}
                            size={24}
                            color="white"
                        />
                        <Text style={getStyles(theme).buttonText}>
                            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                        </Text>
                    </TouchableOpacity>

                    {/* Route Edit Button */}
                    <TouchableOpacity
                        style={[
                            getStyles(theme).button,
                            getStyles(theme).editButton,
                        ]}
                        onPress={openEditModal}
                    >
                        <Ionicons
                            name="create-outline"
                            size={20}
                            color={theme.secondary}
                        />
                        <Text style={getStyles(theme).editButtonText}>
                            {!currentRoute ? 'Loading...' : 'Edit'}
                        </Text>
                    </TouchableOpacity>

                </View>


                {/* Last 3 Coordinates */}
                <View style={getStyles(theme).coordinatesList}>
                    <Text style={getStyles(theme).accuracyText}>
                        Accuracy: {accuracy?.toFixed(2)} m
                    </Text>
                    {getLastCoordinates().length > 0 ? (
                        <FlatList
                            data={getLastCoordinates()}
                            renderItem={renderCoordinateItem}
                            keyExtractor={(item) => item.timestamp.toString()}
                            scrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                        />
                    ) : (
                        <Text style={getStyles(theme).emptyText}>
                            No coordinates tracked yet. Start tracking to see your location data.
                        </Text>
                    )}
                </View>

            </View>

            {/* Second Section - Map View */}
            <View style={getStyles(theme).section}>
                <Text style={getStyles(theme).sectionTitle}>Route Map</Text>
                <View style={getStyles(theme).mapContainer}>
                    <MapView
                        ref={mapRef}
                        style={getStyles(theme).map}
                        provider={PROVIDER_GOOGLE}
                        customMapStyle={isDark ? darkMapStyle : lightMapStyle}
                        showsUserLocation={true}
                        showsMyLocationButton={true}
                        zoomEnabled={true}
                        scrollEnabled={true}
                        initialRegion={biskupinCoords}
                    >
                        {/* Show markers for start and end if we have coordinates */}
                        {coordinates.length > 0 && (
                            <>
                                <Marker
                                    coordinate={{
                                        latitude: coordinates[0].latitude,
                                        longitude: coordinates[0].longitude,
                                    }}
                                    title="Start"
                                    description="Trip start point"
                                    pinColor="green"
                                />
                                {coordinates.length > 1 && (
                                    <Marker
                                        coordinate={{
                                            latitude: coordinates[coordinates.length - 1].latitude,
                                            longitude: coordinates[coordinates.length - 1].longitude,
                                        }}
                                        title="Current Position"
                                        description="Latest tracked position"
                                        pinColor="red"
                                    />
                                )}
                            </>
                        )}

                        {/* Show polyline for the tracked route */}
                        {coordinates.length > 1 && (
                            <Polyline
                                coordinates={coordinates.map(coord => ({
                                    latitude: coord.latitude,
                                    longitude: coord.longitude,
                                }))}
                                strokeColor={isDark ? '#60a5fa' : '#3b82f6'}
                                strokeWidth={3}
                            />
                        )}
                    </MapView>
                </View>
            </View>

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
                message={`Are you sure you want to delete "${currentRoute?.name}"? This will also delete all coordinates for this route.`}
                isDark={isDark}
                theme={theme}
            />
        </SafeAreaView>
    );
}

const getStyles = (theme: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },

    section: {
        margin: 20,
        marginBottom: 0,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 20,
    },
    subsectionTitle: {
        height: 50,
        backgroundColor: theme.accent,
        fontSize: 18,
        fontWeight: '600',
        color: theme.text,
        marginTop: 20,
        marginBottom: 15,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        gap: 8,
        padding: 10,
    },
    startButton: {
        backgroundColor: theme.success,
    },
    stopButton: {
        backgroundColor: theme.error,
    },
    disabledButton: {
        backgroundColor: theme.textTertiary,
        opacity: 0.6,
    },
    buttonText: {
        color: theme.white,
        fontSize: 18,
        fontWeight: '600',
    },
    // Route management styles
    editButton: {
        backgroundColor: theme.background,
        borderColor: theme.secondary,
        borderWidth: 1,
    },
    editButtonDisabled: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        opacity: 0.6,
    },
    editButtonText: {
        color: theme.secondary,
        fontSize: 14,
        fontWeight: '500',
    },
    editButtonTextDisabled: {
        color: theme.textTertiary,
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
    routeInfoContainer: {
        marginBottom: 15,
    },
    routeDisplayContainer: {
        backgroundColor: theme.surface,
        padding: 15,
        borderRadius: 8,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    routeNameDisplay: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.text,
        textAlign: 'center',
    },

    clearButtonText: {
        color: theme.error,
        fontSize: 16,
        fontWeight: '500',
    },
    coordinatesList: {
        height: 120,
        maxHeight: 120,
        minHeight: 120,
        marginTop: 10,
    },
    coordinateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.surface,
        padding: 5,
        marginBottom: 5,
        borderRadius: 8,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        gap: 20,
    },

    coordinateTime: {
        fontSize: 16,
        color: theme.error,
        fontWeight: 'bold',
    },
    coordinateText: {
        fontSize: 16,
        color: theme.text,
        marginBottom: 2,
    },
    accuracyText: {
        fontSize: 12,
        color: theme.textTertiary,
        fontStyle: 'italic',
    },
    emptyText: {
        height: '100%',
        fontSize: 16,
        color: theme.textSecondary,
        textAlign: 'center',
        padding: 20,
        backgroundColor: theme.surface,
        borderRadius: 8,
    },
    mapContainer: {
        height: "65%",
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: theme.surface,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        // marginBottom: 80,
    },
    map: {
        flex: 1,
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
    destructiveButton: {
        backgroundColor: theme.error,
    },
    destructiveButtonText: {
        color: theme.white,
        fontSize: 16,
        fontWeight: '600',
    },
});
