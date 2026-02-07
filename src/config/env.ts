/**
 * Environment configuration
 * All environment variables must be prefixed with VITE_ to be accessible in the client
 */

export const env = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,

  // Authentication
  authTokenKey: import.meta.env.VITE_AUTH_TOKEN_KEY || 'offshore_crm_auth_token',
  refreshTokenKey: import.meta.env.VITE_REFRESH_TOKEN_KEY || 'offshore_crm_refresh_token',

  // Application Settings
  appName: import.meta.env.VITE_APP_NAME || 'Offshore CRM',
  appEnv: import.meta.env.VITE_APP_ENV || 'development',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',

  // External Services
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  slackClientId: import.meta.env.VITE_SLACK_CLIENT_ID || '',
  emailServiceApiKey: import.meta.env.VITE_EMAIL_SERVICE_API_KEY || '',

  // File Upload
  maxFileSize: Number(import.meta.env.VITE_MAX_FILE_SIZE) || 10485760, // 10MB default
  allowedFileTypes: import.meta.env.VITE_ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
  ],

  // Pagination
  defaultPageSize: Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20,
  maxPageSize: Number(import.meta.env.VITE_MAX_PAGE_SIZE) || 100,

  // Feature Flags
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  enableErrorTracking: import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true',

  // Development mode check
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

// Type-safe environment variable access
export default env;
