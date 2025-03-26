import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { useWorkflowData } from '../../../hooks/useWorkflowData';
import { DASHBOARD_CONFIG, CHART_CONFIG, PERFORMANCE_THRESHOLDS } from '../../../config';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const WorkflowPerformance: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const { metrics, isLoading, error } = useWorkflowData({ timeRange });

  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">Failed to load workflow performance data</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  // Transform metrics data for the chart
  const chartData = metrics.map((metric) => ({
    timestamp: new Date(metric.timestamp).toLocaleTimeString(),
    executionTime: metric.executionTime,
    cpuUsage: metric.cpuUsage,
    memoryUsage: metric.memoryUsage,
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Workflow Performance
        </Typography>
        <FormControl size="small" sx={{ width: 120 }}>
          <InputLabel id="time-range-select-label">Time Range</InputLabel>
          <Select
            labelId="time-range-select-label"
            id="time-range-select"
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            {Object.entries(DASHBOARD_CONFIG.timeRanges).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="executionTime"
            name="Execution Time (ms)"
            stroke={CHART_CONFIG.colors.primary}
            dot={false}
            activeDot={{ r: 8 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cpuUsage"
            name="CPU Usage (%)"
            stroke={CHART_CONFIG.colors.secondary}
            dot={false}
            activeDot={{ r: 8 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="memoryUsage"
            name="Memory Usage (%)"
            stroke={CHART_CONFIG.colors.success}
            dot={false}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default WorkflowPerformance; 