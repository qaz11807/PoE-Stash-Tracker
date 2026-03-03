import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { League } from '../types/poe';

interface AuthState {
  isAuthenticated: boolean;
  username?: string;
  leagues: League[];
  selectedLeague: string | null;
  setAuthenticated: (val: boolean, username?: string) => void;
  setLeagues: (leagues: League[]) => void;
  setSelectedLeague: (id: string) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      username: undefined,
      leagues: [],
      selectedLeague: null,
      setAuthenticated: (val, username) => set({ isAuthenticated: val, username }),
      setLeagues: (leagues) => set({ leagues }),
      setSelectedLeague: (id) => set({ selectedLeague: id }),
      reset: () => set({ isAuthenticated: false, username: undefined, leagues: [], selectedLeague: null })
    }),
    {
      name: 'poe-auth-storage'
    }
  )
);
