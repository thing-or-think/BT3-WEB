export type UserRole = 'USER' | 'ADMIN';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: UserProfile;
}
