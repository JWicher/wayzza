import { Ionicons } from '@expo/vector-icons';
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  StorageAccessFramework,
  writeAsStringAsync
} from 'expo-file-system/legacy';
import * as NavigationBar from 'expo-navigation-bar';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ClearDataConfirmationModal,
  ExportDataConfirmationModal,
  showThemedAlert,
  TrackingSettingsModal
} from '../components/modals';
import { useTheme } from '../contexts/ThemeContext';
import { clearAllData, exportAllRoutesData, getTrackingSettings, setTrackingSettings } from '../lib/database';

export default function SettingsPage() {
  const { theme, isDark, setTheme } = useTheme();
  const [locationTracking, setLocationTracking] = useState(true);

  // Tracking interval settings
  const [trackingIntervalSeconds, setTrackingIntervalSeconds] = useState(5);
  const [trackingIntervalM, setTrackingIntervalM] = useState(10);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [tempIntervalSeconds, setTempIntervalSeconds] = useState('5');
  const [tempIntervalM, setTempIntervalM] = useState('10');

  // Confirmation modals
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Load tracking settings on component mount
  useEffect(() => {
    const loadTrackingSettings = async () => {
      try {
        const settings = await getTrackingSettings();
        setTrackingIntervalSeconds(settings.intervalSeconds);
        setTrackingIntervalM(settings.intervalM);
        setTempIntervalSeconds(settings.intervalSeconds.toString());
        setTempIntervalM(settings.intervalM.toString());
      } catch (error) {
        console.error('Error loading tracking settings:', error);
      }
    };

    loadTrackingSettings();

    NavigationBar.setVisibilityAsync("hidden");
  }, []);

  const handleClearData = () => {
    setShowClearDataModal(true);
  };

  const confirmClearData = async () => {
    setShowClearDataModal(false);
    try {
      console.log('Starting to clear all data...');
      const result = await clearAllData();
      console.log('Data cleared:', result);

      const totalCleared = result.coordinatesDeleted + result.routesDeleted;

      if (totalCleared === 0) {
        showThemedAlert('No Data', 'No route data was found to clear.', [
          { text: 'OK' }
        ], 'information-circle-outline');
      } else {
        showThemedAlert(
          'Success',
          `All route data has been cleared.\n\n${result.routesDeleted} route(s) and ${result.coordinatesDeleted} coordinate(s) deleted.`,
          [{ text: 'OK' }],
          'checkmark-circle-outline',
          '#34d399'
        );
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      showThemedAlert('Error', 'Failed to clear route data. Please try again.', [
        { text: 'OK' }
      ], 'alert-circle-outline', '#f87171');
    }
  };

  const handleExportData = () => {
    setShowExportModal(true);
  };

  const confirmExportData = async () => {
    setShowExportModal(false);
    try {
      // Get all route data
      console.log('Starting export process...');
      const routesData = await exportAllRoutesData();
      console.log('Routes data retrieved:', routesData.length, 'routes');

      if (routesData.length === 0) {
        showThemedAlert('No Data', 'No routes found to export.', [
          { text: 'OK' }
        ], 'information-circle-outline');
        return;
      }

      if (Platform.OS === 'android') {
        // For Android, let user choose directory using StorageAccessFramework
        try {
          const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            showThemedAlert('Permission Required', 'Permission to access storage is required to export files.', [
              { text: 'OK' }
            ], 'lock-closed-outline', '#f59e0b');
            return;
          }

          // Create WIW-routes subfolder
          const subfolderUri = await StorageAccessFramework.makeDirectoryAsync(
            permissions.directoryUri,
            `WIW-routes-${new Date().toISOString()}`
          );

          const exportedFiles: string[] = [];

          // Create individual JSON files for each route
          for (const routeData of routesData) {
            // Create safe filename from route name
            const safeFileName = routeData.route
              .replace(/[^a-z0-9]/gi, '_')
              .toLowerCase();
            const fileName = `route_${routeData.id}_${safeFileName}.json`;

            // Create file using Storage Access Framework in the subfolder
            const fileUri = await StorageAccessFramework.createFileAsync(
              subfolderUri,
              fileName,
              'application/json'
            );

            // Write JSON data
            await writeAsStringAsync(
              fileUri,
              JSON.stringify(routeData, null, 2),
              { encoding: 'utf8' }
            );

            exportedFiles.push(fileName);
          }

          // Create a summary file
          const summaryData = {
            exportDate: new Date().toISOString(),
            totalRoutes: routesData.length,
            files: exportedFiles,
            routes: routesData.map(r => ({
              id: r.id,
              name: r.route,
              coordinateCount: r.coordinates.length
            }))
          };

          const summaryUri = await StorageAccessFramework.createFileAsync(
            subfolderUri,
            'export_summary.json',
            'application/json'
          );

          await writeAsStringAsync(
            summaryUri,
            JSON.stringify(summaryData, null, 2),
            { encoding: 'utf8' }
          );

          showThemedAlert(
            'Export Complete',
            `${routesData.length} routes exported successfully to WIW-routes folder!`,
            [{ text: 'OK' }],
            'checkmark-circle-outline',
            '#34d399'
          );

        } catch (storageError) {
          console.error('Storage access error:', storageError);
          showThemedAlert('Export Error', 'Failed to access storage. Please try again.', [
            { text: 'OK' }
          ], 'alert-circle-outline', '#f87171');
        }
      } else {
        // For iOS, use app documents directory (accessible through Files app)
        const exportDir = documentDirectory + `WIW-routes-${new Date().toISOString()}/`;

        const dirInfo = await getInfoAsync(exportDir);
        if (!dirInfo.exists) {
          await makeDirectoryAsync(exportDir, { intermediates: true });
        }

        const exportedFiles: string[] = [];

        for (const routeData of routesData) {
          const safeFileName = routeData.route
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();
          const fileName = `route_${routeData.id}_${safeFileName}.json`;
          const filePath = exportDir + fileName;

          await writeAsStringAsync(
            filePath,
            JSON.stringify(routeData, null, 2),
            { encoding: 'utf8' }
          );

          exportedFiles.push(fileName);
        }

        // Create summary file
        const summaryData = {
          exportDate: new Date().toISOString(),
          totalRoutes: routesData.length,
          files: exportedFiles,
          routes: routesData.map(r => ({
            id: r.id,
            name: r.route,
            coordinateCount: r.coordinates.length
          }))
        };

        const summaryPath = exportDir + 'export_summary.json';
        await writeAsStringAsync(
          summaryPath,
          JSON.stringify(summaryData, null, 2),
          { encoding: 'utf8' }
        );

        showThemedAlert(
          'Export Complete',
          `${routesData.length} routes exported successfully!\n\nFiles saved to WIW-routes folder in app Documents.\nAccess through Files app.`,
          [{ text: 'OK' }],
          'checkmark-circle-outline',
          '#34d399'
        );
      }

    } catch (error) {
      console.error('Error exporting data:', error);
      showThemedAlert('Export Error', 'Failed to export route data. Please try again.', [
        { text: 'OK' }
      ], 'alert-circle-outline', '#f87171');
    }
  };

  const handleTrackingSettings = () => {
    setTempIntervalSeconds(trackingIntervalSeconds.toString());
    setTempIntervalM(trackingIntervalM.toString());
    setShowTrackingModal(true);
  };

  const saveTrackingSettings = async () => {
    try {
      const intervalSeconds = parseInt(tempIntervalSeconds, 10);
      const intervalM = parseInt(tempIntervalM, 10);

      // Validate inputs
      if (isNaN(intervalSeconds) || intervalSeconds < 1) {
        showThemedAlert('Invalid Input', 'Time interval must be at least 1 second.', [
          { text: 'OK' }
        ], 'warning-outline', '#f59e0b');
        return;
      }

      if (isNaN(intervalM) || intervalM < 1) {
        showThemedAlert('Invalid Input', 'Distance interval must be at least 1 meter.', [
          { text: 'OK' }
        ], 'warning-outline', '#f59e0b');
        return;
      }

      await setTrackingSettings(intervalSeconds, intervalM);
      setTrackingIntervalSeconds(intervalSeconds);
      setTrackingIntervalM(intervalM);
      setShowTrackingModal(false);
      showThemedAlert('Success', 'Tracking settings updated successfully.', [
        { text: 'OK' }
      ], 'checkmark-circle-outline', '#34d399');
    } catch (error) {
      console.error('Error saving tracking settings:', error);
      showThemedAlert('Error', 'Failed to save tracking settings.', [
        { text: 'OK' }
      ], 'alert-circle-outline', '#f87171');
    }
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    rightElement,
    onPress
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <TouchableOpacity style={getStyles(theme).settingItem} onPress={onPress}>
      <View style={getStyles(theme).settingLeft}>
        <Ionicons name={icon as any} size={24} color={theme.primary} />
        <View style={getStyles(theme).settingText}>
          <Text style={getStyles(theme).settingTitle}>{title}</Text>
          {subtitle && <Text style={getStyles(theme).settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement && <View>{rightElement}</View>}
      {!rightElement && <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={getStyles(theme).container}>
        <ScrollView style={getStyles(theme).content} showsVerticalScrollIndicator={false}>

          {/* Appearance Section */}
          <View style={getStyles(theme).section}>
            <Text style={getStyles(theme).sectionTitle}>Appearance</Text>

            <SettingItem
              icon="moon-outline"
              title="Dark Mode"
              subtitle="Use dark theme for the app"
              onPress={() => setTheme(!isDark)}
              rightElement={
                <Switch
                  value={isDark}
                  onValueChange={setTheme}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={theme.white}
                />
              }
            />
          </View>

          {/* Data Section */}
          <View style={getStyles(theme).section}>
            <Text style={getStyles(theme).sectionTitle}>Data</Text>

            <SettingItem
              icon="time-outline"
              title="Tracking Settings"
              subtitle={`Time: ${trackingIntervalSeconds}s, Distance: ${trackingIntervalM}m`}
              onPress={handleTrackingSettings}
            />

            <SettingItem
              icon="download-outline"
              title="Export Data"
              subtitle="Download your route data"
              onPress={handleExportData}
            />

            <SettingItem
              icon="trash-outline"
              title="Clear All Data"
              subtitle="Delete all saved routes"
              onPress={handleClearData}
            />
          </View>

          {/* About Section */}
          <View style={getStyles(theme).sectionBottom}>
            <Text style={getStyles(theme).sectionTitle}>About</Text>

            <SettingItem
              icon="information-circle-outline"
              title="App Version"
              subtitle="1.0.0"
            />

          </View>
        </ScrollView>

        {/* Tracking Settings Modal */}
        <TrackingSettingsModal
          visible={showTrackingModal}
          onClose={() => setShowTrackingModal(false)}
          onSave={saveTrackingSettings}
          tempIntervalSeconds={tempIntervalSeconds}
          setTempIntervalSeconds={setTempIntervalSeconds}
          tempIntervalM={tempIntervalM}
          setTempIntervalM={setTempIntervalM}
          isDark={isDark}
          theme={theme}
        />

        {/* Clear Data Confirmation Modal */}
        <ClearDataConfirmationModal
          visible={showClearDataModal}
          onClose={() => setShowClearDataModal(false)}
          onConfirm={confirmClearData}
          isDark={isDark}
          theme={theme}
        />

        {/* Export Data Confirmation Modal */}
        <ExportDataConfirmationModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          onConfirm={confirmExportData}
          isDark={isDark}
          theme={theme}
        />
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.background,
  },
  section: {
    marginBottom: 30,
  },
  sectionBottom: {
    marginBottom: 60,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
    paddingLeft: 5,
  },
  settingItem: {
    backgroundColor: theme.surface,
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 15,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  settingSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  modalContainer: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 12,
    color: theme.textTertiary,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  saveButton: {
    backgroundColor: theme.primary,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '600',
  },
  // Confirmation modal styles
  confirmationModalContainer: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  confirmationIcon: {
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButton: {
    backgroundColor: theme.error || '#FF3B30',
  },
  destructiveButtonText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
