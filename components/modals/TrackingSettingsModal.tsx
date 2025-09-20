import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface TrackingSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    tempIntervalSeconds: string;
    setTempIntervalSeconds: (value: string) => void;
    tempIntervalM: string;
    setTempIntervalM: (value: string) => void;
    isDark?: boolean;
    theme: any;
}

export const TrackingSettingsModal: React.FC<TrackingSettingsModalProps> = ({
    visible,
    onClose,
    onSave,
    tempIntervalSeconds,
    setTempIntervalSeconds,
    tempIntervalM,
    setTempIntervalM,
    isDark = false,
    theme,
}) => {
    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <TouchableOpacity
                style={[styles.modalOverlay, { backgroundColor: theme.background }]}
                activeOpacity={1}
                onPress={onClose}
            >
                <StatusBar
                    style={isDark ? "light" : "dark"}
                    backgroundColor="transparent"
                />
                <TouchableOpacity
                    style={[styles.modalContainer, { backgroundColor: theme.surface }]}
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                >
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                        Tracking Settings
                    </Text>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>
                            Time Interval (seconds)
                        </Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: theme.background,
                                    color: theme.text,
                                    borderColor: theme.border,
                                }
                            ]}
                            value={tempIntervalSeconds}
                            onChangeText={setTempIntervalSeconds}
                            keyboardType="numeric"
                            placeholder="5"
                            placeholderTextColor={theme.textTertiary}
                        />
                        <Text style={[styles.inputHint, { color: theme.textSecondary }]}>
                            Minimum: 1 second
                        </Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>
                            Distance Interval (meters)
                        </Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: theme.background,
                                    color: theme.text,
                                    borderColor: theme.border,
                                }
                            ]}
                            value={tempIntervalM}
                            onChangeText={setTempIntervalM}
                            keyboardType="numeric"
                            placeholder="10"
                            placeholderTextColor={theme.textTertiary}
                        />
                        <Text style={[styles.inputHint, { color: theme.textSecondary }]}>
                            Minimum: 1 meter
                        </Text>
                    </View>

                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[
                                styles.modalButton,
                                styles.cancelButton,
                                { backgroundColor: theme.textTertiary + '20' }
                            ]}
                            onPress={onClose}
                        >
                            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.modalButton,
                                styles.saveButton,
                                { backgroundColor: theme.primary }
                            ]}
                            onPress={onSave}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.white }]}>
                                Save
                            </Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 24,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 4,
    },
    inputHint: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        // backgroundColor set dynamically
    },
    saveButton: {
        // backgroundColor set dynamically
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
