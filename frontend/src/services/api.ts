import axios from 'axios';

const API_BASE = '/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth API ──────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: string;
  user: {
    id: string;
    email: string;
    roles: string[];
  };
}

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/auth/register', data),
  profile: () => api.get('/auth/profile'),
  validate: () => api.get('/auth/validate'),
};

// ── Order API ─────────────────────────────────────────────
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const orderApi = {
  create: (data: { customerId: string; items: OrderItem[] }) =>
    api.post<{ success: boolean; data: Order }>('/orders', data),
  list: () => api.get<{ success: boolean; data: Order[] }>('/orders'),
  getById: (id: string) =>
    api.get<{ success: boolean; data: Order }>(`/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status, changedBy: 'system' }),
};

// ── System/Health API ─────────────────────────────────────
export interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    postgres: string;
    mongodb: string;
    redis: string;
    pulsar: string;
    temporal: string;
  };
}

export const systemApi = {
  health: () => api.get<HealthStatus>('/health'),
  events: () => api.get('/events/recent'),
};

export { api };
export default api;
