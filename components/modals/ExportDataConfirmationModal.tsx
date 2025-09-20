import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface ExportDataConfirmationModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDark?: boolean;
    theme: any;
}

export const ExportDataConfirmationModal: React.FC<ExportDataConfirmationModalProps> = ({
    visible,
    onClose,
    onConfirm,
    isDark = false,
    theme,
}) => {
    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
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
                    <Ionicons
                        name="download-outline"
                        size={48}
                        color={theme.primary}
                        style={styles.icon}
                    />

                    <Text style={[styles.title, { color: theme.text }]}>
                        Export Routes
                    </Text>

                    <Text style={[styles.message, { color: theme.text }]}>
                        This will export all your routes as separate JSON files. Continue?
                    </Text>

                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={[
                                styles.button,
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
                                styles.button,
                                styles.saveButton,
                                { backgroundColor: theme.primary }
                            ]}
                            onPress={onConfirm}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.white }]}>
                                Export
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    icon: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    buttons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
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
