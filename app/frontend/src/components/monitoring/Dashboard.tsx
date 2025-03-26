import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Heading,
    Text,
    Select,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    StatArrow,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    useToast,
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    Badge,
    HStack,
} from '@chakra-ui/react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { format } from 'date-fns';
import axios from 'axios';

interface MetricsData {
    total_requests: number;
    actions: Record<string, number>;
    capabilities: Record<string, number>;
    daily_requests: Array<{
        date: string;
        count: number;
    }>;
    common_patterns: Array<{
        capability: string;
        action: string;
        count: number;
    }>;
    ai_performance: {
        prediction_accuracy: number;
        average_latency: number;
        model_version: string;
        training_status: string;
    };
    security_metrics: {
        encryption_status: string;
        unauthorized_attempts: number;
        compliance_status: Record<string, boolean>;
        audit_log_completeness: number;
    };
    automation_metrics: {
        automated_workflows: number;
        manual_workflows: number;
        automation_suggestions: number;
        efficiency_gain: number;
    };
    integration_health: Array<{
        name: string;
        status: string;
        latency: number;
        success_rate: number;
    }>;
}

interface RuleEffectiveness {
    rule_id: string;
    rule_name: string;
    capability: string;
    level: string;
    total_applications: number;
    blocks: number;
    warnings: number;
    effectiveness_score: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export const MonitoringDashboard: React.FC = () => {
    const [timeRange, setTimeRange] = useState<string>('24h');
    const [organizationId, setOrganizationId] = useState<string>('');
    const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
    const [ruleEffectiveness, setRuleEffectiveness] = useState<RuleEffectiveness[]>([]);
    const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const toast = useToast();

    useEffect(() => {
        // In a real app, you would fetch the list of organizations
        setOrganizations([
            { id: 'org1', name: 'Organization 1' },
            { id: 'org2', name: 'Organization 2' },
        ]);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [metricsResponse, effectivenessResponse] = await Promise.all([
                    axios.get(`/api/v1/monitoring/metrics`, {
                        params: {
                            time_range: timeRange,
                            organization_id: organizationId || undefined,
                        },
                    }),
                    axios.get(`/api/v1/monitoring/rule-effectiveness`, {
                        params: {
                            time_range: timeRange,
                        },
                    }),
                ]);

                setMetricsData(metricsResponse.data);
                setRuleEffectiveness(effectivenessResponse.data);
            } catch (error) {
                toast({
                    title: 'Error fetching metrics',
                    description: 'Failed to load monitoring data.',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange, organizationId]);

    const renderOverviewStats = () => (
        <Grid templateColumns="repeat(4, 1fr)" gap={6}>
            <Stat>
                <StatLabel>Total Requests</StatLabel>
                <StatNumber>{metricsData?.total_requests}</StatNumber>
                <StatHelpText>
                    <StatArrow type="increase" />
                    23.36%
                </StatHelpText>
            </Stat>
            <Stat>
                <StatLabel>Block Rate</StatLabel>
                <StatNumber>
                    {metricsData?.actions?.block
                        ? ((metricsData.actions.block / metricsData.total_requests) * 100).toFixed(1)
                        : 0}
                    %
                </StatNumber>
            </Stat>
            <Stat>
                <StatLabel>Warning Rate</StatLabel>
                <StatNumber>
                    {metricsData?.actions?.warn
                        ? ((metricsData.actions.warn / metricsData.total_requests) * 100).toFixed(1)
                        : 0}
                    %
                </StatNumber>
            </Stat>
            <Stat>
                <StatLabel>Active Rules</StatLabel>
                <StatNumber>{ruleEffectiveness.length}</StatNumber>
            </Stat>
        </Grid>
    );

    const renderRequestTrends = () => (
        <Box h="400px">
            <Heading size="md" mb={4}>Request Trends</Heading>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData?.daily_requests}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#3182ce"
                        name="Requests"
                    />
                </LineChart>
            </ResponsiveContainer>
        </Box>
    );

    const renderCapabilityDistribution = () => (
        <Box h="400px">
            <Heading size="md" mb={4}>Capability Distribution</Heading>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={Object.entries(metricsData?.capabilities || {}).map(([capability, count]) => ({
                        capability,
                        count,
                    }))}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="capability" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#4299e1" name="Requests" />
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );

    const renderRuleEffectiveness = () => (
        <Box overflowX="auto">
            <Heading size="md" mb={4}>Rule Effectiveness</Heading>
            <Table variant="simple">
                <Thead>
                    <Tr>
                        <Th>Rule Name</Th>
                        <Th>Capability</Th>
                        <Th>Level</Th>
                        <Th isNumeric>Total</Th>
                        <Th isNumeric>Blocks</Th>
                        <Th isNumeric>Warnings</Th>
                        <Th isNumeric>Score</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {ruleEffectiveness.map((rule) => (
                        <Tr key={rule.rule_id}>
                            <Td>{rule.rule_name}</Td>
                            <Td>{rule.capability}</Td>
                            <Td>{rule.level}</Td>
                            <Td isNumeric>{rule.total_applications}</Td>
                            <Td isNumeric>{rule.blocks}</Td>
                            <Td isNumeric>{rule.warnings}</Td>
                            <Td isNumeric>{(rule.effectiveness_score * 100).toFixed(1)}%</Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </Box>
    );

    const renderAIPerformanceMetrics = () => (
        <Box>
            <Heading size="md" mb={4}>AI Performance Metrics</Heading>
            <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                <Stat>
                    <StatLabel>Prediction Accuracy</StatLabel>
                    <StatNumber>
                        {metricsData?.ai_performance.prediction_accuracy.toFixed(1)}%
                    </StatNumber>
                    <StatHelpText>
                        <Badge colorScheme={
                            metricsData?.ai_performance.prediction_accuracy >= 85 ? 'green' : 'yellow'
                        }>
                            {metricsData?.ai_performance.prediction_accuracy >= 85 ? 'Optimal' : 'Needs Review'}
                        </Badge>
                    </StatHelpText>
                </Stat>
                <Stat>
                    <StatLabel>Average Latency</StatLabel>
                    <StatNumber>
                        {metricsData?.ai_performance.average_latency.toFixed(2)}ms
                    </StatNumber>
                    <StatHelpText>
                        Model Version: {metricsData?.ai_performance.model_version}
                    </StatHelpText>
                </Stat>
            </Grid>
        </Box>
    );

    const renderSecurityMetrics = () => (
        <Box>
            <Heading size="md" mb={4}>Security & Compliance</Heading>
            <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                <Box>
                    <Table variant="simple" size="sm">
                        <Tbody>
                            <Tr>
                                <Td>Encryption Status</Td>
                                <Td>
                                    <Badge colorScheme={
                                        metricsData?.security_metrics.encryption_status === 'AES-256' ? 'green' : 'red'
                                    }>
                                        {metricsData?.security_metrics.encryption_status}
                                    </Badge>
                                </Td>
                            </Tr>
                            <Tr>
                                <Td>Unauthorized Attempts</Td>
                                <Td isNumeric>{metricsData?.security_metrics.unauthorized_attempts}</Td>
                            </Tr>
                            <Tr>
                                <Td>Audit Log Completeness</Td>
                                <Td isNumeric>{metricsData?.security_metrics.audit_log_completeness}%</Td>
                            </Tr>
                        </Tbody>
                    </Table>
                </Box>
                <Box>
                    <Heading size="sm" mb={2}>Compliance Status</Heading>
                    {Object.entries(metricsData?.security_metrics.compliance_status || {}).map(([standard, status]) => (
                        <Badge key={standard} colorScheme={status ? 'green' : 'red'} mr={2} mb={2}>
                            {standard}: {status ? 'Compliant' : 'Non-Compliant'}
                        </Badge>
                    ))}
                </Box>
            </Grid>
        </Box>
    );

    const renderAutomationMetrics = () => (
        <Box>
            <Heading size="md" mb={4}>Automation Effectiveness</Heading>
            <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                <Box h="200px">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={[
                                    { name: 'Automated', value: metricsData?.automation_metrics.automated_workflows },
                                    { name: 'Manual', value: metricsData?.automation_metrics.manual_workflows }
                                ]}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {COLORS.map((color, index) => (
                                    <Cell key={`cell-${index}`} fill={color} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </Box>
                <Box>
                    <Stat mb={4}>
                        <StatLabel>Efficiency Gain</StatLabel>
                        <StatNumber>
                            {metricsData?.automation_metrics.efficiency_gain.toFixed(1)}%
                        </StatNumber>
                        <StatHelpText>
                            <StatArrow type="increase" />
                            vs. Previous Period
                        </StatHelpText>
                    </Stat>
                    <Stat>
                        <StatLabel>Pending Automation Suggestions</StatLabel>
                        <StatNumber>
                            {metricsData?.automation_metrics.automation_suggestions}
                        </StatNumber>
                    </Stat>
                </Box>
            </Grid>
        </Box>
    );

    const renderIntegrationHealth = () => (
        <Box>
            <Heading size="md" mb={4}>Integration Health</Heading>
            <Table variant="simple" size="sm">
                <Thead>
                    <Tr>
                        <Th>Integration</Th>
                        <Th>Status</Th>
                        <Th isNumeric>Latency</Th>
                        <Th isNumeric>Success Rate</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {metricsData?.integration_health.map((integration) => (
                        <Tr key={integration.name}>
                            <Td>{integration.name}</Td>
                            <Td>
                                <Badge colorScheme={
                                    integration.status === 'healthy' ? 'green' :
                                    integration.status === 'degraded' ? 'yellow' : 'red'
                                }>
                                    {integration.status}
                                </Badge>
                            </Td>
                            <Td isNumeric>{integration.latency}ms</Td>
                            <Td isNumeric>{integration.success_rate}%</Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </Box>
    );

    return (
        <Box p={6}>
            <Box mb={6}>
                <Heading size="lg" mb={4}>AetherIQ Platform Monitoring</Heading>
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                    <Select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                    >
                        <option value="1h">Last Hour</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </Select>
                    <Select
                        value={organizationId}
                        onChange={(e) => setOrganizationId(e.target.value)}
                        placeholder="All Organizations"
                    >
                        {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                                {org.name}
                            </option>
                        ))}
                    </Select>
                </Grid>
            </Box>

            {loading ? (
                <Text>Loading metrics...</Text>
            ) : (
                <Tabs>
                    <TabList>
                        <Tab>Overview</Tab>
                        <Tab>AI Performance</Tab>
                        <Tab>Security</Tab>
                        <Tab>Automation</Tab>
                        <Tab>Integrations</Tab>
                    </TabList>

                    <TabPanels>
                        <TabPanel>
                            <Grid templateColumns="1fr" gap={8}>
                                {renderOverviewStats()}
                                {renderRequestTrends()}
                                <Grid templateColumns="repeat(2, 1fr)" gap={8}>
                                    {renderCapabilityDistribution()}
                                    {renderRuleEffectiveness()}
                                </Grid>
                            </Grid>
                        </TabPanel>
                        <TabPanel>
                            {renderAIPerformanceMetrics()}
                        </TabPanel>
                        <TabPanel>
                            {renderSecurityMetrics()}
                        </TabPanel>
                        <TabPanel>
                            {renderAutomationMetrics()}
                        </TabPanel>
                        <TabPanel>
                            {renderIntegrationHealth()}
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            )}
        </Box>
    );
}; 