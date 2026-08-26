/**
 * Profil de l'utilisateur connecté.
 * Retourné par /auth/login, /auth/register et /auth/me.
 * Le token JWT n'est PAS ici — il est dans le cookie HttpOnly.
 */
export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  phone?: string | null;
  city?: string | null;
  targetRole?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}
