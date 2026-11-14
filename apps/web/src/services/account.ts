const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export async function deleteAccount(currentPassword: string) {
  const response = await fetch(`${API_BASE_URL}/account`, {
    method: 'DELETE', credentials: 'include',
    headers: {'Content-Type': 'application/json', Accept: 'application/json'},
    body: JSON.stringify({currentPassword, confirmation: 'DELETE MY ACCOUNT'}),
  });
  if (response.status === 204) return;
  const payload = await response.json().catch(() => null) as {error?: {message?: string}} | null;
  throw new Error(payload?.error?.message ?? 'Could not delete your account.');
}

export async function downloadAccountData() {
  const response = await fetch(`${API_BASE_URL}/account/export`, {credentials: 'include', headers: {Accept: 'application/json'}});
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as {error?: {message?: string}} | null;
    throw new Error(payload?.error?.message ?? 'Could not export account data.');
  }
  const file = await response.blob();
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `other-half-data-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
