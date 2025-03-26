import axios from 'axios';
import {
    EnforcementRule,
    EnforcementPolicy,
    RequestEvaluation,
    EvaluationResponse,
    AuditLog,
    AICapability,
    EnforcementLevel,
    EnforcementAction
} from '../types/enforcement';

const API_BASE = '/api/v1';

export const enforcementApi = {
    // Rules
    async createRule(rule: Omit<EnforcementRule, 'id' | 'created_at' | 'updated_at'>): Promise<EnforcementRule> {
        const response = await axios.post(`${API_BASE}/rules/`, rule);
        return response.data;
    },

    async getRule(ruleId: string): Promise<EnforcementRule> {
        const response = await axios.get(`${API_BASE}/rules/${ruleId}`);
        return response.data;
    },

    async updateRule(ruleId: string, rule: Partial<EnforcementRule>): Promise<EnforcementRule> {
        const response = await axios.put(`${API_BASE}/rules/${ruleId}`, rule);
        return response.data;
    },

    // Policies
    async createPolicy(policy: Omit<EnforcementPolicy, 'id' | 'created_at' | 'updated_at'> & { rule_ids: string[] }): Promise<EnforcementPolicy> {
        const response = await axios.post(`${API_BASE}/policies/`, policy);
        return response.data;
    },

    async getPolicy(policyId: string): Promise<EnforcementPolicy> {
        const response = await axios.get(`${API_BASE}/policies/${policyId}`);
        return response.data;
    },

    async updatePolicy(
        policyId: string,
        policy: Partial<EnforcementPolicy> & { rule_ids?: string[] }
    ): Promise<EnforcementPolicy> {
        const response = await axios.put(`${API_BASE}/policies/${policyId}`, policy);
        return response.data;
    },

    // Evaluation
    async evaluateRequest(request: RequestEvaluation): Promise<EvaluationResponse> {
        const response = await axios.post(`${API_BASE}/evaluate/`, request);
        return response.data;
    },

    // Audit Logs
    async getAuditLogs(params?: {
        user_id?: string;
        organization_id?: string;
        start_time?: string;
        end_time?: string;
        limit?: number;
    }): Promise<AuditLog[]> {
        const response = await axios.get(`${API_BASE}/audit-logs/`, { params });
        return response.data;
    },

    // Metadata
    async getCapabilities(): Promise<AICapability[]> {
        const response = await axios.get(`${API_BASE}/capabilities/`);
        return response.data;
    },

    async getEnforcementLevels(): Promise<EnforcementLevel[]> {
        const response = await axios.get(`${API_BASE}/enforcement-levels/`);
        return response.data;
    },

    async getEnforcementActions(): Promise<EnforcementAction[]> {
        const response = await axios.get(`${API_BASE}/enforcement-actions/`);
        return response.data;
    }
}; 