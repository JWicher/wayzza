import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { darkMapStyle, lightMapStyle } from '../constants/mapStyles';
import { useTheme } from '../contexts/ThemeContext';
import {
    addCoordinateRecord,
    createRoute,
    deleteRoute,
    getCoordinatesForRoute,
    getTrackingSettings,
    RouteRecord
} from '../lib/database';

interface Coordinate {
    latitude: number;
    longitude: number;
    timestamp: number;
}

// Default tracking intervals (will be overridden by settings)
const DEFAULT_TRACKING_INTERVAL_SECONDS = 5;
const DEFAULT_TRACKING_INTERVAL_M = 10;

const biskupinCoords = {
    latitude: 52.793000, // Default to Warsaw, Poland
    longitude: 17.734000,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
}

export default function TrackingPage() {
    const { theme, isDark } = useTheme();
    const [isTracking, setIsTracking] = useState(false);
    const [accuracy, setAccuracy] = useState<number>();

    const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
    const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
    const mapRef = useRef<MapView>(null);

    // Current route state
    const [currentRoute, setCurrentRoute] = useState<RouteRecord | null>(null);

    // Auto-created route management
    const [autoCreatedRoute, setAutoCreatedRoute] = useState<RouteRecord | null>(null);
    const [hasEverStartedTracking, setHasEverStartedTracking] = useState(false);

    // Dynamic tracking intervals loaded from settings
    const [trackingIntervalSeconds, setTrackingIntervalSeconds] = useState(DEFAULT_TRACKING_INTERVAL_SECONDS);
    const [trackingIntervalM, setTrackingIntervalM] = useState(DEFAULT_TRACKING_INTERVAL_M);


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
                await loadTrackingSettings();
                await createAutoRoute();
                await requestLocationPermissions();
            } catch (error) {
                console.error('Error initializing tracking page:', error);
                Alert.alert('Initialization Error', 'Failed to initialize tracking.');
            }
        };

        initializeTrackingPage();

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
            // Cleanup auto-created route if tracking was never started
            cleanupAutoCreatedRoute();
        };
    }, []);

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

    const requestLocationPermissions = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Permission Required',
                'Please grant location permissions to track your trip.',
                [{ text: 'OK' }]
            );
        }
    };


    const loadCoordinatesForRoute = async (routeId: number) => {
        try {
            const dbCoordinates = await getCoordinatesForRoute(routeId);
            const formattedCoordinates = dbCoordinates.map(coord => ({
                latitude: coord.latitude,
                longitude: coord.longitude,
                timestamp: coord.timestamp
            }));
            setCoordinates(formattedCoordinates);
        } catch (error) {
            console.error('Error loading coordinates for route:', error);
        }
    };

    const createAutoRoute = async () => {
        try {
            // Generate a unique name with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const date = timestamp.split('T')[0];
            const time = timestamp.split('T')[1].substring(0, 8).replace(/-/g, ':');

            const autoRouteName = `${date} ${time}`;

            const route = await createRoute(autoRouteName);
            setAutoCreatedRoute(route);
            setCurrentRoute(route);
            setCoordinates([]); // Clear coordinates for new route

            console.log('Auto-created route:', route);
        } catch (error) {
            console.error('Error creating auto route:', error);
            // Don't show alert for auto-creation failure, just log it
        }
    };

    const cleanupAutoCreatedRoute = async () => {
        // Only delete the auto-created route if tracking was never started
        if (autoCreatedRoute && !hasEverStartedTracking) {
            try {
                await deleteRoute(autoCreatedRoute.id!);
                console.log('Deleted unused auto-created route:', autoCreatedRoute.name);
                setAutoCreatedRoute(null);
            } catch (error) {
                console.error('Error deleting auto-created route:', error);
            }
        }
    };

    const navigateToEditRoute = () => {
        if (!currentRoute) return;
        router.push(`/edit-route?routeId=${currentRoute.id}`);
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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied', 'Location permission is required to track your trip.');
            return;
        }

        if (!currentRoute) {
            Alert.alert('No Route Selected', 'Please select or create a route before tracking.');
            return;
        }

        setIsTracking(true);
        setHasEverStartedTracking(true);

        // Start location subscription - gather coordinates using dynamic intervals from settings
        const subscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: trackingIntervalSeconds * 1000, // Convert seconds to milliseconds for Location API
                distanceInterval: trackingIntervalM, // Use dynamic distance interval from settings
            },
            async (location) => {
                const newCoordinate: Coordinate = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    timestamp: Date.now(),
                };
                console.log('New coordinate gathered:', newCoordinate);

                try {
                    // Save to database
                    await addCoordinateRecord(
                        currentRoute.id!,
                        newCoordinate.latitude,
                        newCoordinate.longitude,
                        newCoordinate.timestamp
                    );

                    // Update state array for UI
                    setCoordinates(prev => [...prev, newCoordinate]);
                    setAccuracy(location.coords.accuracy || 0);
                } catch (error) {
                    console.error('Error saving coordinate to database:', error);
                }
            }
        );

        setLocationSubscription(subscription);
    };

    const stopTracking = () => {
        setIsTracking(false);
        if (locationSubscription) {
            locationSubscription.remove();
            setLocationSubscription(null);
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
                        disabled={!currentRoute}
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
                            isTracking && getStyles(theme).editButtonDisabled,
                        ]}
                        onPress={navigateToEditRoute}
                        disabled={isTracking}
                    >
                        <Ionicons
                            name="create-outline"
                            size={20}
                            color={isTracking ? theme.textTertiary : theme.secondary}
                        />
                        <Text style={[
                            getStyles(theme).editButtonText,
                            isTracking && getStyles(theme).editButtonTextDisabled
                        ]}>
                            Edit
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
        height: 110,
        maxHeight: 115,
        minHeight: 115,
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
});
