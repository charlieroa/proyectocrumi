import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type AuthModalView = 'login' | 'register';

interface AuthModalState {
  isOpen: boolean;
  view: AuthModalView;
}

const initialState: AuthModalState = {
  isOpen: false,
  view: 'login',
};

const authModalSlice = createSlice({
  name: 'authModal',
  initialState,
  reducers: {
    openAuthModal(state, action: PayloadAction<AuthModalView | undefined>) {
      state.isOpen = true;
      state.view = action.payload || 'login';
    },
    closeAuthModal(state) {
      state.isOpen = false;
    },
    setAuthModalView(state, action: PayloadAction<AuthModalView>) {
      state.view = action.payload;
    },
  },
});

export const { openAuthModal, closeAuthModal, setAuthModalView } = authModalSlice.actions;
export default authModalSlice.reducer;
