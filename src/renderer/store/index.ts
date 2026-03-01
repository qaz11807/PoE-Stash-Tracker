import { create } from 'zustand';

type TrackerState = {
  league: string;
  stashPath: string;
  setLeague: (league: string) => void;
  setStashPath: (stashPath: string) => void;
};

export const useTrackerStore = create<TrackerState>((set) => ({
  league: '',
  stashPath: '',
  setLeague: (league) => set({ league }),
  setStashPath: (stashPath) => set({ stashPath })
}));
