import { env } from '../config/env';
import { encryptPayload, decryptPayload, generateAuthHeaders } from './crypto';

const originalFetch = window.fetch.bind(window);

window.fetch = async function (input, init) {
  // If encryption is disabled, bypass interceptor
  if (!env.enableEncryption) {
    return originalFetch(input, init);
  }

  // Intercept requests directed to our API base URL
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
  const isApiRequest = url.startsWith(env.apiBaseUrl) || 
                       (env.apiBaseUrl.startsWith('/') && (url.startsWith(window.location.origin + env.apiBaseUrl) || url.startsWith(env.apiBaseUrl)));
  if (!isApiRequest) {
    return originalFetch(input, init);
  }

  // 1. Extract and clone headers
  let headers: Record<string, string> = {};
  if (init && init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      headers = { ...init.headers } as Record<string, string>;
    }
  }

  // 2. Generate RSA auth token and HMAC headers
  try {
    const authHeaders = await generateAuthHeaders(env.rsaPublicKey, env.hmacSecret);
    Object.assign(headers, authHeaders);
  } catch (err) {
    console.error('Failed to generate RSA/HMAC auth headers:', err);
  }

  // 3. Encrypt Request Body (AES-256-GCM)
  let body = init?.body;
  if (body && typeof body === 'string') {
    try {
      const parsedBody = JSON.parse(body);
      const encryptedData = await encryptPayload(parsedBody, env.aesSecret);
      body = JSON.stringify({ data: encryptedData });
      headers['Content-Type'] = 'application/json';
    } catch (err) {
      // Keep original body if parsing or encryption fails
      console.warn('Failed to encrypt request body:', err);
    }
  }

  const newInit: RequestInit = {
    ...init,
    headers,
    body,
  };

  // 4. Perform network request
  const response = await originalFetch(input, newInit);

  // 5. Decrypt Response Body (AES-256-GCM)
  if (response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const clone = response.clone();
      try {
        const json = await clone.json();
        if (json && json.data) {
          const decryptedData = await decryptPayload(json.data, env.aesSecret);
          
          // Return new Response with decrypted JSON payload
          return new Response(JSON.stringify(decryptedData), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch (err) {
        console.error('Failed to decrypt response payload:', err);
      }
    }
  }

  return response;
};
