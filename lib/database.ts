import * as SQLite from 'expo-sqlite';

// Database and table configuration
const DATABASE_NAME = 'coordinates.db';
const COORDINATES_TABLE = 'coordinates';
const ROUTES_TABLE = 'routes';
const SETTINGS_TABLE = 'settings';

// Type definitions
export interface RouteRecord {
    id?: number;
    name: string;
}

export interface CoordinateRecord {
    id?: number;
    routeId: number;
    latitude: number;
    longitude: number;
    timestamp: number;
}

export interface SettingsRecord {
    id?: number;
    key: string;
    value: string;
}

// Database instance
let db: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;
let isDatabaseReady = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the database and create the coordinates table if it doesn't exist
 */
export const initializeDatabase = async (): Promise<void> => {
    // Prevent concurrent initialization
    if (isDatabaseReady && db) {
        console.log('Database already initialized');
        return;
    }

    if (isInitializing && initializationPromise) {
        console.log('Database initialization in progress, waiting...');
        return initializationPromise;
    }

    isInitializing = true;

    initializationPromise = (async () => {
        try {
            console.log('Initializing database...');

            if (!db) {
                db = await SQLite.openDatabaseAsync(DATABASE_NAME);
                console.log('Database connection opened');
            }

            // Create the routes table if it doesn't exist
            await db.execAsync(`
          CREATE TABLE IF NOT EXISTS ${ROUTES_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

            // Create the coordinates table if it doesn't exist
            await db.execAsync(`
          CREATE TABLE IF NOT EXISTS ${COORDINATES_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id INTEGER NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timestamp INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (route_id) REFERENCES ${ROUTES_TABLE}(id) ON DELETE CASCADE
          );
        `);

            // Create the settings table if it doesn't exist
            await db.execAsync(`
          CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

            // Create indexes for better query performance
            await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_route_id ON ${COORDINATES_TABLE}(route_id);
        `);
            await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_route_name ON ${ROUTES_TABLE}(name);
        `);
            await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_setting_key ON ${SETTINGS_TABLE}(key);
        `);

            // Initialize default settings if they don't exist
            await initializeDefaultSettings(db);

            console.log('Database initialized successfully');
            isDatabaseReady = true;
        } catch (error) {
            console.error('Error initializing database:', error);
            db = null; // Reset db on error
            isDatabaseReady = false;
            throw error;
        } finally {
            isInitializing = false;
            initializationPromise = null;
        }
    })();

    return initializationPromise;
};

/**
 * Get the database instance (initialize if needed)
 */
const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    // If initialization is in progress, wait for it regardless of db state
    if (isInitializing && initializationPromise) {
        console.log('Database initialization in progress, waiting for completion...');
        await initializationPromise;
    }

    // If no database exists or not ready, initialize it
    if (!db || !isDatabaseReady) {
        await initializeDatabase();
    }

    if (!db || !isDatabaseReady) {
        throw new Error('Failed to initialize database');
    }

    return db;
};

/**
 * Create a new route
 * @param name - The route name
 * @returns Promise that resolves to the created route record
 */
export const createRoute = async (name: string): Promise<RouteRecord> => {
    try {
        const database = await getDatabase();

        const result = await database.runAsync(
            `INSERT INTO ${ROUTES_TABLE} (name) VALUES (?)`,
            [name]
        );

        const route: RouteRecord = {
            id: result.lastInsertRowId,
            name: name
        };

        console.log(`Created route "${name}" with ID ${route.id}`);
        return route;
    } catch (error) {
        console.error('Error creating route:', error);
        throw error;
    }
};

/**
 * Get all routes from the database
 * @returns Promise that resolves to an array of route records
 */
export const getRoutes = async (): Promise<RouteRecord[]> => {
    try {
        const database = await getDatabase();

        const result = await database.getAllAsync(
            `SELECT * FROM ${ROUTES_TABLE} ORDER BY name ASC`
        );

        console.log(`Retrieved ${result.length} routes`);
        return result as RouteRecord[];
    } catch (error) {
        console.error('Error getting routes:', error);
        throw error;
    }
};

/**
 * Get a route by ID
 * @param id - The route ID
 * @returns Promise that resolves to the route record or null if not found
 */
export const getRouteById = async (id: number): Promise<RouteRecord | null> => {
    try {
        const database = await getDatabase();

        const result = await database.getFirstAsync(
            `SELECT * FROM ${ROUTES_TABLE} WHERE id = ?`,
            [id]
        );

        return result ? result as RouteRecord : null;
    } catch (error) {
        console.error('Error getting route by ID:', error);
        throw error;
    }
};

/**
 * Get a route by name
 * @param name - The route name
 * @returns Promise that resolves to the route record or null if not found
 */
export const getRouteByName = async (name: string): Promise<RouteRecord | null> => {
    try {
        const database = await getDatabase();

        const result = await database.getFirstAsync(
            `SELECT * FROM ${ROUTES_TABLE} WHERE name = ?`,
            [name]
        );

        return result ? result as RouteRecord : null;
    } catch (error) {
        console.error('Error getting route by name:', error);
        throw error;
    }
};

/**
 * Update a route name
 * @param id - The route ID
 * @param name - The new route name
 * @returns Promise that resolves to the updated route record
 */
export const updateRoute = async (id: number, name: string): Promise<RouteRecord> => {
    try {
        const database = await getDatabase();

        const result = await database.runAsync(
            `UPDATE ${ROUTES_TABLE} SET name = ? WHERE id = ?`,
            [name, id]
        );

        if (result.changes === 0) {
            throw new Error('Route not found or no changes made');
        }

        const updatedRoute: RouteRecord = {
            id: id,
            name: name
        };

        console.log(`Updated route with ID ${id} to name "${name}"`);
        return updatedRoute;
    } catch (error) {
        console.error('Error updating route:', error);
        throw error;
    }
};

/**
 * Delete a route and all its coordinates
 * @param id - The route ID
 * @returns Promise that resolves to the number of deleted route records (should be 1 or 0)
 */
export const deleteRoute = async (id: number): Promise<number> => {
    try {
        const database = await getDatabase();

        const result = await database.runAsync(
            `DELETE FROM ${ROUTES_TABLE} WHERE id = ?`,
            [id]
        );

        console.log(`Deleted route with ID ${id}`);
        return result.changes;
    } catch (error) {
        console.error('Error deleting route:', error);
        throw error;
    }
};

/**
 * Add a new coordinate record for a given route
 * @param routeId - The route ID
 * @param latitude - The latitude coordinate
 * @param longitude - The longitude coordinate
 * @param timestamp - The timestamp (optional, defaults to current time)
 * @returns Promise that resolves to the inserted record ID
 */
export const addCoordinateRecord = async (
    routeId: number,
    latitude: number,
    longitude: number,
    timestamp?: number
): Promise<number> => {
    try {
        const database = await getDatabase();
        const actualTimestamp = timestamp || Date.now();

        const result = await database.runAsync(
            `INSERT INTO ${COORDINATES_TABLE} (route_id, latitude, longitude, timestamp) VALUES (?, ?, ?, ?)`,
            [routeId, latitude, longitude, actualTimestamp]
        );

        console.log(`Added coordinate record for route ID ${routeId}`);
        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error adding coordinate record:', error);
        throw error;
    }
};

/**
 * Get all coordinates for a given route
 * @param routeId - The route ID
 * @returns Promise that resolves to an array of coordinate records
 */
export const getCoordinatesForRoute = async (routeId: number): Promise<CoordinateRecord[]> => {
    try {
        const database = await getDatabase();

        const result = await database.getAllAsync(
            `SELECT * FROM ${COORDINATES_TABLE} WHERE route_id = ? ORDER BY timestamp ASC`,
            [routeId]
        );

        console.log(`Retrieved ${result.length} coordinates for route ID ${routeId}`);
        return result as CoordinateRecord[];
    } catch (error) {
        console.error('Error getting coordinates for route:', error);
        throw error;
    }
};

/**
 * Remove all coordinates for a given route
 * @param routeId - The route ID
 * @returns Promise that resolves to the number of deleted records
 */
export const removeCoordinatesForRoute = async (routeId: number): Promise<number> => {
    try {
        const database = await getDatabase();

        const result = await database.runAsync(
            `DELETE FROM ${COORDINATES_TABLE} WHERE route_id = ?`,
            [routeId]
        );

        console.log(`Removed ${result.changes} coordinates for route ID ${routeId}`);
        return result.changes;
    } catch (error) {
        console.error('Error removing coordinates for route:', error);
        throw error;
    }
};


/**
 * Get the total count of coordinates for a given route
 * @param routeId - The route ID
 * @returns Promise that resolves to the count of coordinates
 */
export const getCoordinateCountForRoute = async (routeId: number): Promise<number> => {
    try {
        const database = await getDatabase();

        const result = await database.getFirstAsync(
            `SELECT COUNT(*) as count FROM ${COORDINATES_TABLE} WHERE route_id = ?`,
            [routeId]
        );

        const count = (result as any)?.count || 0;
        console.log(`Route ID ${routeId} has ${count} coordinates`);
        return count;
    } catch (error) {
        console.error('Error getting coordinate count for route:', error);
        throw error;
    }
};

/**
 * Clear all data from the coordinates table (use with caution!)
 * @returns Promise that resolves to the number of deleted records
 */
export const clearAllCoordinates = async (): Promise<number> => {
    try {
        const database = await getDatabase();

        const result = await database.runAsync(`DELETE FROM ${COORDINATES_TABLE}`);

        console.log(`Cleared all coordinates: ${result.changes} records deleted`);
        return result.changes;
    } catch (error) {
        console.error('Error clearing all coordinates:', error);
        throw error;
    }
};

/**
 * Clear all data from both routes and coordinates tables (use with caution!)
 * @returns Promise that resolves to an object with deleted counts
 */
export const clearAllData = async (): Promise<{ coordinatesDeleted: number, routesDeleted: number }> => {
    try {
        const database = await getDatabase();

        // Delete coordinates first due to foreign key constraint
        const coordinatesResult = await database.runAsync(`DELETE FROM ${COORDINATES_TABLE}`);
        const routesResult = await database.runAsync(`DELETE FROM ${ROUTES_TABLE}`);

        const result = {
            coordinatesDeleted: coordinatesResult.changes,
            routesDeleted: routesResult.changes
        };

        console.log(`Cleared all data: ${result.coordinatesDeleted} coordinates and ${result.routesDeleted} routes deleted`);
        return result;
    } catch (error) {
        console.error('Error clearing all data:', error);
        throw error;
    }
};

/**
 * Initialize default settings
 */
const initializeDefaultSettings = async (database: SQLite.SQLiteDatabase): Promise<void> => {
    try {

        // Default tracking interval settings
        const defaultSettings = [
            { key: 'TRACKING_INTERVAL_SECONDS', value: '5' }, // 5 seconds
            { key: 'TRACKING_INTERVAL_M', value: '10' }       // 10 meters
        ];

        for (const setting of defaultSettings) {
            // Check if setting already exists
            const existing = await database.getFirstAsync(
                `SELECT * FROM ${SETTINGS_TABLE} WHERE key = ?`,
                [setting.key]
            );

            if (!existing) {
                await database.runAsync(
                    `INSERT INTO ${SETTINGS_TABLE} (key, value) VALUES (?, ?)`,
                    [setting.key, setting.value]
                );
                console.log(`Initialized default setting: ${setting.key} = ${setting.value}`);
            }
        }
    } catch (error) {
        console.error('Error initializing default settings:', error);
        throw error;
    }
};

/**
 * Get a setting value by key
 * @param key - The setting key
 * @returns Promise that resolves to the setting value or null if not found
 */
export const getSetting = async (key: string): Promise<string | null> => {
    try {
        const database = await getDatabase();

        const result = await database.getFirstAsync(
            `SELECT value FROM ${SETTINGS_TABLE} WHERE key = ?`,
            [key]
        );

        return result ? (result as any).value : null;
    } catch (error) {
        console.error('Error getting setting:', error);
        throw error;
    }
};

/**
 * Set a setting value
 * @param key - The setting key
 * @param value - The setting value
 * @returns Promise that resolves when the setting is saved
 */
export const setSetting = async (key: string, value: string): Promise<void> => {
    try {
        const database = await getDatabase();

        await database.runAsync(
            `INSERT OR REPLACE INTO ${SETTINGS_TABLE} (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [key, value]
        );

        console.log(`Setting updated: ${key} = ${value}`);
    } catch (error) {
        console.error('Error setting value:', error);
        throw error;
    }
};

/**
 * Get tracking interval settings
 * @returns Promise that resolves to an object with tracking intervals (seconds and meters)
 */
export const getTrackingSettings = async (): Promise<{ intervalSeconds: number; intervalM: number }> => {
    try {
        const intervalSeconds = await getSetting('TRACKING_INTERVAL_SECONDS');
        const intervalM = await getSetting('TRACKING_INTERVAL_M');

        return {
            intervalSeconds: intervalSeconds ? parseInt(intervalSeconds, 10) : 5,
            intervalM: intervalM ? parseInt(intervalM, 10) : 10
        };
    } catch (error) {
        console.error('Error getting tracking settings:', error);
        return { intervalSeconds: 5, intervalM: 10 }; // Default values
    }
};

/**
 * Set tracking interval settings
 * @param intervalSeconds - Time interval in seconds
 * @param intervalM - Distance interval in meters
 * @returns Promise that resolves when settings are saved
 */
export const setTrackingSettings = async (intervalSeconds: number, intervalM: number): Promise<void> => {
    try {
        await setSetting('TRACKING_INTERVAL_SECONDS', intervalSeconds.toString());
        await setSetting('TRACKING_INTERVAL_M', intervalM.toString());
        console.log(`Tracking settings updated: ${intervalSeconds}s, ${intervalM}m`);
    } catch (error) {
        console.error('Error setting tracking settings:', error);
        throw error;
    }
};

/**
 * Export route data with specified schema
 * @param routeId - The route ID
 * @returns Promise that resolves to the export data
 */
export const exportRouteData = async (routeId: number): Promise<{
    route: string;
    id: number;
    coordinates: Array<{
        latitude: number;
        longitude: number;
        timestamp: number;
    }>;
}> => {
    try {
        const route = await getRouteById(routeId);
        if (!route) {
            throw new Error(`Route with ID ${routeId} not found`);
        }

        const coordinates = await getCoordinatesForRoute(routeId);

        return {
            route: route.name,
            id: routeId,
            coordinates: coordinates.map(coord => ({
                latitude: coord.latitude,
                longitude: coord.longitude,
                timestamp: coord.timestamp
            }))
        };
    } catch (error) {
        console.error('Error exporting route data:', error);
        throw error;
    }
};

/**
 * Export all routes data
 * @returns Promise that resolves to an array of export data for all routes
 */
export const exportAllRoutesData = async (): Promise<Array<{
    route: string;
    id: number;
    coordinates: Array<{
        latitude: number;
        longitude: number;
        timestamp: number;
    }>;
}>> => {
    try {
        const routes = await getRoutes();

        const exportData = await Promise.all(
            routes.map(async (route) => {
                return await exportRouteData(route.id!);
            })
        );

        return exportData;
    } catch (error) {
        console.error('Error exporting all routes data:', error);
        throw error;
    }
};

/**
 * Close the database connection
 */
export const closeDatabase = async (): Promise<void> => {
    try {
        if (db) {
            await db.closeAsync();
            db = null;
            console.log('Database connection closed');
        }
    } catch (error) {
        console.error('Error closing database:', error);
        throw error;
    }
};

