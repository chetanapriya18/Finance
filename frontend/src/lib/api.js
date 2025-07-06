const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  async updateProfile(userData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  // Transaction endpoints
  async getTransactions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/transactions?${queryString}`);
  }

  async getTransaction(id) {
    return this.request(`/transactions/${id}`);
  }

  async createTransaction(transactionData) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async updateTransaction(id, transactionData) {
    return this.request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transactionData),
    });
  }

  async deleteTransaction(id) {
    return this.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  async getCategories(type) {
    return this.request(`/transactions/categories/${type}`);
  }

  // Analytics endpoints
  async getExpensesByCategory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/expenses-by-category?${queryString}`);
  }

  async getIncomeByCategory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/income-by-category?${queryString}`);
  }

  async getTransactionsByDate(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/transactions-by-date?${queryString}`);
  }

  async getSummary(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/summary?${queryString}`);
  }

  // Receipt endpoints
  async uploadReceiptImage(file) {
    const formData = new FormData();
    formData.append('receipt', file);

    return this.request('/receipts/upload-image', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });
  }

  async uploadReceiptPDF(file) {
    const formData = new FormData();
    formData.append('receipt', file);

    return this.request('/receipts/upload-pdf', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });
  }

  async createTransactionFromReceipt(transactionData) {
    return this.request('/receipts/create-transaction', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async bulkCreateTransactions(transactions) {
    return this.request('/receipts/bulk-create-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    });
  }
}

export const apiClient = new ApiClient();

