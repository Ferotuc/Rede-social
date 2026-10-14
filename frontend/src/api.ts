export const BASE = ((import.meta as any).env.VITE_API_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
);
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ message: 'No se pudo completar la solicitud.' }));
    throw new Error(data.message || 'Error del servidor.');
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export type User = {
  id: number;
  name: string;
  username: string;
  bio: string;
  followers?: number;
  following?: number;
  isFollowing?: boolean;
};
export type Post = {
  id: number;
  user_id: number;
  name: string;
  username: string;
  content: string;
  created_at: string;
  likes: number;
  comments: number;
  liked: boolean;
  media_url?: string | null;
  media_kind?: string | null;
};
export type Comment = {
  id: number;
  name: string;
  username: string;
  content: string;
  created_at: string;
};
