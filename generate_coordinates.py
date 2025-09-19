#!/usr/bin/env python3
"""
Generate 1000 coordinate records between Berlin and Munich
following the A9 highway route with at least 50 meters spacing
"""

import json
import math

def haversine_distance(coord1, coord2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    Returns distance in meters
    """
    R = 6371000  # Radius of earth in meters
    
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def interpolate_points(start, end, num_points):
    """Interpolate points between start and end coordinates"""
    points = []
    for i in range(num_points + 1):
        ratio = i / num_points
        lat = start[0] + (end[0] - start[0]) * ratio
        lon = start[1] + (end[1] - start[1]) * ratio
        points.append([lat, lon])
    return points

def generate_route_coordinates():
    """Generate coordinates along the Berlin-Munich A9 highway route"""
    
    # Key waypoints along the A9 highway route from Berlin to Munich
    waypoints = [
        [52.5200, 13.4050],   # Berlin center
        [52.4500, 13.3500],   # Berlin southwest
        [52.3000, 13.1000],   # Leaving Berlin area
        [52.1000, 12.8000],   # Approaching Dessau
        [51.8397, 12.2431],   # Dessau
        [51.4800, 11.9700],   # Halle area
        [51.2000, 11.6000],   # Between Halle and Weimar
        [50.9849, 11.3239],   # Weimar area
        [50.7000, 11.0000],   # Approaching Jena
        [50.4000, 10.7000],   # Between Jena and Bayreuth
        [49.9000, 10.5000],   # Approaching Bayreuth
        [49.9479, 11.5683],   # Bayreuth
        [49.7000, 11.4000],   # South of Bayreuth
        [49.4500, 11.0780],   # Nuremberg area
        [49.4521, 11.0767],   # Nuremberg center
        [49.2000, 10.9000],   # South of Nuremberg
        [48.8000, 10.8000],   # Approaching Ingolstadt
        [48.7665, 11.4257],   # Ingolstadt
        [48.5000, 11.5000],   # Between Ingolstadt and Munich
        [48.3000, 11.6000],   # Approaching Munich
        [48.1351, 11.5820],   # Munich center
    ]
    
    # Generate interpolated points between waypoints
    all_points = []
    
    for i in range(len(waypoints) - 1):
        start = waypoints[i]
        end = waypoints[i + 1]
        
        # Calculate distance between waypoints
        distance = haversine_distance(start, end)
        
        # Calculate number of points needed (at least 50m apart)
        num_intermediate = max(1, int(distance / 50))
        
        # Interpolate points
        segment_points = interpolate_points(start, end, num_intermediate)
        
        # Add points (skip the last point to avoid duplicates, except for the final segment)
        if i < len(waypoints) - 2:
            all_points.extend(segment_points[:-1])
        else:
            all_points.extend(segment_points)
    
    # Filter points to ensure minimum 50m spacing
    filtered_points = [all_points[0]]  # Always include first point
    
    for point in all_points[1:]:
        if haversine_distance(filtered_points[-1], point) >= 50:
            filtered_points.append(point)
    
    # If we don't have enough points, add more by reducing spacing slightly
    while len(filtered_points) < 1000:
        # Add points with 40m spacing if needed
        new_points = []
        for i in range(len(filtered_points) - 1):
            new_points.append(filtered_points[i])
            
            # Add midpoint if distance > 80m
            if haversine_distance(filtered_points[i], filtered_points[i+1]) > 80:
                midpoint = [
                    (filtered_points[i][0] + filtered_points[i+1][0]) / 2,
                    (filtered_points[i][1] + filtered_points[i+1][1]) / 2
                ]
                new_points.append(midpoint)
        
        new_points.append(filtered_points[-1])  # Add last point
        filtered_points = new_points
        
        if len(filtered_points) >= 1000:
            break
    
    # Take exactly 1000 points
    return filtered_points[:1000]

def main():
    """Generate coordinates and save to JSON file"""
    print("Generating 1000 coordinates between Berlin and Munich...")
    
    # Generate coordinates
    coordinates = generate_route_coordinates()
    
    # Format according to schema: { latitude: 37.78825, longitude: -122.4324 }
    formatted_coordinates = []
    for lat, lon in coordinates:
        formatted_coordinates.append({
            "latitude": round(lat, 6),
            "longitude": round(lon, 6)
        })
    
    # Save to coordinates.json
    output_file = "/media/jw/Files Disk/JW-Files/4 Programowanie/1 Projekty/React Native/where-i-was/app/coordinates.json"
    
    with open(output_file, 'w') as f:
        json.dump(formatted_coordinates, f, indent=2)
    
    print(f"Successfully generated {len(formatted_coordinates)} coordinates")
    print(f"Saved to: {output_file}")
    
    # Verify spacing
    total_distance = 0
    min_distance = float('inf')
    for i in range(1, len(coordinates)):
        dist = haversine_distance(coordinates[i-1], coordinates[i])
        total_distance += dist
        min_distance = min(min_distance, dist)
    
    print(f"Total route distance: {total_distance/1000:.1f} km")
    print(f"Minimum spacing between points: {min_distance:.1f} meters")
    print(f"Average spacing: {total_distance/len(coordinates):.1f} meters")

if __name__ == "__main__":
    main()
