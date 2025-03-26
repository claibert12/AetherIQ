import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Flex,
    Text,
    Badge,
    useColorModeValue,
} from '@chakra-ui/react';
import { FiHome, FiBarChart2, FiShield, FiSettings } from 'react-icons/fi';

interface NavItemProps {
    to: string;
    icon: 'dashboard' | 'chart' | 'shield' | 'settings';
    label: string;
    badge?: {
        count: number;
        color: string;
    };
}

const getIcon = (icon: NavItemProps['icon']) => {
    switch (icon) {
        case 'dashboard':
            return <FiHome size={20} />;
        case 'chart':
            return <FiBarChart2 size={20} />;
        case 'shield':
            return <FiShield size={20} />;
        case 'settings':
            return <FiSettings size={20} />;
        default:
            return null;
    }
};

export const NavItem: React.FC<NavItemProps> = ({ to, icon, label, badge }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    const activeBg = useColorModeValue('blue.50', 'blue.900');
    const hoverBg = useColorModeValue('gray.100', 'gray.700');

    return (
        <Link to={to}>
            <Flex
                align="center"
                p="4"
                mx="4"
                borderRadius="lg"
                role="group"
                cursor="pointer"
                bg={isActive ? activeBg : 'transparent'}
                _hover={{
                    bg: hoverBg,
                }}
            >
                {getIcon(icon)}
                <Text ml="4" fontWeight={isActive ? 'bold' : 'normal'}>
                    {label}
                </Text>
                {badge && (
                    <Badge
                        ml="auto"
                        colorScheme={badge.color}
                        variant="solid"
                        borderRadius="full"
                    >
                        {badge.count}
                    </Badge>
                )}
            </Flex>
        </Link>
    );
}; 