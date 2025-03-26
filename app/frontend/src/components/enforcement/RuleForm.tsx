import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Select,
    Textarea,
    VStack,
    HStack,
    IconButton,
    Text,
    useToast,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import {
    EnforcementRule,
    AICapability,
    EnforcementLevel,
    EnforcementAction,
    Condition
} from '../../types/enforcement';
import { enforcementApi } from '../../services/enforcement';

interface RuleFormProps {
    initialData?: Partial<EnforcementRule>;
    onSubmit: (rule: Omit<EnforcementRule, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export const RuleForm: React.FC<RuleFormProps> = ({ initialData, onSubmit }) => {
    const [capabilities, setCapabilities] = useState<AICapability[]>([]);
    const [levels, setLevels] = useState<EnforcementLevel[]>([]);
    const [actions, setActions] = useState<EnforcementAction[]>([]);
    const [formData, setFormData] = useState<Partial<EnforcementRule>>({
        name: '',
        description: '',
        capability: AICapability.NATURAL_LANGUAGE,
        level: EnforcementLevel.MODERATE,
        action: EnforcementAction.WARN,
        conditions: {},
        exceptions: [],
        is_active: true,
        ...initialData
    });
    const [conditions, setConditions] = useState<Array<{ key: string; condition: Condition }>>([]);
    const [exceptions, setExceptions] = useState<string[]>(initialData?.exceptions || []);
    const toast = useToast();

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const [caps, lvls, acts] = await Promise.all([
                    enforcementApi.getCapabilities(),
                    enforcementApi.getEnforcementLevels(),
                    enforcementApi.getEnforcementActions()
                ]);
                setCapabilities(caps);
                setLevels(lvls);
                setActions(acts);
            } catch (error) {
                toast({
                    title: 'Error loading form data',
                    description: 'Failed to load capabilities, levels, or actions.',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            }
        };
        loadMetadata();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleConditionChange = (index: number, field: string, value: string) => {
        const newConditions = [...conditions];
        if (field === 'key') {
            newConditions[index].key = value;
        } else if (field === 'operator') {
            newConditions[index].condition.operator = value as Condition['operator'];
        } else if (field === 'value') {
            newConditions[index].condition.value = value;
        }
        setConditions(newConditions);
        
        // Update formData.conditions
        const conditionsObject = newConditions.reduce((acc, { key, condition }) => {
            acc[key] = condition;
            return acc;
        }, {} as Record<string, Condition>);
        setFormData(prev => ({ ...prev, conditions: conditionsObject }));
    };

    const addCondition = () => {
        setConditions([
            ...conditions,
            {
                key: '',
                condition: { operator: 'equals', value: '' }
            }
        ]);
    };

    const removeCondition = (index: number) => {
        const newConditions = conditions.filter((_, i) => i !== index);
        setConditions(newConditions);
    };

    const handleExceptionChange = (index: number, value: string) => {
        const newExceptions = [...exceptions];
        newExceptions[index] = value;
        setExceptions(newExceptions);
        setFormData(prev => ({ ...prev, exceptions: newExceptions }));
    };

    const addException = () => {
        setExceptions([...exceptions, '']);
    };

    const removeException = (index: number) => {
        const newExceptions = exceptions.filter((_, i) => i !== index);
        setExceptions(newExceptions);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSubmit(formData as Omit<EnforcementRule, 'id' | 'created_at' | 'updated_at'>);
            toast({
                title: 'Success',
                description: 'Rule saved successfully.',
                status: 'success',
                duration: 5000,
                isClosable: true,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save rule.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    };

    return (
        <Box as="form" onSubmit={handleSubmit}>
            <VStack spacing={4} align="stretch">
                <FormControl isRequired>
                    <FormLabel>Name</FormLabel>
                    <Input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter rule name"
                    />
                </FormControl>

                <FormControl isRequired>
                    <FormLabel>Description</FormLabel>
                    <Textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Enter rule description"
                    />
                </FormControl>

                <FormControl isRequired>
                    <FormLabel>Capability</FormLabel>
                    <Select
                        name="capability"
                        value={formData.capability}
                        onChange={handleInputChange}
                    >
                        {capabilities.map(cap => (
                            <option key={cap} value={cap}>{cap}</option>
                        ))}
                    </Select>
                </FormControl>

                <FormControl isRequired>
                    <FormLabel>Enforcement Level</FormLabel>
                    <Select
                        name="level"
                        value={formData.level}
                        onChange={handleInputChange}
                    >
                        {levels.map(level => (
                            <option key={level} value={level}>{level}</option>
                        ))}
                    </Select>
                </FormControl>

                <FormControl isRequired>
                    <FormLabel>Action</FormLabel>
                    <Select
                        name="action"
                        value={formData.action}
                        onChange={handleInputChange}
                    >
                        {actions.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </Select>
                </FormControl>

                <Box>
                    <FormLabel>Conditions</FormLabel>
                    <VStack spacing={2} align="stretch">
                        {conditions.map((condition, index) => (
                            <HStack key={index}>
                                <Input
                                    placeholder="Key"
                                    value={condition.key}
                                    onChange={(e) => handleConditionChange(index, 'key', e.target.value)}
                                />
                                <Select
                                    value={condition.condition.operator}
                                    onChange={(e) => handleConditionChange(index, 'operator', e.target.value)}
                                >
                                    <option value="equals">Equals</option>
                                    <option value="contains">Contains</option>
                                    <option value="greater_than">Greater Than</option>
                                    <option value="less_than">Less Than</option>
                                    <option value="in">In</option>
                                </Select>
                                <Input
                                    placeholder="Value"
                                    value={condition.condition.value}
                                    onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                                />
                                <IconButton
                                    aria-label="Remove condition"
                                    icon={<DeleteIcon />}
                                    onClick={() => removeCondition(index)}
                                />
                            </HStack>
                        ))}
                        <Button leftIcon={<AddIcon />} onClick={addCondition}>
                            Add Condition
                        </Button>
                    </VStack>
                </Box>

                <Box>
                    <FormLabel>Exceptions</FormLabel>
                    <VStack spacing={2} align="stretch">
                        {exceptions.map((exception, index) => (
                            <HStack key={index}>
                                <Input
                                    placeholder="User ID"
                                    value={exception}
                                    onChange={(e) => handleExceptionChange(index, e.target.value)}
                                />
                                <IconButton
                                    aria-label="Remove exception"
                                    icon={<DeleteIcon />}
                                    onClick={() => removeException(index)}
                                />
                            </HStack>
                        ))}
                        <Button leftIcon={<AddIcon />} onClick={addException}>
                            Add Exception
                        </Button>
                    </VStack>
                </Box>

                <Button type="submit" colorScheme="blue">
                    Save Rule
                </Button>
            </VStack>
        </Box>
    );
}; 