import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import CrumiModal from '../Common/CrumiModal';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { closeAuthModal } from '../../slices/authModal/authModalSlice';
import { getToken } from '../../services/auth';

const AuthModal: React.FC = () => {
  const dispatch = useDispatch();
  const { isOpen, view } = useSelector((state: any) => state.authModal);

  const close = () => {
    dispatch(closeAuthModal());
    // Si el usuario cierra sin estar autenticado, mandarlo a la landing
    // (evita quedar varado en /dashboard sin sesión).
    if (!getToken()) {
      window.location.href = '/';
    }
  };

  return (
    <CrumiModal
      isOpen={isOpen}
      toggle={close}
      title={view === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      subtitle={view === 'login' ? 'Ingresa a tu cuenta para continuar' : 'Empieza a gestionar tu empresa hoy mismo'}
      size="md"
      footer={<></>}
    >
      {view === 'login' ? <LoginForm /> : <RegisterForm />}
    </CrumiModal>
  );
};

export default AuthModal;
