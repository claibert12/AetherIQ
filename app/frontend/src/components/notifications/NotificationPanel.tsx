import React from 'react';
import {
    Box,
    VStack,
    Text,
    Badge,
    IconButton,
    useColorModeValue,
} from '@chakra-ui/react';
import { FiX } from 'react-icons/fi';

interface Notification {
    id: string;
    type: 'alert' | 'info' | 'success' | 'warning';
    message: string;
    timestamp: string;
}

interface NotificationPanelProps {
    notifications: Notification[];
    onClose: (id: string) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
    notifications,
    onClose,
}) => {
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const getBadgeColor = (type: Notification['type']) => {
        switch (type) {
            case 'alert':
                return 'red';
            case 'warning':
                return 'yellow';
            case 'success':
                return 'green';
            default:
                return 'blue';
        }
    };

    return (
        <Box
            position="absolute"
            top="60px"
            right="20px"
            w="400px"
            bg={bgColor}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="md"
            boxShadow="lg"
            zIndex={1000}
        >
            <VStack spacing={4} p={4} align="stretch">
                {notifications.map((notification) => (
                    <Box
                        key={notification.id}
                        p={4}
                        borderWidth="1px"
                        borderColor={borderColor}
                        borderRadius="md"
                        position="relative"
                    >
                        <IconButton
                            aria-label="Close notification"
                            icon={<FiX />}
                            size="sm"
                            position="absolute"
                            top={2}
                            right={2}
                            variant="ghost"
                            onClick={() => onClose(notification.id)}
                        />
                        <Badge
                            colorScheme={getBadgeColor(notification.type)}
                            mb={2}
                        >
                            {notification.type.toUpperCase()}
                        </Badge>
                        <Text>{notification.message}</Text>
                        <Text fontSize="sm" color="gray.500" mt={2}>
                            {new Date(notification.timestamp).toLocaleString()}
                        </Text>
                    </Box>
                ))}
            </VStack>
        </Box>
    );
}; 