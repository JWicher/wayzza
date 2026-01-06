import { Stack } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemedAlertProvider } from '../components/modals';
import { PermissionProvider } from '../contexts/PermissionContext';
import { ThemeProvider, darkTheme, lightTheme, useTheme } from '../contexts/ThemeContext';

function ThemedStack() {
  const { isDark, theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={theme.background} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            color: theme.text,
          },
          contentStyle: {
            backgroundColor: theme.background,
          },
          animation: 'slide_from_right',
          animationDuration: 150,
        }}
      >
        <Stack.Screen name="index" options={{
          title: 'Where I Was',
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.background,
          }
        }} />
        <Stack.Screen name="tracking" options={{
          title: 'Trip Tracking',
          contentStyle: {
            backgroundColor: theme.background,
          }
        }} />
        <Stack.Screen name="map" options={{
          title: 'Your Route',
          contentStyle: {
            backgroundColor: theme.background,
          }
        }} />
        <Stack.Screen name="settings" options={{
          title: 'Settings',
          contentStyle: {
            backgroundColor: theme.background,
          }
        }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const systemColorScheme = useColorScheme();
  const initialBackground = systemColorScheme === 'dark' ? darkTheme.background : lightTheme.background;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: initialBackground }}>
        <ThemeProvider>
          <PermissionProvider>
            <ThemedAlertProvider>
              <ThemedStack />
            </ThemedAlertProvider>
          </PermissionProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}
