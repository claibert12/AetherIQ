import React from 'react';
import {
    Box,
    Button,
    Container,
    Flex,
    Heading,
    Icon,
    Stack,
    Text,
    useColorModeValue,
    createIcon,
    Image,
    SimpleGrid,
    VStack,
    HStack,
    Badge,
} from '@chakra-ui/react';
import { FiShield, FiTrendingUp, FiCpu, FiAward } from 'react-icons/fi';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

const Arrow = createIcon({
    displayName: 'Arrow',
    viewBox: '0 0 72 24',
    path: (
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M0.600904 7.08166C0.764293 6.8879 1.01492 6.79004 1.26654 6.82177C2.83216 7.01918 5.20326 7.24581 7.54543 7.23964C9.92491 7.23338 12.1351 6.98464 13.4704 6.32142C13.84 6.13785 14.2885 6.28805 14.4722 6.65692C14.6559 7.02578 14.5052 7.47362 14.1356 7.6572C12.4625 8.48822 9.94063 8.72541 7.54852 8.7317C5.67514 8.73663 3.79547 8.5985 2.29921 8.44247C2.80955 9.59638 3.50943 10.6396 4.24665 11.7384C4.39435 11.9585 4.54354 12.1809 4.69301 12.4068C5.79543 14.0733 6.88128 15.8995 7.1179 18.2636C7.15893 18.6735 6.85928 19.0393 6.4486 19.0805C6.03792 19.1217 5.67174 18.8227 5.6307 18.4128C5.43271 16.4346 4.52957 14.868 3.4457 13.2296C3.3058 13.0181 3.16221 12.8046 3.01684 12.5885C2.05899 11.1646 1.02372 9.62564 0.457909 7.78069C0.383671 7.53862 0.437515 7.27541 0.600904 7.08166ZM5.52039 10.2248C5.77662 9.90161 6.24663 9.84687 6.57018 10.1025C16.4834 17.9344 29.9158 22.4064 42.0781 21.4773C54.1988 20.5514 65.0339 14.2748 69.9746 0.584299C70.1145 0.196597 70.5427 -0.0046455 70.931 0.134813C71.3193 0.274276 71.5206 0.70162 71.3807 1.08932C66.2105 15.4159 54.8056 22.0014 42.1913 22.965C29.6185 23.9254 15.8207 19.3142 5.64226 11.2727C5.31871 11.0171 5.26415 10.5479 5.52039 10.2248Z"
            fill="currentColor"
        />
    ),
});

const Feature = ({ title, text, icon }) => {
    return (
        <Stack
            align="center"
            textAlign="center"
            p={8}
            rounded="xl"
            shadow="lg"
            bg={useColorModeValue('white', 'gray.800')}
            _hover={{
                transform: 'translateY(-5px)',
                transition: 'all 0.3s ease',
            }}
        >
            <Flex
                w={16}
                h={16}
                align="center"
                justify="center"
                color="white"
                rounded="full"
                bg="blue.500"
                mb={4}
            >
                <Icon as={icon} w={8} h={8} />
            </Flex>
            <Text fontWeight={600} fontSize="lg">
                {title}
            </Text>
            <Text color={useColorModeValue('gray.600', 'gray.400')}>
                {text}
            </Text>
        </Stack>
    );
};

const Statistic = ({ number, label }) => {
    return (
        <VStack spacing={0}>
            <Text
                fontSize="4xl"
                fontWeight="bold"
                bgGradient="linear(to-r, blue.400, purple.400)"
                bgClip="text"
            >
                {number}
            </Text>
            <Text color={useColorModeValue('gray.600', 'gray.400')}>
                {label}
            </Text>
        </VStack>
    );
};

