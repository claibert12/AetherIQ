import React from 'react';
import {
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuDivider,
    Avatar,
    Text,
    Box,
    useColorModeValue,
} from '@chakra-ui/react';
import { FiUser, FiSettings, FiLogOut } from 'react-icons/fi';

interface UserMenuProps {
    user: {
        name: string;
        email: string;
        avatar?: string;
    };
    onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    return (
        <Menu>
            <MenuButton>
                <Box display="flex" alignItems="center">
                    <Avatar
                        size="sm"
                        name={user.name}
                        src={user.avatar}
                        mr={2}
                    />
                    <Text display={{ base: 'none', md: 'block' }}>
                        {user.name}
                    </Text>
                </Box>
            </MenuButton>
            <MenuList bg={bgColor} borderColor={borderColor}>
                <MenuItem icon={<FiUser />}>Profile</MenuItem>
                <MenuItem icon={<FiSettings />}>Settings</MenuItem>
                <MenuDivider />
                <MenuItem
                    icon={<FiLogOut />}
                    color="red.500"
                    onClick={onLogout}
                >
                    Logout
                </MenuItem>
            </MenuList>
        </Menu>
    );
}; 