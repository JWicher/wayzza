import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface ThemedAlertProps {
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    onClose: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
}

export const ThemedAlert: React.FC<ThemedAlertProps> = ({
    visible,
    title,
    message,
    buttons = [{ text: 'OK' }],
    onClose,
    icon,
    iconColor,
}) => {
    const { theme } = useTheme();

    const handleButtonPress = (button: AlertButton) => {
        if (button.onPress) {
            button.onPress();
        }
        onClose();
    };

    const getButtonStyle = (buttonStyle?: string) => {
        switch (buttonStyle) {
            case 'cancel':
                return {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderWidth: 1,
                };
            case 'destructive':
                return {
                    backgroundColor: theme.error,
                };
            default:
                return {
                    backgroundColor: theme.primary,
                };
        }
    };

    const getButtonTextStyle = (buttonStyle?: string) => {
        switch (buttonStyle) {
            case 'cancel':
                return {
                    color: theme.textSecondary,
                };
            case 'destructive':
                return {
                    color: theme.white,
                };
            default:
                return {
                    color: theme.white,
                };
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    style={[styles.container, { backgroundColor: theme.surface }]}
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                >
                    {icon && (
                        <View style={styles.iconContainer}>
                            <Ionicons
                                name={icon}
                                size={48}
                                color={iconColor || theme.primary}
                            />
                        </View>
                    )}

                    <Text style={[styles.title, { color: theme.text }]}>
                        {title}
                    </Text>

                    {message && (
                        <Text style={[styles.message, { color: theme.textSecondary }]}>
                            {message}
                        </Text>
                    )}

                    <View style={styles.buttonContainer}>
                        {buttons.map((button, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.button,
                                    getButtonStyle(button.style),
                                    buttons.length === 1 && styles.singleButton,
                                ]}
                                onPress={() => handleButtonPress(button)}
                            >
                                <Text style={[
                                    styles.buttonText,
                                    getButtonTextStyle(button.style)
                                ]}>
                                    {button.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

// Global alert state management
let alertRef: ((props: Omit<ThemedAlertProps, 'visible' | 'onClose'>) => void) | null = null;

export const ThemedAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [alertProps, setAlertProps] = useState<ThemedAlertProps | null>(null);

    alertRef = (props: Omit<ThemedAlertProps, 'visible' | 'onClose'>) => {
        setAlertProps({
            ...props,
            visible: true,
            onClose: () => setAlertProps(null),
        });
    };

    return (
        <>
            {children}
            {alertProps && (
                <ThemedAlert
                    {...alertProps}
                />
            )}
        </>
    );
};

// Static method to show alerts from anywhere in the app
export const showThemedAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    icon?: keyof typeof Ionicons.glyphMap,
    iconColor?: string
) => {
    if (alertRef) {
        alertRef({
            title,
            message,
            buttons,
            icon,
            iconColor,
        });
    }
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        borderRadius: 16,
        padding: 24,
        width: Dimensions.get('window').width * 0.85,
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    singleButton: {
        minWidth: 120,
        flex: 0,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
