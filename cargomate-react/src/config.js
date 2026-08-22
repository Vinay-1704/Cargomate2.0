// Centralized API Configuration supporting Vercel environment variables
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
export const BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:3000';
