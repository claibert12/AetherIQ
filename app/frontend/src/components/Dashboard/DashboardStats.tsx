import React from 'react';
import {
    SimpleGrid,
    Box,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    StatArrow,
    useColorModeValue,
} from '@chakra-ui/react';
import { FiTrendingUp, FiTrendingDown, FiShield, FiUsers } from 'react-icons/fi';

interface StatCardProps {
    label: string;
    value: string | number;
    change?: number;
    icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, change, icon }) => {
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    return (
        <Box
            p={5}
            bg={bgColor}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="lg"
            boxShadow="sm"
        >
            <Stat>
                <Box display="flex" alignItems="center" mb={2}>
                    <Box mr={2} color="blue.500">
                        {icon}
                    </Box>
                    <StatLabel fontSize="lg">{label}</StatLabel>
                </Box>
                <StatNumber fontSize="2xl">{value}</StatNumber>
                {change !== undefined && (
                    <StatHelpText>
                        <StatArrow
                            type={change >= 0 ? 'increase' : 'decrease'}
                            color={change >= 0 ? 'green.500' : 'red.500'}
                        />
                        {Math.abs(change)}% from last month
                    </StatHelpText>
                )}
            </Stat>
        </Box>
    );
};

export const DashboardStats: React.FC = () => {
    return (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
            <StatCard
                label="Total Licenses"
                value="1,234"
                change={12.5}
                icon={<FiUsers size={24} />}
            />
            <StatCard
                label="Compliance Rate"
                value="98.5%"
                change={2.3}
                icon={<FiShield size={24} />}
            />
            <StatCard
                label="Active Workflows"
                value="45"
                change={-3.2}
                icon={<FiTrendingUp size={24} />}
            />
            <StatCard
                label="Risk Score"
                value="Low"
                change={-5.7}
                icon={<FiTrendingDown size={24} />}
            />
        </SimpleGrid>
    );
}; 