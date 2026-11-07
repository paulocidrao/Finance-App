export function getAllowedOrigins(frontendUrl?: string, nodeEnv?: string): string[] {
  const configured = (frontendUrl || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Preview uses 4173. Both hosts are valid locally, but never broaden production CORS.
  const local = nodeEnv === 'production' ? [] : [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
  return [...new Set([...configured, ...local])];
}