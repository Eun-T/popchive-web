export interface AuthUser { id: number; email: string; nickname: string; provider: string }
export interface GoogleSignup { status: 'SIGNUP_REQUIRED'; signupToken: string; expiresInSeconds: number }
export interface AppleSignup { status: 'SIGNUP_REQUIRED'; expiresInSeconds: number }
