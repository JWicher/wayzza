import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import {
    deleteRoute,
    getRouteById,
    RouteRecord,
    updateRoute
} from '../lib/database';

export default function EditRoutePage() {
    const { theme } = useTheme();
    const { routeId } = useLocalSearchParams<{ routeId: string }>();
    const [route, setRoute] = useState<RouteRecord | null>(null);
    const [routeName, setRouteName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadRoute();
    }, [routeId]);

    const loadRoute = async () => {
        if (!routeId) {
            Alert.alert('Error', 'No route ID provided');
            router.back();
            return;
        }

        try {
            const routeData = await getRouteById(parseInt(routeId));
            if (routeData) {
                setRoute(routeData);
                setRouteName(routeData.name);
            } else {
                Alert.alert('Error', 'Route not found');
                router.back();
            }
        } catch (error) {
            console.error('Error loading route:', error);
            Alert.alert('Error', 'Failed to load route');
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!route) return;

        const trimmedName = routeName.trim();
        if (!trimmedName) {
            Alert.alert('Invalid Name', 'Please enter a route name.');
            return;
        }

        if (trimmedName === route.name) {
            // No changes made
            router.back();
            return;
        }

        setIsSaving(true);
        try {
            await updateRoute(route.id!, trimmedName);
            router.back();
        } catch (error) {
            console.error('Error updating route:', error);
            Alert.alert('Error', 'Failed to update route. The name might already exist.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (!route) return;

        Alert.alert(
            'Delete Route',
            `Are you sure you want to delete "${route.name}"? This will also delete all coordinates for this route.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: confirmDelete
                }
            ]
        );
    };

    const confirmDelete = async () => {
        if (!route) return;

        try {
            await deleteRoute(route.id!);
            router.replace('/');
        } catch (error) {
            console.error('Error deleting route:', error);
            Alert.alert('Error', 'Failed to delete route.');
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={getStyles(theme).container}>
                <View style={getStyles(theme).loadingContainer}>
                    <Text style={getStyles(theme).loadingText}>Loading route...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={getStyles(theme).container}>

            <View style={getStyles(theme).content}>
                <View style={getStyles(theme).section}>
                    <Text style={getStyles(theme).sectionTitle}>Route Name</Text>
                    <TextInput
                        style={getStyles(theme).input}
                        value={routeName}
                        onChangeText={setRouteName}
                        placeholder="Enter route name"
                        placeholderTextColor={theme.textTertiary}
                        autoFocus={true}
                        editable={!isSaving}
                    />
                </View>

                <View style={getStyles(theme).buttonContainer}>
                    <TouchableOpacity
                        style={[getStyles(theme).button, getStyles(theme).saveButton]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        <Ionicons name="checkmark-circle" size={20} color="white" />
                        <Text style={getStyles(theme).buttonText}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[getStyles(theme).button, getStyles(theme).deleteButton]}
                        onPress={handleDelete}
                        disabled={isSaving}
                    >
                        <Ionicons name="trash" size={20} color="white" />
                        <Text style={getStyles(theme).buttonText}>Delete Route</Text>
                    </TouchableOpacity>
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
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: theme.text,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 10,
    },
    input: {
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: theme.text,
    },
    buttonContainer: {
        gap: 15,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        gap: 8,
    },
    saveButton: {
        backgroundColor: theme.success,
    },
    deleteButton: {
        backgroundColor: theme.error,
    },
    buttonText: {
        color: theme.white,
        fontSize: 16,
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: theme.textSecondary,
    },
});
