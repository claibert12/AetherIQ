import React from 'react';
import { Box, Text, useColorModeValue } from '@chakra-ui/react';

export const Logo = () => {
    const textColor = useColorModeValue('gray.800', 'white');
    
    return (
        <Box>
            <Text
                fontSize="xl"
                fontWeight="bold"
                color={textColor}
                letterSpacing="tight"
            >
                AetherIQ
            </Text>
        </Box>
    );
}; 