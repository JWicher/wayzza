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

interface DeleteConfirmationModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    warning?: string;
    isDark?: boolean;
    theme: any;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
    visible,
    onClose,
    onConfirm,
    title,
    message,
    warning,
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
                    <View style={styles.modalHeader}>
                        <Ionicons
                            name="warning"
                            size={48}
                            color={theme.error}
                            style={styles.icon}
                        />
                        <Text style={[styles.modalTitle, { color: theme.text }]}>
                            {title}
                        </Text>
                    </View>

                    <Text style={[styles.modalMessage, { color: theme.text }]}>
                        {message}
                    </Text>

                    {warning && (
                        <Text style={[styles.modalWarning, { color: theme.textSecondary }]}>
                            {warning}
                        </Text>
                    )}

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
                                styles.deleteButton,
                                { backgroundColor: theme.error }
                            ]}
                            onPress={onConfirm}
                        >
                            <Text style={[styles.deleteButtonText, { color: theme.white }]}>
                                Delete
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    icon: {
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 22,
    },
    modalWarning: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
        fontStyle: 'italic',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
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
    deleteButton: {
        // backgroundColor set dynamically
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
