// env shim must be imported FIRST to polyfill process.env for legacy code
import './env';

import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './styles/globals.css';
import './index.css';
import App from './App';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import store from './store';
import { loadConversations } from './services/chatStorage';
import { loadConversations as loadConversationsAction } from './slices/crumiChat/chatSlice';

// Hydrate chat conversations from localStorage
const savedConversations = loadConversations();
if (savedConversations.length > 0) {
  store.dispatch(loadConversationsAction(savedConversations));
}

export type { RootState, AppDispatch } from './store';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <Provider store={store}>
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  </Provider>
);
