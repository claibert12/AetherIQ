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
    Checkbox,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    useToast,
} from '@chakra-ui/react';
import {
    EnforcementPolicy,
    EnforcementRule,
    EnforcementAction
} from '../../types/enforcement';
import { enforcementApi } from '../../services/enforcement';

interface PolicyFormProps {
    initialData?: Partial<EnforcementPolicy>;
    onSubmit: (policy: Omit<EnforcementPolicy, 'id' | 'created_at' | 'updated_at'> & { rule_ids: string[] }) => Promise<void>;
}

export const PolicyForm: React.FC<PolicyFormProps> = ({ initialData, onSubmit }) => {
    const [formData, setFormData] = useState<Partial<EnforcementPolicy>>({
        name: '',
        description: '',
        default_action: EnforcementAction.BLOCK,
        rules: [],
        is_active: true,
        ...initialData
    });
    const [availableRules, setAvailableRules] = useState<EnforcementRule[]>([]);
    const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
        new Set(initialData?.rules?.map(rule => rule.id) || [])
    );
    const [actions, setActions] = useState<EnforcementAction[]>([]);
    const toast = useToast();

    useEffect(() => {
        const loadData = async () => {
            try {
                // In a real application, you would have an API endpoint to get all rules
                // For now, we'll simulate it with some example rules
                const rules = [
                    {
                        id: '1',
                        name: 'Example Rule 1',
                        description: 'An example rule',
                        capability: 'natural_language',
                        level: 'moderate',
                        action: 'warn',
                        conditions: {},
                        exceptions: [],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_active: true
                    },
                    // Add more example rules as needed
                ];
                setAvailableRules(rules);

                const acts = await enforcementApi.getEnforcementActions();
                setActions(acts);
            } catch (error) {
                toast({
                    title: 'Error loading form data',
                    description: 'Failed to load rules or actions.',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            }
        };
        loadData();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRuleToggle = (ruleId: string) => {
        const newSelectedRuleIds = new Set(selectedRuleIds);
        if (newSelectedRuleIds.has(ruleId)) {
            newSelectedRuleIds.delete(ruleId);
        } else {
            newSelectedRuleIds.add(ruleId);
        }
        setSelectedRuleIds(newSelectedRuleIds);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const selectedRules = availableRules.filter(rule => selectedRuleIds.has(rule.id));
            const submitData = {
                ...formData,
                rules: selectedRules,
                rule_ids: Array.from(selectedRuleIds)
            };
            await onSubmit(submitData as Omit<EnforcementPolicy, 'id' | 'created_at' | 'updated_at'> & { rule_ids: string[] });
            toast({
                title: 'Success',
                description: 'Policy saved successfully.',
                status: 'success',
                duration: 5000,
                isClosable: true,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save policy.',
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
                        placeholder="Enter policy name"
                    />
                </FormControl>

                <FormControl isRequired>
                    <FormLabel>Description</FormLabel>
                    <Textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Enter policy description"
                    />
                </FormControl>

                <FormControl isRequired>
                    <FormLabel>Default Action</FormLabel>
                    <Select
                        name="default_action"
                        value={formData.default_action}
                        onChange={handleInputChange}
                    >
                        {actions.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </Select>
                </FormControl>

                <FormControl>
                    <FormLabel>Rules</FormLabel>
                    <Table variant="simple">
                        <Thead>
                            <Tr>
                                <Th>Select</Th>
                                <Th>Name</Th>
                                <Th>Description</Th>
                                <Th>Capability</Th>
                                <Th>Level</Th>
                                <Th>Action</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {availableRules.map(rule => (
                                <Tr key={rule.id}>
                                    <Td>
                                        <Checkbox
                                            isChecked={selectedRuleIds.has(rule.id)}
                                            onChange={() => handleRuleToggle(rule.id)}
                                        />
                                    </Td>
                                    <Td>{rule.name}</Td>
                                    <Td>{rule.description}</Td>
                                    <Td>{rule.capability}</Td>
                                    <Td>{rule.level}</Td>
                                    <Td>{rule.action}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </FormControl>

                <Button type="submit" colorScheme="blue">
                    Save Policy
                </Button>
            </VStack>
        </Box>
    );
}; 