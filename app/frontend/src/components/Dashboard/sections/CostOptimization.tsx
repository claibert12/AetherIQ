import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../../utils/formatters';
import { fetchWorkflowMetrics } from '../../../api/workflow';
import { DASHBOARD_CONFIG, CHART_CONFIG } from '../../../config';

interface CostData {
  date: string;
  actual: number;
  projected: number;
}

const sampleCostData: CostData[] = [
  { date: 'Jan', actual: 4000, projected: 4500 },
  { date: 'Feb', actual: 3500, projected: 4300 },
  { date: 'Mar', actual: 4200, projected: 4800 },
  { date: 'Apr', actual: 3800, projected: 4600 },
  { date: 'May', actual: 4300, projected: 5000 },
  { date: 'Jun', actual: 3900, projected: 4700 },
];

interface SavingsData {
  category: string;
  amount: number;
}

const sampleSavingsData: SavingsData[] = [
  { category: 'Workflow Optimization', amount: 2500 },
  { category: 'Resource Allocation', amount: 1800 },
  { category: 'Caching Improvements', amount: 1200 },
  { category: 'Scheduled Scaling', amount: 900 },
];

const CostOptimization: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30d');

  // This would be a real API call in production
  const { isLoading, error } = useQuery(['costMetrics', timeRange], 
    () => fetchWorkflowMetrics(timeRange), 
    { enabled: false }
  );

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
          <Alert severity="error">Failed to load cost optimization data</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Cost Optimization</Typography>
          <FormControl size="small" sx={{ width: 120 }}>
            <InputLabel id="cost-time-range-label">Time Range</InputLabel>
            <Select
              labelId="cost-time-range-label"
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value as string)}
            >
              {Object.entries(DASHBOARD_CONFIG.timeRanges).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Typography variant="subtitle1" gutterBottom>Cost Trend</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sampleCostData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual Cost"
                  stroke={CHART_CONFIG.colors.primary}
                  activeDot={{ r: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Projected Cost"
                  stroke={CHART_CONFIG.colors.secondary}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>Potential Savings</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sampleSavingsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                <YAxis dataKey="category" type="category" width={150} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="amount" name="Potential Savings" fill={CHART_CONFIG.colors.success} />
              </BarChart>
            </ResponsiveContainer>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle1">Total Monthly Savings</Typography>
                <Typography variant="h4" color="success.main">{formatCurrency(6400)}</Typography>
              </Box>
              <Button variant="contained" color="primary">Apply Recommendations</Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default CostOptimization; 