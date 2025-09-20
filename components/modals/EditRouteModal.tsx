import { Ionicons } from '@expo/vector-icons';
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

interface EditRouteModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    onDelete: () => void;
    routeName: string;
    setRouteName: (name: string) => void;
    isSaving?: boolean;
    isDark?: boolean;
    theme: any;
}

export const EditRouteModal: React.FC<EditRouteModalProps> = ({
    visible,
    onClose,
    onSave,
    onDelete,
    routeName,
    setRouteName,
    isSaving = false,
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
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                        Edit Route
                    </Text>

                    <View style={styles.inputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>
                            Route Name
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
                            value={routeName}
                            onChangeText={setRouteName}
                            placeholder="Enter route name"
                            placeholderTextColor={theme.textTertiary}
                            autoFocus={true}
                            editable={!isSaving}
                        />
                    </View>

                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[
                                styles.modalButton,
                                styles.cancelButton,
                                { backgroundColor: theme.textTertiary + '20' }
                            ]}
                            onPress={onClose}
                            disabled={isSaving}
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
                            disabled={isSaving}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.white }]}>
                                {isSaving ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.deleteButtonSection}
                        onPress={onDelete}
                        disabled={isSaving}
                    >
                        <Ionicons name="trash-outline" size={20} color={theme.error} />
                        <Text style={[styles.deleteButtonText, { color: theme.error }]}>
                            Delete Route
                        </Text>
                    </TouchableOpacity>
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
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
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
    deleteButtonSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
        marginTop: 8,
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
