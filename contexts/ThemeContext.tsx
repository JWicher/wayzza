import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, useColorScheme } from 'react-native';

export interface Theme {
    // Background colors
    background: string;
    surface: string;
    card: string;

    // Text colors
    text: string;
    textSecondary: string;
    textTertiary: string;

    // Brand colors
    primary: string;
    secondary: string;
    accent: string;

    // Status colors
    success: string;
    warning: string;
    error: string;

    // Border and divider colors
    border: string;
    divider: string;

    // Shadow color
    shadow: string;

    // Special colors
    white: string;
    black: string;
}

export const lightTheme: Theme = {
    background: '#f5f5f5',
    surface: '#ffffff',
    card: '#ffffff',

    text: '#1f2937',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',

    primary: '#6366f1',
    secondary: '#3b82f6',
    accent: '#10b981',

    success: '#10b981',
    warning: '#f59e0b',
    error: '#dc2626',

    border: '#e5e7eb',
    divider: '#d1d5db',

    shadow: '#000000',

    white: '#ffffff',
    black: '#000000',
};

export const darkTheme: Theme = {
    background: '#111827',
    surface: '#1f2937',
    card: '#374151',

    text: '#f9fafb',
    textSecondary: '#d1d5db',
    textTertiary: '#9ca3af',

    primary: '#818cf8',
    secondary: '#60a5fa',
    accent: '#34d399',

    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',

    border: '#4b5563',
    divider: '#6b7280',

    shadow: '#000000',

    white: '#ffffff',
    black: '#000000',
};

interface ThemeContextType {
    theme: Theme;
    isDark: boolean;
    toggleTheme: () => void;
    setTheme: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@app_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [isDark, setIsDark] = useState(systemColorScheme === 'dark');
    const [isLoading, setIsLoading] = useState(true);

    // Load saved theme preference on app start
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (savedTheme !== null) {
                    setIsDark(JSON.parse(savedTheme));
                }
            } catch (error) {
                console.error('Error loading theme preference:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTheme();
    }, []);

    // Save theme preference whenever it changes
    useEffect(() => {
        const saveTheme = async () => {
            try {
                await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(isDark));
            } catch (error) {
                console.error('Error saving theme preference:', error);
            }
        };

        if (!isLoading) {
            saveTheme();
        }
    }, [isDark, isLoading]);

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    const setTheme = (dark: boolean) => {
        setIsDark(dark);
    };

    const theme = isDark ? darkTheme : lightTheme;

    // Show loading screen with proper background to prevent flashing
    if (isLoading) {
        const loadingTheme = isDark ? darkTheme : lightTheme;
        return (
            <View style={{ flex: 1, backgroundColor: loadingTheme.background }}>
                {/* Empty loading view with appropriate background */}
            </View>
        );
    }

    return (
        <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