export const LandingPage = () => {
    return (
        <Box>
            {/* Hero Section */}
            <Container maxW="7xl">
                <Stack
                    align="center"
                    spacing={{ base: 8, md: 10 }}
                    py={{ base: 20, md: 28 }}
                    direction={{ base: 'column', md: 'row' }}
                >
                    <Stack flex={1} spacing={{ base: 5, md: 10 }}>
                        <Heading
                            lineHeight={1.1}
                            fontWeight={600}
                            fontSize={{ base: '3xl', sm: '4xl', lg: '6xl' }}
                        >
                            <Text
                                as="span"
                                position="relative"
                                _after={{
                                    content: "''",
                                    width: 'full',
                                    height: '30%',
                                    position: 'absolute',
                                    bottom: 1,
                                    left: 0,
                                    bg: 'blue.400',
                                    zIndex: -1,
                                }}
                            >
                                Universal AI
                            </Text>
                            <br />
                            <Text
                                as="span"
                                bgGradient="linear(to-r, blue.400, purple.400)"
                                bgClip="text"
                            >
                                Enforcement Platform
                            </Text>
                        </Heading>
                        <Text color={useColorModeValue('gray.600', 'gray.400')} fontSize="xl">
                            AetherIQ empowers enterprises to optimize AI usage, ensure compliance,
                            and automate workflows with intelligent enforcement and real-time monitoring.
                        </Text>
                        <Stack
                            spacing={{ base: 4, sm: 6 }}
                            direction={{ base: 'column', sm: 'row' }}
                        >
                            <Button
                                rounded="full"
                                size="lg"
                                fontWeight="normal"
                                px={6}
                                colorScheme="blue"
                                bg="blue.400"
                                _hover={{ bg: 'blue.500' }}
                            >
                                Get started
                            </Button>
                            <Button
                                rounded="full"
                                size="lg"
                                fontWeight="normal"
                                px={6}
                                leftIcon={<Icon as={FiCpu} h={4} w={4} />}
                            >
                                Live demo
                            </Button>
                        </Stack>
                    </Stack>
                    <Flex
                        flex={1}
                        justify="center"
                        align="center"
                        position="relative"
                        w="full"
                    >
                        <Box
                            position="relative"
                            height="300px"
                            rounded="2xl"
                            boxShadow="2xl"
                            width="full"
                            overflow="hidden"
                        >
                            <Image
                                alt="Hero Image"
                                fit="cover"
                                align="center"
                                w="100%"
                                h="100%"
                                src="/assets/hero-dashboard.png"
                            />
                        </Box>
                    </Flex>
                </Stack>
            </Container>

            {/* Stats Section */}
            <Box bg={useColorModeValue('gray.100', 'gray.700')} py={20}>
                <Container maxW="7xl">
                    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={10}>
                        <Statistic number="99.9%" label="Uptime" />
                        <Statistic number="45%" label="Cost Reduction" />
                        <Statistic number="200+" label="Enterprise Clients" />
                        <Statistic number="24/7" label="Support" />
                    </SimpleGrid>
                </Container>
            </Box>

            {/* Features Section */}
            <Container maxW="7xl" py={20}>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
                    <Feature
                        icon={FiShield}
                        title="Enterprise Security"
                        text="Bank-grade security with SOC2, GDPR, and HIPAA compliance built-in."
                    />
                    <Feature
                        icon={FiTrendingUp}
                        title="AI Optimization"
                        text="Reduce costs and improve efficiency with AI-driven insights and automation."
                    />
                    <Feature
                        icon={FiAward}
                        title="Compliance Assurance"
                        text="Real-time monitoring and enforcement of compliance policies."
                    />
                </SimpleGrid>
            </Container>

            {/* Trust Badges Section */}
            <Box bg={useColorModeValue('gray.50', 'gray.800')} py={20}>
                <Container maxW="7xl">
                    <VStack spacing={8}>
                        <Text
                            fontSize="lg"
                            color={useColorModeValue('gray.600', 'gray.400')}
                            textAlign="center"
                        >
                            Trusted by leading enterprises worldwide
                        </Text>
                        <HStack spacing={8} wrap="wrap" justify="center">
                            <Badge
                                px={4}
                                py={2}
                                colorScheme="green"
                                rounded="full"
                                fontSize="md"
                            >
                                SOC2 Certified
                            </Badge>
                            <Badge
                                px={4}
                                py={2}
                                colorScheme="blue"
                                rounded="full"
                                fontSize="md"
                            >
                                GDPR Compliant
                            </Badge>
                            <Badge
                                px={4}
                                py={2}
                                colorScheme="purple"
                                rounded="full"
                                fontSize="md"
                            >
                                HIPAA Compliant
                            </Badge>
                            <Badge
                                px={4}
                                py={2}
                                colorScheme="orange"
                                rounded="full"
                                fontSize="md"
                            >
                                ISO 27001
                            </Badge>
                        </HStack>
                    </VStack>
                </Container>
            </Box>

            {/* CTA Section */}
            <Container maxW="7xl" py={20}>
                <Stack
                    direction={{ base: 'column', md: 'row' }}
                    spacing={10}
                    align="center"
                    justify="space-between"
                    bg={useColorModeValue('blue.50', 'blue.900')}
                    p={10}
                    rounded="xl"
                >
                    <Stack spacing={4} maxW="2xl">
                        <Heading size="lg">Ready to optimize your AI operations?</Heading>
                        <Text color={useColorModeValue('gray.600', 'gray.400')}>
                            Join leading enterprises in transforming their AI governance
                            and compliance with AetherIQ.
                        </Text>
                    </Stack>
                    <Button
                        rounded="full"
                        size="lg"
                        fontWeight="normal"
                        px={8}
                        colorScheme="blue"
                        bg="blue.400"
                        _hover={{ bg: 'blue.500' }}
                    >
                        Schedule a Demo
                    </Button>
                </Stack>
            </Container>
        </Box>
    );
}; 