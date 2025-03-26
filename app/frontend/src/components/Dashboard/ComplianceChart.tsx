import React from 'react';
import {
    Box,
    Heading,
    useColorModeValue,
} from '@chakra-ui/react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

const data = [
    { month: 'Jan', compliance: 95.2 },
    { month: 'Feb', compliance: 96.5 },
    { month: 'Mar', compliance: 97.1 },
    { month: 'Apr', compliance: 97.8 },
    { month: 'May', compliance: 98.2 },
    { month: 'Jun', compliance: 98.5 },
];

export const ComplianceChart: React.FC = () => {
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const lineColor = useColorModeValue('#3182CE', '#63B3ED');

    return (
        <Box
            p={5}
            bg={bgColor}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="lg"
            boxShadow="sm"
        >
            <Heading size="md" mb={4}>Compliance Trend</Heading>
            <Box h="300px">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[90, 100]} />
                        <Tooltip />
                        <Line
                            type="monotone"
                            dataKey="compliance"
                            stroke={lineColor}
                            strokeWidth={2}
                            dot={{ fill: lineColor, r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Box>
        </Box>
    );
}; 