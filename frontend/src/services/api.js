import axios from 'axios';

const isCapacitor = (window.location.hostname === 'localhost' && !window.location.port) || 
                    window.location.protocol === 'capacitor:' || 
                    window.location.hostname === 'capacitor';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const customApi = localStorage.getItem('custom_api_url');
  if (customApi) {
    return customApi.replace(/\/+$/, '');
  }
  const savedIP = localStorage.getItem('server_ip');
  if (savedIP) {
    return `http://${savedIP}:8000/api`;
  }
  if (isCapacitor) {
    return `http://${savedIP || '192.168.1.15'}:8000/api`;
  }
  if (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('vercel.app') || window.location.hostname.includes('modi.app')) {
    return 'https://ganesh-traders-backend.onrender.com/api';
  }
  return `http://${window.location.hostname}:8000/api`;
};

const api = axios.create({
  baseURL: getApiUrl(),
});

// Automatically inject JWT Token and update baseURL dynamically if changed
api.interceptors.request.use((config) => {
  config.baseURL = getApiUrl();
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Automatically logout user on 401 Unauthorized responses (e.g. deleted/deactivated)
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401 && !error.config?.url?.includes('/auth/login')) {
    localStorage.removeItem('token');
    window.location.reload();
  }
  return Promise.reject(error);
});

export const authAPI = {
  checkHealth: async () => {
    try {
      const res = await api.get('/health', { timeout: 5000 });
      return res.data;
    } catch (e) {
      return null;
    }
  },
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/auth/login', formData, { timeout: 15000 });
    return response.data; // returns { access_token, token_type }
  },
  register: async (username, password, role = 'Staff') => {
    const response = await api.post('/auth/register', { username, password, role });
    return response.data;
  },
  getUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },
  deleteUser: async (id) => {
    const response = await api.delete(`/auth/users/${id}`);
    return response.data;
  },
  updateUser: async (id, userData) => {
    const response = await api.put(`/auth/users/${id}`, userData);
    return response.data;
  }
};

export const customerAPI = {
  getCustomers: async (search = '', type = '', payment = '') => {
    const params = {};
    if (search) params.search = search;
    if (type) params.customer_type = type;
    if (payment) params.payment_type = payment;
    const response = await api.get('/customers/', { params });
    return response.data;
  },
  createCustomer: async (customerData) => {
    const response = await api.post('/customers/', customerData);
    return response.data;
  },
  getCustomer: async (id) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },
  updateCustomer: async (id, customerData) => {
    const response = await api.put(`/customers/${id}`, customerData);
    return response.data;
  },
  deleteCustomer: async (id) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },
  importPreview: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/customers/import-preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  importConfirm: async (rows) => {
    const response = await api.post('/customers/import-confirm', rows);
    return response.data;
  },
  getLedger: async (id) => {
    const response = await api.get(`/customers/${id}/ledger`);
    return response.data;
  },
  getPortalProfile: async () => {
    const response = await api.get('/customers/portal/profile');
    return response.data;
  },
  getLiveUpdates: async () => {
    const response = await api.get('/customers/live-updates/all');
    return response.data;
  },
  addLiveUpdate: async (data) => {
    const response = await api.post('/customers/live-updates/add', data);
    return response.data;
  },
  deleteLiveUpdate: async (id) => {
    const response = await api.delete(`/customers/live-updates/${id}`);
    return response.data;
  }
};

export const productAPI = {
  getCategories: async () => {
    const response = await api.get('/products/categories');
    return response.data;
  },
  createCategory: async (name) => {
    const response = await api.post('/products/categories', { name });
    return response.data;
  },
  getProducts: async (search = '', categoryId = '') => {
    const params = {};
    if (search) params.search = search;
    if (categoryId) params.category_id = categoryId;
    const response = await api.get('/products/', { params });
    return response.data;
  },
  createProduct: async (productData) => {
    const response = await api.post('/products/', productData);
    return response.data;
  },
  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },
  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
  lookupBarcode: async (barcode) => {
    const response = await api.get(`/products/lookup-barcode/${encodeURIComponent(barcode)}`);
    return response.data;
  },
  getBatchBarcodes: async (productIds) => {
    const response = await api.post('/products/batch-barcodes', productIds);
    return response.data;
  }
};

export const billAPI = {
  calculate: async (payload) => {
    const response = await api.post('/bills/calculate', payload);
    return response.data;
  },
  finalize: async (payload) => {
    const response = await api.post('/bills/finalize', payload);
    return response.data;
  },
  getBills: async (customerId = '', financialYear = '') => {
    const params = {};
    if (customerId) params.customer_id = customerId;
    if (financialYear) params.financial_year = financialYear;
    const response = await api.get('/bills/', { params });
    return response.data;
  },
  getBill: async (id) => {
    const response = await api.get(`/bills/${id}`);
    return response.data;
  },
  voidBill: async (id, reason = '') => {
    const response = await api.post(`/bills/${id}/void`, null, {
      params: { reason }
    });
    return response.data;
  },
  deleteBill: async (id) => {
    const response = await api.delete(`/bills/${id}`);
    return response.data;
  }
};

export const transactionAPI = {
  createSale: async (saleData) => {
    const response = await api.post('/transactions/sales', saleData);
    return response.data;
  },
  receivePayment: async (paymentData) => {
    const response = await api.post('/transactions/payments', paymentData);
    return response.data;
  },
  getSales: async (customerId = '') => {
    const params = {};
    if (customerId) params.customer_id = customerId;
    const response = await api.get('/transactions/sales', { params });
    return response.data;
  },
  getPayments: async (customerId = '') => {
    const params = {};
    if (customerId) params.customer_id = customerId;
    const response = await api.get('/transactions/payments', { params });
    return response.data;
  },
  cancelSale: async (id, reason = '') => {
    const response = await api.post(`/transactions/sales/${id}/cancel`, null, {
      params: { cancelled_reason: reason }
    });
    return response.data;
  },
  deleteSale: async (id) => {
    const response = await api.delete(`/transactions/sales/${id}`);
    return response.data;
  },
  updateSale: async (id, saleData) => {
    const response = await api.put(`/transactions/sales/${id}`, saleData);
    return response.data;
  },
  cancelPayment: async (id) => {
    const response = await api.post(`/transactions/payments/${id}/cancel`);
    return response.data;
  },
  deletePayment: async (id) => {
    const response = await api.delete(`/transactions/payments/${id}`);
    return response.data;
  },
  updatePayment: async (id, paymentData) => {
    const response = await api.put(`/transactions/payments/${id}`, paymentData);
    return response.data;
  },
  createExpense: async (expenseData) => {
    const response = await api.post('/transactions/expenses', expenseData);
    return response.data;
  },
  getExpenses: async () => {
    const response = await api.get('/transactions/expenses');
    return response.data;
  },
  deleteExpense: async (id) => {
    const response = await api.delete(`/transactions/expenses/${id}`);
    return response.data;
  },
  updateExpense: async (id, expenseData) => {
    const response = await api.put(`/transactions/expenses/${id}`, expenseData);
    return response.data;
  }
};

export const cerealAPI = {
  createTransaction: async (txData) => {
    const response = await api.post('/transactions/cereals', txData);
    return response.data;
  },
  updateTransaction: async (id, txData) => {
    const response = await api.put(`/transactions/cereals/${id}`, txData);
    return response.data;
  },
  getTransactions: async () => {
    const response = await api.get('/transactions/cereals');
    return response.data;
  }
};

export const backupAPI = {
  downloadBackup: async () => {
    const response = await api.get('/backup/export', { responseType: 'blob' });
    return response.data;
  }
};

export default api;
