import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';

interface DataVisualizationProps {
  title: string;
  data: any[];
  type: 'line' | 'bar' | 'pie';
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  width?: number;
  onRefresh?: () => void;
  onDownload?: () => void;
  onFullscreen?: () => void;
  onSettings?: () => void;
  tooltipFormatter?: (value: any) => string;
  customColors?: string[];
}

const DataVisualization: React.FC<DataVisualizationProps> = ({
  title,
  data,
  type,
  xKey,
  yKey,
  color = '#1976d2',
  height = 300,
  width = '100%',
  onRefresh,
  onDownload,
  onFullscreen,
  onSettings,
  tooltipFormatter,
  customColors,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const chartColors = useMemo(() => {
    if (customColors) return customColors;
    return [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.error.main,
      theme.palette.warning.main,
      theme.palette.info.main,
      theme.palette.success.main,
    ];
  }, [theme, customColors]);

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <ChartTooltip formatter={tooltipFormatter} />
            <Legend />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <ChartTooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey={yKey} fill={color} />
          </BarChart>
        );
      case 'pie':
        return (
          <PieChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <ChartTooltip formatter={tooltipFormatter} />
            <Legend />
          </PieChart>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          height,
          width,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
          <Box>
            <Tooltip title="More options">
              <IconButton
                size="small"
                onClick={handleMenuClick}
                sx={{
                  color: 'action.active',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              {onRefresh && (
                <MenuItem onClick={() => { handleMenuClose(); onRefresh(); }}>
                  <ListItemIcon>
                    <RefreshIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Refresh</ListItemText>
                </MenuItem>
              )}
              {onDownload && (
                <MenuItem onClick={() => { handleMenuClose(); onDownload(); }}>
                  <ListItemIcon>
                    <DownloadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Download</ListItemText>
                </MenuItem>
              )}
              {onFullscreen && (
                <MenuItem onClick={() => { handleMenuClose(); onFullscreen(); }}>
                  <ListItemIcon>
                    <FullscreenIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Fullscreen</ListItemText>
                </MenuItem>
              )}
              {onSettings && (
                <MenuItem onClick={() => { handleMenuClose(); onSettings(); }}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Settings</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>

        <Box sx={{ height: 'calc(100% - 48px)' }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </Box>
      </Paper>
    </motion.div>
  );
};

export default DataVisualization; 