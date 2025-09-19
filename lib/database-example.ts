/**
 * Example usage of the database module
 * This file demonstrates how to use the coordinate database functions
 */

import {
    addCoordinateRecord,
    CoordinateRecord,
    getAllRoutes,
    getCoordinateCountForRoute,
    getCoordinatesForRoute,
    initializeDatabase,
    removeCoordinatesForRoute
} from './database';

/**
 * Example function showing how to use the database module
 */
export const databaseUsageExample = async () => {
    try {
        // Initialize the database (call this once when your app starts)
        await initializeDatabase();
        console.log('Database initialized');

        // Example route name
        const routeName = 'morning_walk';

        // Add some coordinate records
        await addCoordinateRecord(routeName, 52.4064, 16.9252, Date.now()); // Poznań
        await addCoordinateRecord(routeName, 52.4074, 16.9262, Date.now() + 60000); // 1 minute later
        await addCoordinateRecord(routeName, 52.4084, 16.9272, Date.now() + 120000); // 2 minutes later

        // Add coordinates for another route
        const anotherRoute = 'evening_jog';
        await addCoordinateRecord(anotherRoute, 52.5200, 13.4050, Date.now()); // Berlin
        await addCoordinateRecord(anotherRoute, 52.5210, 13.4060, Date.now() + 30000);

        // Get all coordinates for a specific route
        const morningWalkCoordinates = await getCoordinatesForRoute(routeName);
        console.log('Morning walk coordinates:', morningWalkCoordinates);

        // Get coordinate count for a route
        const count = await getCoordinateCountForRoute(routeName);
        console.log(`Route "${routeName}" has ${count} coordinates`);

        // Get all unique routes
        const allRoutes = await getAllRoutes();
        console.log('All routes:', allRoutes);

        // Remove all coordinates for a specific route
        const deletedCount = await removeCoordinatesForRoute(anotherRoute);
        console.log(`Deleted ${deletedCount} coordinates for route "${anotherRoute}"`);

    } catch (error) {
        console.error('Database usage example error:', error);
    }
};

/**
 * Example of how to use the database in a React component
 */
export const useCoordinateDatabase = () => {
    const saveLocation = async (route: string, latitude: number, longitude: number) => {
        try {
            const id = await addCoordinateRecord(route, latitude, longitude);
            console.log(`Saved location with ID: ${id}`);
            return id;
        } catch (error) {
            console.error('Failed to save location:', error);
            throw error;
        }
    };

    const loadRoute = async (route: string): Promise<CoordinateRecord[]> => {
        try {
            const coordinates = await getCoordinatesForRoute(route);
            return coordinates;
        } catch (error) {
            console.error('Failed to load route:', error);
            throw error;
        }
    };

    const deleteRoute = async (route: string): Promise<boolean> => {
        try {
            const deletedCount = await removeCoordinatesForRoute(route);
            return deletedCount > 0;
        } catch (error) {
            console.error('Failed to delete route:', error);
            throw error;
        }
    };

    return {
        saveLocation,
        loadRoute,
        deleteRoute
    };
};

/**
 * Example React Hook for managing coordinate data
 */
import { useEffect, useState } from 'react';

export const useRouteCoordinates = (routeName: string) => {
    const [coordinates, setCoordinates] = useState<CoordinateRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCoordinates = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getCoordinatesForRoute(routeName);
            setCoordinates(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load coordinates');
        } finally {
            setLoading(false);
        }
    };

    const addCoordinate = async (latitude: number, longitude: number, timestamp?: number) => {
        try {
            await addCoordinateRecord(routeName, latitude, longitude, timestamp);
            await loadCoordinates(); // Refresh the data
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add coordinate');
        }
    };

    const clearRoute = async () => {
        try {
            await removeCoordinatesForRoute(routeName);
            setCoordinates([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to clear route');
        }
    };

    useEffect(() => {
        if (routeName) {
            loadCoordinates();
        }
    }, [routeName]);

    return {
        coordinates,
        loading,
        error,
        addCoordinate,
        clearRoute,
        refreshCoordinates: loadCoordinates
    };
};
