import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

export interface SecurityAlert {
  id: number;
  type: 'compliance' | 'anomaly' | 'threat';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  timestamp: string;
  status: 'active' | 'resolved';
  affected_workflows: number[];
}

export const fetchSecurityAlerts = async (): Promise<SecurityAlert[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/security/alerts`);
    return response.data;
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    throw error;
  }
}; 