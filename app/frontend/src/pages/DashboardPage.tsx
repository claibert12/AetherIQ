import React from 'react';
import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Text,
  useColorModeValue,
  Flex,
  Icon,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
} from '@chakra-ui/react';
import { FiMoreVertical, FiPlus, FiRefreshCw, FiDownload } from 'react-icons/fi';
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
  { name: 'Jan', licenses: 400, usage: 240 },
  { name: 'Feb', licenses: 300, usage: 139 },
  { name: 'Mar', licenses: 200, usage: 980 },
  { name: 'Apr', licenses: 278, usage: 390 },
  { name: 'May', licenses: 189, usage: 480 },
  { name: 'Jun', licenses: 239, usage: 380 },
];

const StatCard = ({ title, value, change, icon }: any) => {
  return (
    <Card>
      <CardBody>
        <Flex justify="space-between" align="center">
          <Box>
            <StatLabel fontSize="sm" color="gray.500">
              {title}
            </StatLabel>
            <StatNumber fontSize="2xl">{value}</StatNumber>
            <StatHelpText>
              <StatArrow type={change > 0 ? 'increase' : 'decrease'} />
              {Math.abs(change)}% from last month
            </StatHelpText>
          </Box>
          <Icon as={icon} w={8} h={8} color="blue.400" />
        </Flex>
      </CardBody>
    </Card>
  );
};

const ChartCard = ({ title, children }: any) => {
  return (
    <Card>
      <CardHeader>
        <Flex justify="space-between" align="center">
          <Heading size="md">{title}</Heading>
          <Menu>
            <MenuButton
              as={IconButton}
              aria-label="Options"
              icon={<FiMoreVertical />}
              variant="ghost"
            />
            <MenuList>
              <MenuItem icon={<FiRefreshCw />}>Refresh</MenuItem>
              <MenuItem icon={<FiDownload />}>Download</MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </CardHeader>
      <CardBody>
        {children}
      </CardBody>
    </Card>
  );
};

export const DashboardPage = () => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Dashboard</Heading>
        <Button leftIcon={<FiPlus />} colorScheme="blue">
          Add Widget
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={6}>
        <StatCard
          title="Total Licenses"
          value="1,234"
          change={12.5}
          icon={FiPlus}
        />
        <StatCard
          title="Active Users"
          value="892"
          change={-2.4}
          icon={FiPlus}
        />
        <StatCard
          title="Cost Savings"
          value="$45,678"
          change={8.2}
          icon={FiPlus}
        />
        <StatCard
          title="Compliance Score"
          value="98%"
          change={1.2}
          icon={FiPlus}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        <ChartCard title="License Usage Trends">
          <Box h="300px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="licenses"
                  stroke="#3182CE"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="usage"
                  stroke="#48BB78"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>

        <ChartCard title="License Distribution">
          <Box h="300px">
            {/* Add your pie chart or other visualization here */}
            <Text>License distribution visualization will go here</Text>
          </Box>
        </ChartCard>
      </SimpleGrid>
    </Box>
  );
}; 