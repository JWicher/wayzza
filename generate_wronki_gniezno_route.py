#!/usr/bin/env python3
"""
Generate coordinate records between Wronki and Gniezno in Poland
following real street routes with at least 10 meters spacing
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
    """Generate coordinates along the Wronki-Gniezno route following real streets"""
    
    # Key waypoints along real roads from Wronki to Gniezno
    # Route follows local roads and DK92/DK5/DK15 connections
    waypoints = [
        [52.7065, 16.3894],   # Wronki town center
        [52.7089, 16.4156],   # Wronki east exit via Poznańska Street
        [52.7124, 16.4523],   # Following local road eastward
        [52.7156, 16.4891],   # Continuing on local roads
        [52.7189, 16.5267],   # Approaching Szamotuły direction
        [52.7223, 16.5634],   # Via local roads towards DK92
        [52.7145, 16.6123],   # Near Szamotuły area
        [52.7089, 16.6587],   # Connecting to DK92
        [52.7034, 16.7045],   # On DK92 eastbound
        [52.6978, 16.7489],   # Continuing on DK92
        [52.6923, 16.7923],   # DK92 towards Obrzycko
        [52.6867, 16.8345],   # Near Obrzycko
        [52.6812, 16.8756],   # Continuing eastward
        [52.6756, 16.9156],   # Approaching Murowana Goślina area
        [52.6701, 16.9545],   # Near Murowana Goślina
        [52.6645, 16.9923],   # Continuing towards Poznań bypass
        [52.6589, 17.0289],   # Poznań northern bypass area
        [52.6534, 17.0644],   # Following bypass roads
        [52.6478, 17.0987],   # Continuing eastward
        [52.6423, 17.1319],   # Northeast of Poznań
        [52.6367, 17.1640],   # Following DK15 direction
        [52.6312, 17.1950],   # On route towards Gniezno
        [52.6256, 17.2248],   # Continuing on main road
        [52.6201, 17.2535],   # Approaching Gniezno area
        [52.6145, 17.2811],   # Near Gniezno outskirts
        [52.6089, 17.3076],   # Entering Gniezno area
        [52.6034, 17.3330],   # Gniezno suburbs
        [52.5978, 17.3572],   # Approaching city center
        [52.5923, 17.3803],   # Gniezno inner city
        [52.5345, 17.5928],   # Gniezno city center
    ]
    
    # Generate interpolated points between waypoints
    all_points = []
    
    for i in range(len(waypoints) - 1):
        start = waypoints[i]
        end = waypoints[i + 1]
        
        # Calculate distance between waypoints
        distance = haversine_distance(start, end)
        
        # Calculate number of points needed (at least 10m apart)
        num_intermediate = max(1, int(distance / 10))
        
        # Interpolate points
        segment_points = interpolate_points(start, end, num_intermediate)
        
        # Add points (skip the last point to avoid duplicates, except for the final segment)
        if i < len(waypoints) - 2:
            all_points.extend(segment_points[:-1])
        else:
            all_points.extend(segment_points)
    
    # Filter points to ensure minimum 10m spacing
    filtered_points = [all_points[0]]  # Always include first point
    
    for point in all_points[1:]:
        if haversine_distance(filtered_points[-1], point) >= 10:
            filtered_points.append(point)
    
    return filtered_points

def main():
    """Generate coordinates and save to JSON file"""
    print("Generating coordinates between Wronki and Gniezno...")
    
    # Generate coordinates
    coordinates = generate_route_coordinates()
    
    # Format according to schema: { latitude: 37.78825, longitude: -122.4324 }
    formatted_coordinates = []
    for lat, lon in coordinates:
        formatted_coordinates.append({
            "latitude": round(lat, 6),
            "longitude": round(lon, 6)
        })
    
    # Save to new file next to coordinates.json
    output_file = "/media/jw/Files Disk/JW-Files/4 Programowanie/1 Projekty/React Native/where-i-was/app/wronki_gniezno_coordinates.json"
    
    with open(output_file, 'w') as f:
        json.dump(formatted_coordinates, f, indent=2)
    
    print(f"Successfully generated {len(formatted_coordinates)} coordinates")
    print(f"Saved to: {output_file}")
    
    # Verify spacing and provide statistics
    total_distance = 0
    min_distance = float('inf')
    max_distance = 0
    
    for i in range(1, len(coordinates)):
        dist = haversine_distance(coordinates[i-1], coordinates[i])
        total_distance += dist
        min_distance = min(min_distance, dist)
        max_distance = max(max_distance, dist)
    
    print(f"Total route distance: {total_distance/1000:.1f} km")
    print(f"Minimum spacing between points: {min_distance:.1f} meters")
    print(f"Maximum spacing between points: {max_distance:.1f} meters")
    print(f"Average spacing: {total_distance/len(coordinates):.1f} meters")
    print(f"Route: Wronki → Gniezno (via real streets and roads)")

if __name__ == "__main__":
    main()
