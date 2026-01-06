import * as Location from "expo-location";
import React, { createContext, useContext, useEffect, useState } from "react";
import { showThemedAlert } from "../components/modals";

interface PermissionContextType {
    foregroundPermissionGranted: boolean;
    backgroundPermissionGranted: boolean;
    isCheckingPermissions: boolean;
    requestPermissions: () => Promise<boolean>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(
    undefined
);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [foregroundPermissionGranted, setForegroundPermissionGranted] =
        useState(false);
    const [backgroundPermissionGranted, setBackgroundPermissionGranted] =
        useState(false);
    const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

    const checkExistingPermissions = async () => {
        try {
            const { status: foregroundStatus } =
                await Location.getForegroundPermissionsAsync();
            const { status: backgroundStatus } =
                await Location.getBackgroundPermissionsAsync();

            setForegroundPermissionGranted(foregroundStatus === "granted");
            setBackgroundPermissionGranted(backgroundStatus === "granted");

            console.log("Existing permissions:", {
                foreground: foregroundStatus,
                background: backgroundStatus,
            });
        } catch (error) {
            console.error("Error checking existing permissions:", error);
        }
    };

    const requestLocationPermissions = async (): Promise<boolean> => {
        setIsCheckingPermissions(true);

        try {
            // Request foreground permissions first
            const { status: foregroundStatus } =
                await Location.requestForegroundPermissionsAsync();
            setForegroundPermissionGranted(foregroundStatus === "granted");

            if (foregroundStatus !== "granted") {
                alert("Permission to access location was denied"); // TODO remove

                showThemedAlert(
                    "Permission Required",
                    "Please grant location permissions to track your trip.",
                    [{ text: "OK" }],
                    "location-outline"
                );
                setIsCheckingPermissions(false);
                return false;
            }

            // Then request background permissions
            const { status: backgroundStatus } =
                await Location.requestBackgroundPermissionsAsync();
            setBackgroundPermissionGranted(backgroundStatus === "granted");

            if (backgroundStatus !== "granted") {
                alert("Background location permission denied"); // TODO remove

                showThemedAlert(
                    "Background Location Required",
                    'To track your location while the app is in background, please grant "Allow all the time" location permission in your device settings.',
                    [{ text: "OK" }],
                    "location-outline",
                    "#f59e0b"
                );
                // Don't return false here - foreground tracking can still work
            }

            console.log("Permission request results:", {
                foreground: foregroundStatus,
                background: backgroundStatus,
            });

            setIsCheckingPermissions(false);
            return foregroundStatus === "granted";
        } catch (error) {
            console.error("Error requesting permissions:", error);
            setIsCheckingPermissions(false);
            return false;
        }
    };

    // Check existing permissions on app startup
    useEffect(() => {
        const initializePermissions = async () => {
            console.log("Initializing permission checks...");
            await checkExistingPermissions();

            // If permissions are not granted, request them
            const { status: foregroundStatus } =
                await Location.getForegroundPermissionsAsync();
            if (foregroundStatus !== "granted") {
                console.log("Permissions not granted, requesting...");
                await requestLocationPermissions();
            } else {
                setIsCheckingPermissions(false);
                console.log("Permissions already granted");
            }
        };

        initializePermissions();
    }, []);

    return (
        <PermissionContext.Provider
            value={{
                foregroundPermissionGranted,
                backgroundPermissionGranted,
                isCheckingPermissions,
                requestPermissions: requestLocationPermissions,
            }}
        >
            {children}
        </PermissionContext.Provider>
    );
};

export const usePermissions = (): PermissionContextType => {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        throw new Error(
            "usePermissions must be used within a PermissionProvider"
        );
    }
    return context;
};
