// Archivo: src/Layouts/tourSteps.ts
import { Step } from 'react-joyride';

export const tourSteps: Step[] = [
  // --- Pasos en la página de Settings ---
  {
    target: '.card-header-tabs .nav-item:nth-child(1)', // Selector CSS para la primera pestaña
    content: '¡Bienvenido a la configuración! Aquí puedes introducir los datos básicos de tu negocio.',
    disableBeacon: true,
  },
  {
    target: '.card-header-tabs .nav-item:nth-child(2)',
    content: 'En esta pestaña, define tus horarios de atención para cada día de la semana.',
  },
  {
    target: '.card-header-tabs .nav-item:nth-child(3)',
    content: 'Aquí puedes crear y administrar todos los servicios que ofreces a tus clientes.',
  },
  {
    target: '.card-header-tabs .nav-item:nth-child(4)',
    content: 'Finalmente, en esta sección puedes registrar a tu personal o estilistas.',
  },
  // --- Pasos en el Sidebar ---
  {
    target: '.navbar-nav #dashboard', // Selector CSS para el ítem del menú
    content: 'Este es el Dashboard, donde verás un resumen general de tu negocio una vez configurado.',
  },
  {
    target: '.navbar-nav #stylists',
    content: 'En CRM, puedes gestionar la información de tus clientes.',
  },
  {
    target: '.navbar-nav #inventory',
    content: 'Aquí administrarás tu inventario de productos.',
  },
  {
    target: '.navbar-nav #payroll',
    content: 'Esta sección es para gestionar la nómina de tu personal.',
  },
];