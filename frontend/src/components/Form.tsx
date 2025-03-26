import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  IconButton,
  Tooltip,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Help as HelpIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

interface Field {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox' | 'textarea';
  defaultValue?: any;
  required?: boolean;
  validation?: yup.StringSchema | yup.NumberSchema | yup.BooleanSchema;
  options?: { label: string; value: any }[];
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  fullWidth?: boolean;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

interface DynamicField extends Field {
  isDynamic?: boolean;
  minItems?: number;
  maxItems?: number;
  itemLabel?: string;
}

interface FormProps {
  title?: string;
  fields: DynamicField[];
  onSubmit: (data: any) => void;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
  error?: string;
  success?: string;
  schema?: yup.ObjectSchema<any>;
  defaultValues?: Record<string, any>;
}

const Form: React.FC<FormProps> = ({
  title,
  fields,
  onSubmit,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  onCancel,
  loading = false,
  error,
  success,
  schema,
  defaultValues = {},
}) => {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    resolver: schema ? yupResolver(schema) : undefined,
    defaultValues: {
      ...defaultValues,
      ...fields.reduce((acc, field) => {
        if (field.defaultValue !== undefined) {
          acc[field.name] = field.defaultValue;
        }
        return acc;
      }, {} as Record<string, any>),
    },
  });

  const dynamicFields = fields.filter((field) => field.isDynamic);
  const fieldArrays = dynamicFields.reduce((acc, field) => {
    acc[field.name] = useFieldArray({
      control,
      name: field.name,
      rules: {
        minLength: field.minItems,
        maxLength: field.maxItems,
      },
    });
    return acc;
  }, {} as Record<string, any>);

  useEffect(() => {
    if (success) {
      reset();
    }
  }, [success, reset]);

  const handleAddItem = (fieldName: string) => {
    const fieldArray = fieldArrays[fieldName];
    if (fieldArray) {
      fieldArray.append({});
    }
  };

  const handleRemoveItem = (fieldName: string, index: number) => {
    const fieldArray = fieldArrays[fieldName];
    if (fieldArray) {
      fieldArray.remove(index);
    }
  };

  const renderField = (field: Field, index?: number) => {
    const fieldError = errors[field.name];
    const value = watch(field.name);

    const commonProps = {
      fullWidth: field.fullWidth ?? true,
      error: !!fieldError,
      helperText: fieldError?.message || field.helperText,
      disabled: loading || field.disabled,
      placeholder: field.placeholder,
      InputProps: {
        startAdornment: field.startAdornment,
        endAdornment: field.endAdornment,
      },
    };

    switch (field.type) {
      case 'select':
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            render={({ field: { onChange, value } }) => (
              <FormControl
                {...commonProps}
                error={!!fieldError}
                fullWidth={field.fullWidth ?? true}
              >
                <InputLabel>{field.label}</InputLabel>
                <Select
                  value={value || ''}
                  onChange={onChange}
                  label={field.label}
                >
                  {field.options?.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                {fieldError && (
                  <FormHelperText error>{fieldError.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        );

      case 'checkbox':
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            render={({ field: { onChange, value } }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={value || false}
                    onChange={onChange}
                    disabled={loading || field.disabled}
                  />
                }
                label={field.label}
              />
            )}
          />
        );

      case 'password':
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            render={({ field: { onChange, value } }) => (
              <TextField
                {...commonProps}
                type={showPassword[field.name] ? 'text' : 'password'}
                label={field.label}
                value={value || ''}
                onChange={onChange}
                InputProps={{
                  ...commonProps.InputProps,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            [field.name]: !prev[field.name],
                          }))
                        }
                      >
                        {showPassword[field.name] ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
        );

      case 'textarea':
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            render={({ field: { onChange, value } }) => (
              <TextField
                {...commonProps}
                multiline
                rows={field.rows || 4}
                label={field.label}
                value={value || ''}
                onChange={onChange}
              />
            )}
          />
        );

      default:
        return (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            render={({ field: { onChange, value } }) => (
              <TextField
                {...commonProps}
                type={field.type}
                label={field.label}
                value={value || ''}
                onChange={onChange}
              />
            )}
          />
        );
    }
  };

  const renderDynamicField = (field: DynamicField) => {
    const fieldArray = fieldArrays[field.name];
    if (!fieldArray) return null;

    return (
      <Box key={field.name} sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="subtitle1">{field.label}</Typography>
          <Tooltip title={`Add ${field.itemLabel || 'item'}`}>
            <IconButton
              onClick={() => handleAddItem(field.name)}
              disabled={loading || (field.maxItems && fieldArray.fields.length >= field.maxItems)}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <AnimatePresence>
          {fieldArray.fields.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    {field.options?.map((option) => renderField(option, index))}
                  </Box>
                  <IconButton
                    onClick={() => handleRemoveItem(field.name, index)}
                    disabled={loading || (field.minItems && fieldArray.fields.length <= field.minItems)}
                  >
                    <RemoveIcon />
                  </IconButton>
                </Box>
              </Paper>
            </motion.div>
          ))}
        </AnimatePresence>
      </Box>
    );
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
          p: 3,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        {title && (
          <Typography variant="h6" sx={{ mb: 3 }}>
            {title}
          </Typography>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {fields.map((field) => (
              <Grid
                item
                key={field.name}
                xs={field.xs || 12}
                sm={field.sm || 12}
                md={field.md || 12}
                lg={field.lg || 12}
                xl={field.xl || 12}
              >
                {field.isDynamic ? renderDynamicField(field) : renderField(field)}
              </Grid>
            ))}
          </Grid>

          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          </Collapse>

          <Collapse in={!!success}>
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          </Collapse>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 2,
              mt: 3,
            }}
          >
            {onCancel && (
              <Button
                variant="outlined"
                onClick={onCancel}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading && <CircularProgress size={20} />}
            >
              {submitLabel}
            </Button>
          </Box>
        </form>
      </Paper>
    </motion.div>
  );
};

export default Form; 