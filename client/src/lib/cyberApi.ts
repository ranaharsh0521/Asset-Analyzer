/**
 * API Service for Cyber Attack Prediction System
 * Connects React frontend with Flask backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface NetworkTrafficData {
  duration: number;
  protocol_type: string;
  service: string;
  flag: string;
  src_bytes: number;
  dst_bytes: number;
  land: number;
  wrong_fragment: number;
  urgent: number;
  hot: number;
  num_failed_logins: number;
  logged_in: number;
  num_compromised: number;
  root_shell: number;
  su_attempted: number;
  num_root: number;
  num_file_creations: number;
  num_shells: number;
  num_access_files: number;
  is_guest_login: number;
  count: number;
  srv_count: number;
  serror_rate: number;
  srv_serror_rate: number;
  rerror_rate: number;
  srv_rerror_rate: number;
  same_srv_rate: number;
  diff_srv_rate: number;
  srv_diff_host_rate: number;
  dst_host_count: number;
  dst_host_srv_count: number;
  dst_host_same_srv_rate: number;
  dst_host_diff_srv_rate: number;
  dst_host_same_src_port_rate: number;
  dst_host_serror_rate: number;
  dst_host_srv_serror_rate: number;
  dst_host_rerror_rate: number;
  dst_host_srv_rerror_rate: number;
}

export interface PredictionResult {
  prediction: string;
  attack_type: string;
  threat_level: 'Low' | 'Medium' | 'High';
  confidence: number;
  timestamp: string;
  all_probabilities?: Record<string, number>;
}

export interface Alert {
  id: string;
  severity: 'Low' | 'Medium' | 'High';
  title: string;
  prediction: string;
  confidence: number;
  timestamp: string;
  data?: NetworkTrafficData;
  simulated?: boolean;
}

export interface Statistics {
  total_alerts: number;
  attack_types: Record<string, number>;
  threat_levels: Record<string, number>;
  timestamp: string;
}

class CyberAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<{ status: string; model_loaded: boolean }> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  async predict(data: NetworkTrafficData): Promise<PredictionResult> {
    const response = await fetch(`${this.baseUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Prediction failed');
    }
    
    return response.json();
  }

  async predictBatch(records: NetworkTrafficData[]): Promise<{ predictions: PredictionResult[] }> {
    const response = await fetch(`${this.baseUrl}/predict/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    
    if (!response.ok) {
      throw new Error('Batch prediction failed');
    }
    
    return response.json();
  }

  async getAlerts(severity?: string, limit: number = 50): Promise<{ alerts: Alert[]; count: number }> {
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    params.append('limit', limit.toString());
    
    const response = await fetch(`${this.baseUrl}/alerts?${params}`);
    return response.json();
  }

  async deleteAlert(alertId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/alerts/${alertId}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async getStatistics(): Promise<Statistics> {
    const response = await fetch(`${this.baseUrl}/statistics`);
    return response.json();
  }

  async simulateAttack(attackType?: string, count: number = 1): Promise<{ simulations: PredictionResult[] }> {
    const response = await fetch(`${this.baseUrl}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attack_type: attackType, count }),
    });
    
    if (!response.ok) {
      throw new Error('Simulation failed');
    }
    
    return response.json();
  }

  async uploadLog(file: File): Promise<{ filename: string; records: number; analysis: Record<string, unknown> }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${this.baseUrl}/upload-log`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('File upload failed');
    }
    
    return response.json();
  }
}

export const cyberAPI = new CyberAPI();

export function generateSampleTraffic(type: 'normal' | 'ddos' | 'probe' | 'r2l' | 'u2r'): NetworkTrafficData {
  const base: NetworkTrafficData = {
    duration: 0,
    protocol_type: 'tcp',
    service: 'http',
    flag: 'SF',
    src_bytes: 200,
    dst_bytes: 1000,
    land: 0,
    wrong_fragment: 0,
    urgent: 0,
    hot: 0,
    num_failed_logins: 0,
    logged_in: 0,
    num_compromised: 0,
    root_shell: 0,
    su_attempted: 0,
    num_root: 0,
    num_file_creations: 0,
    num_shells: 0,
    num_access_files: 0,
    is_guest_login: 0,
    count: 10,
    srv_count: 10,
    serror_rate: 0,
    srv_serror_rate: 0,
    rerror_rate: 0,
    srv_rerror_rate: 0,
    same_srv_rate: 0.5,
    diff_srv_rate: 0.1,
    srv_diff_host_rate: 0.1,
    dst_host_count: 50,
    dst_host_srv_count: 50,
    dst_host_same_srv_rate: 0.5,
    dst_host_diff_srv_rate: 0.1,
    dst_host_same_src_port_rate: 0.5,
    dst_host_serror_rate: 0,
    dst_host_srv_serror_rate: 0,
    dst_host_rerror_rate: 0,
    dst_host_srv_rerror_rate: 0,
  };

  switch (type) {
    case 'ddos':
      return { ...base, duration: 1000, count: 500, srv_count: 500, serror_rate: 1.0, dst_host_count: 255 };
    case 'probe':
      return { ...base, duration: 100, count: 50, srv_count: 20, serror_rate: 0.5, diff_srv_rate: 0.8 };
    case 'r2l':
      return { ...base, duration: 50, num_failed_logins: 5, logged_in: 1 };
    case 'u2r':
      return { ...base, duration: 10, num_compromised: 1, root_shell: 1, su_attempted: 1 };
    default:
      return base;
  }
}