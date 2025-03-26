import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  useTheme,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  FilterList as FilterListIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface Column<T> {
  id: keyof T;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any) => string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
}

interface DataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  rows: T[];
  defaultSortBy?: keyof T;
  defaultSortOrder?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  onDownload?: () => void;
  onSettings?: () => void;
  onFilterChange?: (filters: Record<keyof T, string>) => void;
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  height?: number;
  width?: number;
}

function DataTable<T extends { id: string | number }>({
  title,
  columns,
  rows,
  defaultSortBy,
  defaultSortOrder = 'asc',
  onRowClick,
  onDownload,
  onSettings,
  onFilterChange,
  selectable = false,
  onSelectionChange,
  height = 400,
  width = '100%',
}: DataTableProps<T>) {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState<keyof T | undefined>(defaultSortBy);
  const [order, setOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [selected, setSelected] = useState<T[]>([]);
  const [filters, setFilters] = useState<Record<keyof T, string>>({} as Record<keyof T, string>);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleRequestSort = (property: keyof T) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (columnId: keyof T, value: string) => {
    const newFilters = { ...filters, [columnId]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(rows);
      onSelectionChange?.(rows);
    } else {
      setSelected([]);
      onSelectionChange?.([]);
    }
  };

  const handleClick = (row: T) => {
    if (selectable) {
      const selectedIndex = selected.findIndex((item) => item.id === row.id);
      let newSelected: T[] = [];

      if (selectedIndex === -1) {
        newSelected = newSelected.concat(selected, row);
      } else if (selectedIndex === 0) {
        newSelected = newSelected.concat(selected.slice(1));
      } else if (selectedIndex === selected.length - 1) {
        newSelected = newSelected.concat(selected.slice(0, -1));
      } else if (selectedIndex > 0) {
        newSelected = newSelected.concat(
          selected.slice(0, selectedIndex),
          selected.slice(selectedIndex + 1)
        );
      }

      setSelected(newSelected);
      onSelectionChange?.(newSelected);
    } else {
      onRowClick?.(row);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const filteredAndSortedRows = useMemo(() => {
    let filteredRows = rows.filter((row) =>
      Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const cellValue = row[key as keyof T];
        return String(cellValue).toLowerCase().includes(value.toLowerCase());
      })
    );

    if (orderBy) {
      filteredRows.sort((a, b) => {
        const aValue = a[orderBy];
        const bValue = b[orderBy];

        if (aValue === bValue) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        const comparison = String(aValue).localeCompare(String(bValue));
        return order === 'asc' ? comparison : -comparison;
      });
    }

    return filteredRows;
  }, [rows, filters, orderBy, order]);

  const paginatedRows = useMemo(() => {
    return filteredAndSortedRows.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredAndSortedRows, page, rowsPerPage]);

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
          {title && <Typography variant="h6">{title}</Typography>}
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
              {onDownload && (
                <MenuItem onClick={() => { handleMenuClose(); onDownload(); }}>
                  <ListItemIcon>
                    <DownloadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Download</ListItemText>
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

        <Box sx={{ mb: 2 }}>
          {columns
            .filter((column) => column.filterable !== false)
            .map((column) => (
              <TextField
                key={String(column.id)}
                size="small"
                placeholder={`Filter ${column.label}`}
                value={filters[column.id] || ''}
                onChange={(e) => handleFilterChange(column.id, e.target.value)}
                sx={{ mr: 1, mb: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: filters[column.id] && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => handleFilterChange(column.id, '')}
                      >
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            ))}
        </Box>

        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {selectable && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < rows.length}
                      checked={rows.length > 0 && selected.length === rows.length}
                      onChange={handleSelectAllClick}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={String(column.id)}
                    align={column.align}
                    style={{ minWidth: column.minWidth }}
                  >
                    {column.sortable !== false ? (
                      <TableSortLabel
                        active={orderBy === column.id}
                        direction={orderBy === column.id ? order : 'asc'}
                        onClick={() => handleRequestSort(column.id)}
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {paginatedRows.map((row) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.some((item) => item.id === row.id)}
                          onChange={() => handleClick(row)}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={String(column.id)}
                        align={column.align}
                        onClick={() => !selectable && handleClick(row)}
                        sx={{
                          cursor: !selectable ? 'pointer' : 'default',
                          '&:hover': !selectable && {
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        {column.render
                          ? column.render(row)
                          : column.format
                          ? column.format(row[column.id])
                          : row[column.id]}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredAndSortedRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </motion.div>
  );
}

export default DataTable; 