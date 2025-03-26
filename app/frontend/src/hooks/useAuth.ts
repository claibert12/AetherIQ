import { useState, useEffect } from 'react';
import { 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../config/firebase';

interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
}

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
    alerts: any[];
    notifications: any[];
    compliance: {
        issues: number;
    };
}

export const useAuth = () => {
    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null,
        alerts: [],
        notifications: [],
        compliance: {
            issues: 0
        }
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                // Transform Firebase user to our User type
                const user: User = {
                    id: firebaseUser.uid,
                    name: firebaseUser.displayName || 'User',
                    email: firebaseUser.email || '',
                    avatar: firebaseUser.photoURL || undefined
                };
                setState(prev => ({ ...prev, user, loading: false }));
            } else {
                setState(prev => ({ ...prev, user: null, loading: false }));
            }
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            setState(prev => ({ ...prev, loading: true, error: null }));
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            setState(prev => ({ 
                ...prev, 
                error: error.message || 'Failed to login',
                loading: false 
            }));
        }
    };

    const signup = async (email: string, password: string) => {
        try {
            setState(prev => ({ ...prev, loading: true, error: null }));
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            setState(prev => ({ 
                ...prev, 
                error: error.message || 'Failed to create account',
                loading: false 
            }));
        }
    };

    const logout = async () => {
        try {
            setState(prev => ({ ...prev, loading: true, error: null }));
            await signOut(auth);
        } catch (error: any) {
            setState(prev => ({ 
                ...prev, 
                error: error.message || 'Failed to logout',
                loading: false 
            }));
        }
    };

    return {
        ...state,
        login,
        signup,
        logout
    };
}; 