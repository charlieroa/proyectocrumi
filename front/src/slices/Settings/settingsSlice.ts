import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface SettingsState {
  progress: number;
  isComplete: boolean;
}

// Leemos el valor inicial de localStorage para mantener el estado entre recargas
const initialProgress = Number(localStorage.getItem('setupProgress') || 0);

const initialState: SettingsState = {
  progress: initialProgress,
  isComplete: initialProgress === 100,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // Esta acción actualizará el estado del progreso
    setSetupProgress(state, action: PayloadAction<number>) {
      const newProgress = action.payload;
      state.progress = newProgress;
      state.isComplete = newProgress === 100;
      // También lo guardamos en localStorage para persistencia
      localStorage.setItem('setupProgress', String(newProgress));
    },
  },
});

export const { setSetupProgress } = settingsSlice.actions;

// Selector para acceder fácilmente al estado
export const selectIsSetupComplete = (state: { settings: SettingsState }) => state.settings.isComplete;

export default settingsSlice.reducer;