import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { openAuthModal } from '../../slices/authModal/authModalSlice';

export const LoginRedirect: React.FC = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(openAuthModal('login'));
  }, [dispatch]);
  return <Navigate to="/dashboard" replace />;
};

export const RegisterRedirect: React.FC = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(openAuthModal('register'));
  }, [dispatch]);
  return <Navigate to="/dashboard" replace />;
};
