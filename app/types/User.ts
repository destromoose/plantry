export interface User {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  isPremium: boolean;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  dietaryRestrictions: string[];
  favoriteCuisines: string[];
  measurementSystem: 'metric' | 'imperial';
  darkMode: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface UpdatePasswordRequest {
  token: string;
  password: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  imageUrl?: string;
  preferences?: Partial<UserPreferences>;
} 