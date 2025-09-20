# Coordinate Database Module

This module provides SQLite database operations for storing and managing coordinate data in your React Native app.

## Features

- Store coordinates with route names, latitude, longitude, and timestamps
- Retrieve all coordinates for a specific route
- Remove all coordinates for a specific route
- Additional utility functions for route management
- TypeScript support with proper type definitions
- Error handling and logging

## Installation

The required dependency `expo-sqlite` has been installed:

```bash
npm install expo-sqlite
```

## Database Schema

The module creates a `coordinates` table with the following structure:

| Column    | Type    | Description                           |
|-----------|---------|---------------------------------------|
| id        | INTEGER | Primary key (auto-increment)         |
| route     | TEXT    | Route name/identifier                 |
| latitude  | REAL    | Latitude coordinate                   |
| longitude | REAL    | Longitude coordinate                  |
| timestamp | INTEGER | Unix timestamp                        |
| created_at| DATETIME| Record creation time (auto-generated) |

## Core Functions

### Required Functions (as requested)

#### `addCoordinateRecord(route, latitude, longitude, timestamp?)`
Adds a new coordinate record for a given route.

```typescript
import { addCoordinateRecord } from './lib/database';

// Add coordinate with current timestamp
const id = await addCoordinateRecord('morning_walk', 52.4064, 16.9252);

// Add coordinate with specific timestamp
const id = await addCoordinateRecord('morning_walk', 52.4064, 16.9252, Date.now());
```

#### `getCoordinatesForRoute(route)`
Retrieves all coordinates for a given route, ordered by timestamp.

```typescript
import { getCoordinatesForRoute } from './lib/database';

const coordinates = await getCoordinatesForRoute('morning_walk');
// Returns: CoordinateRecord[]
```

#### `removeCoordinatesForRoute(route)`
Removes all coordinates for a given route.

```typescript
import { removeCoordinatesForRoute } from './lib/database';

const deletedCount = await removeCoordinatesForRoute('morning_walk');
console.log(`Deleted ${deletedCount} records`);
```

### Additional Utility Functions

#### `initializeDatabase()`
Initializes the database and creates tables. Call this once when your app starts.

```typescript
import { initializeDatabase } from './lib/database';

// In your app's main component or App.tsx
useEffect(() => {
  initializeDatabase();
}, []);
```

#### `getRoutes()`
Returns all routes with full details.

```typescript
const routes = await getRoutes();
// Returns: RouteRecord[]
// To get just route names: routes.map(route => route.name)
```

#### `getCoordinateCountForRoute(route)`
Returns the number of coordinates for a specific route.

```typescript
const count = await getCoordinateCountForRoute('morning_walk');
```

#### `clearAllCoordinates()`
Removes all coordinate data (use with caution).

```typescript
const deletedCount = await clearAllCoordinates();
```

#### `closeDatabase()`
Closes the database connection.

```typescript
await closeDatabase();
```

## TypeScript Types

```typescript
interface CoordinateRecord {
  id?: number;
  route: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}
```

## Integration Example

### 1. Initialize in App.tsx

```typescript
import { useEffect } from 'react';
import { initializeDatabase } from './lib/database';

export default function App() {
  useEffect(() => {
    const initDB = async () => {
      try {
        await initializeDatabase();
        console.log('Database ready');
      } catch (error) {
        console.error('Database initialization failed:', error);
      }
    };
    
    initDB();
  }, []);

  // ... rest of your app
}
```

### 2. Use in Location Tracking

```typescript
import * as Location from 'expo-location';
import { addCoordinateRecord } from './lib/database';

const trackLocation = async (routeName: string) => {
  const location = await Location.getCurrentPositionAsync({});
  
  await addCoordinateRecord(
    routeName,
    location.coords.latitude,
    location.coords.longitude,
    Date.now()
  );
};
```

### 3. Use with React Hook

```typescript
import { useRouteCoordinates } from './lib/database-example';

function RouteComponent({ routeName }: { routeName: string }) {
  const {
    coordinates,
    loading,
    error,
    addCoordinate,
    clearRoute
  } = useRouteCoordinates(routeName);

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      <Text>Route: {routeName}</Text>
      <Text>Coordinates: {coordinates.length}</Text>
      {/* Render your coordinates */}
    </View>
  );
}
```

### 4. Integration with React Native Maps

```typescript
import MapView, { Polyline } from 'react-native-maps';
import { getCoordinatesForRoute } from './lib/database';

const MapComponent = () => {
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  useEffect(() => {
    const loadRoute = async () => {
      const coords = await getCoordinatesForRoute('my_route');
      const mapCoords = coords.map(coord => ({
        latitude: coord.latitude,
        longitude: coord.longitude
      }));
      setRouteCoordinates(mapCoords);
    };
    
    loadRoute();
  }, []);

  return (
    <MapView>
      <Polyline
        coordinates={routeCoordinates}
        strokeColor="#FF0000"
        strokeWidth={3}
      />
    </MapView>
  );
};
```

## Error Handling

All functions include proper error handling and will throw errors that you should catch:

```typescript
try {
  const coordinates = await getCoordinatesForRoute('my_route');
  // Handle success
} catch (error) {
  console.error('Failed to get coordinates:', error);
  // Handle error
}
```

## Performance Notes

- The module creates an index on the `route` column for faster queries
- Coordinates are ordered by timestamp when retrieved
- Database connection is reused across function calls
- Use `closeDatabase()` when your app is shutting down (optional)

## Migration from JSON Files

If you're currently using JSON files for coordinate storage (like `coordinates.json`), you can migrate the data:

```typescript
import coordinatesData from './coordinates.json';
import { addCoordinateRecord } from './lib/database';

const migrateFromJSON = async () => {
  for (const coord of coordinatesData) {
    await addCoordinateRecord(
      coord.route || 'default',
      coord.latitude,
      coord.longitude,
      coord.timestamp || Date.now()
    );
  }
};
```

This database module provides a robust, scalable solution for coordinate storage with better performance than JSON files and the ability to query and filter data efficiently.
