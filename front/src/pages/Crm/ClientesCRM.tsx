import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from 'reselect';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Swal from 'sweetalert2';
import { unwrapResult } from '@reduxjs/toolkit';
import {
  Search,
  Plus,
  LayoutList,
  LayoutGrid,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Mail,
  Phone,
  Calendar,
  FileText,
  ExternalLink,
  Eye,
  EyeOff,
  Users,
  Inbox,
  UserPlus,
  ArrowRight,
  Hash,
  Clock,
  Sparkles,
} from 'lucide-react';

import {
  getContacts,
  addNewContact,
  updateContact,
  deleteContact,
} from '../../slices/crm/thunk';
import CrumiModal from '../../Components/Common/CrumiModal';

// ── Helpers ──

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-500',
  'from-fuchsia-500 to-purple-500',
  'from-teal-500 to-emerald-500',
  'from-orange-500 to-red-500',
  'from-indigo-500 to-violet-500',
];

const getAvatarGradient = (name: string) => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const getInitials = (name: string) => {
  if (!name) return 'NN';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// ── Avatar ──

const Avatar = ({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-[11px]',
    md: 'w-11 h-11 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-20 h-20 text-2xl',
  };
  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-br ${getAvatarGradient(name)} rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-lg shadow-black/10 ring-2 ring-white/20`}>
      {getInitials(name)}
    </div>
  );
};

// ── Component ──

const ClientesCRM = () => {
  const dispatch: any = useDispatch();
  const navigate = useNavigate();

  // Redux
  const selectCrmState = createSelector(
    (state: any) => state.Crm,
    (crm) => ({
      clients: crm.crmcontacts || [],
      loading: crm.loading || false,
      error: crm.error,
    })
  );
  const { clients, loading, error } = useSelector(selectCrmState);

  // Local state
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [modal, setModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Load contacts
  useEffect(() => {
    dispatch(getContacts());
  }, [dispatch]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const q = searchTerm.toLowerCase();
    return clients.filter((c: any) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [clients, searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handleClick = () => setOpenDropdown(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openDropdown]);

  // ── Modal handlers ──

  const toggleModal = useCallback(() => {
    setModal(prev => !prev);
    if (modal) {
      setContactToEdit(null);
      setShowPassword(false);
    }
  }, [modal]);

  const handleAddClick = () => {
    setIsEdit(false);
    setContactToEdit(null);
    validation.resetForm();
    setModal(true);
  };

  const handleEditClick = useCallback((client: any) => {
    const nameParts = (client.name || '').split(' ');
    setContactToEdit({
      id: client.id,
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' '),
      email: client.email,
      phone: client.phone,
    });
    setIsEdit(true);
    setModal(true);
    setOpenDropdown(null);
  }, []);

  const handleDeleteClick = useCallback((client: any) => {
    setOpenDropdown(null);
    Swal.fire({
      title: '¿Estás seguro?',
      text: `Vas a eliminar a ${client.name}. No podrás revertir esto.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        dispatch(deleteContact(client.id));
        if (selectedClient?.id === client.id) setSelectedClient(null);
      }
    });
  }, [dispatch, selectedClient]);

  const handleClientClick = (client: any) => {
    setSelectedClient(client);
  };

  // ── Formik ──

  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      first_name: contactToEdit?.first_name || '',
      last_name: contactToEdit?.last_name || '',
      email: contactToEdit?.email || '',
      phone: contactToEdit?.phone || '',
      password: '',
    },
    validationSchema: Yup.object({
      first_name: Yup.string().required('El nombre es obligatorio'),
      last_name: Yup.string(),
      email: Yup.string().email('Email inválido').required('El email es obligatorio'),
      phone: Yup.string(),
      password: Yup.string().when([], {
        is: () => !isEdit,
        then: (s) => s.min(6, 'Mínimo 6 caracteres').required('La contraseña es obligatoria'),
        otherwise: (s) => s.optional(),
      }),
    }),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (isEdit) {
          const resultAction = await dispatch(updateContact({
            id: contactToEdit.id,
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone: values.phone,
          }));
          unwrapResult(resultAction);
        } else {
          const resultAction = await dispatch(addNewContact({
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone: values.phone,
            password: values.password,
          }));
          unwrapResult(resultAction);
        }
        resetForm();
        setModal(false);
        setContactToEdit(null);
      } catch (err: any) {
        Swal.fire('Error', err?.error || 'Ocurrió un error al guardar', 'error');
      } finally {
        setSubmitting(false);
      }
    },
  });

  // ── Dropdown Menu (reusable) ──
  const DropdownMenu = ({ client, align = 'right' }: { client: any; align?: 'right' | 'left' }) => (
    <div
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 z-30 w-44 py-1.5
        bg-white dark:bg-crumi-surface-dark rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-xl shadow-black/8
        animate-in fade-in slide-in-from-top-1 duration-150`}
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={() => { handleClientClick(client); setOpenDropdown(null); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-crumi-text-primary dark:text-crumi-text-dark-primary hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
          <Eye size={11} className="text-blue-500" />
        </div>
        Ver detalle
      </button>
      <button
        onClick={() => { navigate(`/clientes/${client.id}/documentos`); setOpenDropdown(null); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-crumi-text-primary dark:text-crumi-text-dark-primary hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
          <FileText size={11} className="text-emerald-500" />
        </div>
        Ver documentos
      </button>
      <button
        onClick={() => handleEditClick(client)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-crumi-text-primary dark:text-crumi-text-dark-primary hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <div className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <Pencil size={11} className="text-amber-500" />
        </div>
        Editar
      </button>
      <div className="my-1 mx-3 border-t border-gray-100 dark:border-gray-700/50" />
      <button
        onClick={() => handleDeleteClick(client)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-500 hover:bg-red-50/60 dark:hover:bg-red-900/10 transition-colors"
      >
        <div className="w-5 h-5 rounded-md bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <Trash2 size={11} className="text-red-400" />
        </div>
        Eliminar
      </button>
    </div>
  );

  document.title = 'Clientes | CRM';

  return (
    <>
      <div className="bg-white dark:bg-crumi-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center justify-between">
            {/* Left: Title + count */}
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-crumi-primary to-crumi-primary/80 dark:from-crumi-accent dark:to-crumi-accent/80 flex items-center justify-center shadow-lg shadow-crumi-primary/20 dark:shadow-crumi-accent/20">
                <Users size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-crumi-text-primary dark:text-white tracking-tight">
                  Clientes
                </h2>
                <p className="text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted mt-0.5">
                  {clients.length} {clients.length === 1 ? 'cliente registrado' : 'clientes registrados'}
                </p>
              </div>
            </div>

            {/* Right: View toggle + New button */}
            <div className="flex items-center gap-3">
              {/* View toggle pills */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800/60 rounded-xl p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-[10px] transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-crumi-surface-dark text-crumi-primary dark:text-crumi-accent shadow-sm'
                      : 'text-crumi-text-muted dark:text-crumi-text-dark-muted hover:text-crumi-text-primary dark:hover:text-white'
                  }`}
                  title="Vista lista"
                >
                  <LayoutList size={15} />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-2 rounded-[10px] transition-all duration-200 ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-crumi-surface-dark text-crumi-primary dark:text-crumi-accent shadow-sm'
                      : 'text-crumi-text-muted dark:text-crumi-text-dark-muted hover:text-crumi-text-primary dark:hover:text-white'
                  }`}
                  title="Vista tarjetas"
                >
                  <LayoutGrid size={15} />
                </button>
              </div>

              <button
                onClick={handleAddClick}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                  bg-gradient-to-r from-crumi-primary to-crumi-primary/90 dark:from-crumi-accent dark:to-crumi-accent/90
                  text-white hover:shadow-lg hover:shadow-crumi-primary/25 dark:hover:shadow-crumi-accent/25
                  hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200"
              >
                <Plus size={14} strokeWidth={2.5} /> Nuevo cliente
              </button>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-gray-100 dark:border-gray-700/50" />

        {/* ── Search toolbar ── */}
        <div className="px-6 py-3.5 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 bg-gray-50/80 dark:bg-gray-800/40 rounded-xl px-3.5 py-2 border border-transparent focus-within:border-crumi-primary/30 dark:focus-within:border-crumi-accent/30 focus-within:bg-white dark:focus-within:bg-gray-800/60 transition-all">
            <Search size={14} className="text-crumi-text-muted dark:text-crumi-text-dark-muted shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o teléfono..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-xs
                text-crumi-text-primary dark:text-crumi-text-dark-primary
                placeholder:text-crumi-text-muted dark:placeholder:text-crumi-text-dark-muted"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="p-0.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <X size={12} className="text-crumi-text-muted" />
              </button>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-gray-100 dark:border-gray-700/50" />

        {/* ── Content area with optional detail panel ── */}
        <div className="flex">
          {/* Main content */}
          <div className={`flex-1 min-w-0 transition-all duration-300 ${selectedClient ? 'border-r border-gray-100 dark:border-gray-700/50' : ''}`}>

            {loading && clients.length === 0 ? (
              /* ── Loading ── */
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="w-10 h-10 border-[3px] border-crumi-primary/20 dark:border-crumi-accent/20 rounded-full" />
                  <div className="absolute inset-0 w-10 h-10 border-[3px] border-crumi-primary dark:border-crumi-accent border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted font-medium">Cargando clientes...</p>
              </div>

            ) : error && clients.length === 0 ? (
              /* ── Error ── */
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <X size={24} className="text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-crumi-text-primary dark:text-white">Error al cargar</p>
                  <p className="text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted mt-0.5">No se pudieron obtener los clientes</p>
                </div>
                <button
                  onClick={() => dispatch(getContacts())}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-crumi-primary dark:bg-crumi-accent text-white hover:opacity-90 transition-all"
                >
                  Reintentar
                </button>
              </div>

            ) : filteredClients.length === 0 ? (
              /* ── Empty ── */
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center">
                    {searchTerm ? (
                      <Search size={26} className="text-gray-300 dark:text-gray-600" />
                    ) : (
                      <Users size={26} className="text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                  {!searchTerm && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-crumi-primary dark:bg-crumi-accent flex items-center justify-center shadow-lg">
                      <Plus size={12} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-crumi-text-primary dark:text-white">
                    {searchTerm ? 'Sin resultados' : 'Empieza a gestionar tus clientes'}
                  </p>
                  <p className="text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted mt-1 max-w-[260px]">
                    {searchTerm
                      ? `No encontramos clientes que coincidan con "${searchTerm}"`
                      : 'Agrega tu primer cliente y centraliza toda su información en un solo lugar.'}
                  </p>
                </div>
                {!searchTerm && (
                  <button
                    onClick={handleAddClick}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold
                      bg-gradient-to-r from-crumi-primary to-crumi-primary/90 dark:from-crumi-accent dark:to-crumi-accent/90
                      text-white hover:shadow-lg hover:shadow-crumi-primary/25 dark:hover:shadow-crumi-accent/25 transition-all mt-1"
                  >
                    <UserPlus size={14} /> Agregar primer cliente
                  </button>
                )}
              </div>

            ) : viewMode === 'list' ? (
              /* ── List View ── */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-6 py-3">Cliente</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-4 py-3">Email</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-4 py-3">Teléfono</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-4 py-3">Servicios</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-4 py-3">Creación</th>
                      <th className="w-12 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client: any) => (
                      <tr
                        key={client.id}
                        onClick={() => handleClientClick(client)}
                        className={`border-t border-gray-50 dark:border-gray-800/50 hover:bg-crumi-primary/[0.03] dark:hover:bg-crumi-accent/[0.03] transition-all duration-150 group cursor-pointer
                          ${selectedClient?.id === client.id
                            ? 'bg-crumi-primary/[0.05] dark:bg-crumi-accent/[0.05] border-l-2 border-l-crumi-primary dark:border-l-crumi-accent'
                            : 'border-l-2 border-l-transparent'
                          }`}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={client.name} size="sm" />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-crumi-text-primary dark:text-white truncate block">
                                {client.name}
                              </span>
                              <span className="text-[10px] text-crumi-text-muted dark:text-crumi-text-dark-muted truncate block mt-0.5 lg:hidden">
                                {client.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted">
                          {client.email || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted font-mono">
                          {client.phone || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {client.cantidadServicios != null ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-800/30">
                              <Hash size={8} /> {client.cantidadServicios}
                            </span>
                          ) : (
                            <span className="text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted">
                            <Clock size={10} className="opacity-50" />
                            {formatDate(client.created_at)}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === client.id ? null : client.id); }}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
                          >
                            <MoreVertical size={14} className="text-crumi-text-muted dark:text-crumi-text-dark-muted" />
                          </button>
                          {openDropdown === client.id && <DropdownMenu client={client} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            ) : (
              /* ── Cards View ── */
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredClients.map((client: any) => (
                    <div
                      key={client.id}
                      onClick={() => handleClientClick(client)}
                      className={`group relative rounded-2xl overflow-hidden cursor-pointer
                        bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50
                        hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20
                        hover:-translate-y-1 hover:border-crumi-primary/20 dark:hover:border-crumi-accent/20
                        transition-all duration-300 ease-out
                        ${selectedClient?.id === client.id
                          ? 'shadow-xl shadow-crumi-primary/10 dark:shadow-crumi-accent/10 border-crumi-primary/30 dark:border-crumi-accent/30 ring-1 ring-crumi-primary/10 dark:ring-crumi-accent/10 -translate-y-1'
                          : ''
                        }`}
                    >
                      {/* Colored accent top bar */}
                      <div className={`h-1 bg-gradient-to-r ${getAvatarGradient(client.name)} opacity-60 group-hover:opacity-100 transition-opacity`} />

                      {/* Dropdown trigger */}
                      <div className="absolute top-4 right-3 z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === client.id ? null : client.id); }}
                          className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 shadow-sm"
                        >
                          <MoreVertical size={13} className="text-crumi-text-muted dark:text-crumi-text-dark-muted" />
                        </button>
                        {openDropdown === client.id && <DropdownMenu client={client} />}
                      </div>

                      {/* Card content */}
                      <div className="px-4 pt-5 pb-4">
                        <div className="flex flex-col items-center text-center">
                          <Avatar name={client.name} size="md" />
                          <h3 className="mt-3 text-[13px] font-bold text-crumi-text-primary dark:text-white truncate max-w-full leading-tight">
                            {client.name}
                          </h3>
                          <p className="text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted truncate max-w-full mt-1 flex items-center gap-1">
                            <Mail size={10} className="opacity-40 shrink-0" />
                            {client.email || 'Sin email'}
                          </p>
                          {client.phone && (
                            <p className="text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted mt-0.5 flex items-center gap-1 font-mono">
                              <Phone size={10} className="opacity-40 shrink-0" />
                              {client.phone}
                            </p>
                          )}
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/40">
                          {client.cantidadServicios != null && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold
                              bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20
                              text-blue-600 dark:text-blue-400 ring-1 ring-blue-100/80 dark:ring-blue-800/30">
                              <Sparkles size={9} /> {client.cantidadServicios} servicios
                            </span>
                          )}
                          {client.tags && client.tags.length > 0 && (
                            <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-semibold
                              bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20
                              text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-100/80 dark:ring-emerald-800/30">
                              {client.tags[0]}
                            </span>
                          )}
                          {!client.cantidadServicios && !(client.tags?.length) && (
                            <span className="text-[10px] text-crumi-text-muted dark:text-crumi-text-dark-muted italic">Sin actividad</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer with count */}
            {!loading && filteredClients.length > 0 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/40 dark:bg-gray-800/20">
                <span className="text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted">
                  {searchTerm
                    ? <><span className="font-semibold text-crumi-text-primary dark:text-white">{filteredClients.length}</span> resultado{filteredClients.length !== 1 ? 's' : ''} de {clients.length}</>
                    : <><span className="font-semibold text-crumi-text-primary dark:text-white">{clients.length}</span> cliente{clients.length !== 1 ? 's' : ''} en total</>
                  }
                </span>
              </div>
            )}
          </div>

          {/* ── Detail Panel (fixed sidebar overlay) ── */}
          {selectedClient && (
            <>
              {/* Backdrop for mobile */}
              <div
                className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 xl:hidden"
                onClick={() => setSelectedClient(null)}
              />
              <div className="fixed right-0 top-0 h-full w-[360px] max-w-[90vw] z-50 xl:relative xl:z-auto xl:w-[340px] xl:h-auto xl:max-h-[calc(100vh-200px)]
                overflow-y-auto bg-white dark:bg-crumi-surface-dark xl:bg-gray-50/30 xl:dark:bg-gray-900/20
                shadow-2xl xl:shadow-none border-l border-gray-100 dark:border-gray-700/50
                animate-in slide-in-from-right duration-200 xl:animate-none shrink-0">

                {/* Panel gradient banner - compact */}
                <div className={`h-16 bg-gradient-to-br ${getAvatarGradient(selectedClient.name)} opacity-80 relative`}>
                  <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedClient(null)}
                      className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 backdrop-blur-sm transition-colors"
                    >
                      <X size={14} className="text-white" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(selectedClient)}
                        className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 backdrop-blur-sm transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} className="text-white" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(selectedClient)}
                        className="p-1.5 rounded-lg bg-black/20 hover:bg-red-500/60 backdrop-blur-sm transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} className="text-white" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Profile - avatar overlapping banner */}
                <div className="relative flex flex-col items-center text-center px-4 pb-3">
                  <div className="-mt-8 ring-[3px] ring-white dark:ring-crumi-surface-dark rounded-full shadow-lg">
                    <Avatar name={selectedClient.name} size="lg" />
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-crumi-text-primary dark:text-white tracking-tight leading-tight">
                    {selectedClient.name}
                  </h3>
                  <p className="text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted mt-0.5 truncate max-w-full">
                    {selectedClient.email || 'Sin email'}
                  </p>
                  {selectedClient.cantidadServicios != null && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold
                      bg-crumi-primary/10 dark:bg-crumi-accent/10 text-crumi-primary dark:text-crumi-accent mt-2">
                      <Sparkles size={9} /> {selectedClient.cantidadServicios} servicios
                    </span>
                  )}
                </div>

                {/* Quick actions - compact */}
                <div className="px-4 pb-3">
                  <div className="flex items-center justify-center gap-2">
                    {selectedClient.email && (
                      <a
                        href={`mailto:${selectedClient.email}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold
                          bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400
                          hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <Mail size={12} /> Email
                      </a>
                    )}
                    {selectedClient.phone && (
                      <a
                        href={`tel:${selectedClient.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold
                          bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400
                          hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                      >
                        <Phone size={12} /> Llamar
                      </a>
                    )}
                  </div>
                </div>

                {/* Info section - compact */}
                <div className="mx-4 mb-3 bg-white dark:bg-crumi-surface-dark rounded-xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-800/50">
                    <h4 className="text-[13px] font-bold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted">
                      Información
                    </h4>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                        <Mail size={14} className="text-blue-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-crumi-text-muted dark:text-crumi-text-dark-muted font-medium leading-none mb-1">Email</p>
                        <p className="text-[14px] text-crumi-text-primary dark:text-white truncate font-medium leading-tight">
                          {selectedClient.email || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                        <Phone size={14} className="text-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-crumi-text-muted dark:text-crumi-text-dark-muted font-medium leading-none mb-1">Teléfono</p>
                        <p className="text-[14px] text-crumi-text-primary dark:text-white font-medium font-mono leading-tight">
                          {selectedClient.phone || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                        <Calendar size={14} className="text-amber-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-crumi-text-muted dark:text-crumi-text-dark-muted font-medium leading-none mb-1">Fecha de creación</p>
                        <p className="text-[14px] text-crumi-text-primary dark:text-white font-medium leading-tight">
                          {formatDate(selectedClient.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tags / Services - compact */}
                {selectedClient.tags && selectedClient.tags.length > 0 && (
                  <div className="mx-4 mb-3 bg-white dark:bg-crumi-surface-dark rounded-xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-800/50">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted">
                        Últimos servicios
                      </h4>
                    </div>
                    <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
                      {selectedClient.tags.map((tag: string, i: number) => (
                        <span
                          key={i}
                          className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold
                            bg-gray-50 dark:bg-gray-800 text-crumi-text-primary dark:text-crumi-text-dark-primary
                            ring-1 ring-gray-100 dark:ring-gray-700/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents link */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => navigate(`/clientes/${selectedClient.id}/documentos`)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold
                      bg-gradient-to-r from-crumi-primary to-crumi-primary/90 dark:from-crumi-accent dark:to-crumi-accent/90
                      text-white hover:shadow-lg hover:shadow-crumi-primary/25 dark:hover:shadow-crumi-accent/25 transition-all group/btn"
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={13} /> Ver documentos
                    </span>
                    <ArrowRight size={13} className="opacity-60 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      <CrumiModal
        isOpen={modal}
        toggle={toggleModal}
        title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle={isEdit ? 'Actualiza la información del cliente' : 'Completa los datos para registrar un cliente'}
        footer={
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/40 dark:bg-gray-800/20">
            <button
              type="button"
              onClick={toggleModal}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold
                text-crumi-text-muted dark:text-crumi-text-dark-muted
                hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="client-form"
              disabled={validation.isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold
                bg-gradient-to-r from-crumi-primary to-crumi-primary/90 dark:from-crumi-accent dark:to-crumi-accent/90
                text-white hover:shadow-lg hover:shadow-crumi-primary/25 dark:hover:shadow-crumi-accent/25
                transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {validation.isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isEdit ? (
                <Pencil size={13} />
              ) : (
                <Plus size={13} strokeWidth={2.5} />
              )}
              {isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        }
      >
        <form id="client-form" onSubmit={validation.handleSubmit} className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1.5">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                name="first_name"
                value={validation.values.first_name}
                onChange={validation.handleChange}
                onBlur={validation.handleBlur}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none transition-all duration-200
                  bg-gray-50/50 dark:bg-gray-800/40
                  text-crumi-text-primary dark:text-white
                  placeholder:text-crumi-text-muted/60 dark:placeholder:text-crumi-text-dark-muted/60
                  focus:bg-white dark:focus:bg-gray-800/60 focus:shadow-sm
                  ${validation.touched.first_name && validation.errors.first_name
                    ? 'border-red-300 dark:border-red-500/50 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/20'
                    : 'border-gray-200 dark:border-gray-700 focus:border-crumi-primary dark:focus:border-crumi-accent focus:ring-2 focus:ring-crumi-primary/10 dark:focus:ring-crumi-accent/10'
                  }`}
                placeholder="Juan"
              />
              {validation.touched.first_name && validation.errors.first_name && (
                <p className="text-[10px] text-red-500 mt-1 font-medium">{validation.errors.first_name as string}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1.5">
                Apellido
              </label>
              <input
                name="last_name"
                value={validation.values.last_name}
                onChange={validation.handleChange}
                onBlur={validation.handleBlur}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none transition-all duration-200
                  bg-gray-50/50 dark:bg-gray-800/40
                  text-crumi-text-primary dark:text-white
                  placeholder:text-crumi-text-muted/60 dark:placeholder:text-crumi-text-dark-muted/60
                  focus:bg-white dark:focus:bg-gray-800/60 focus:shadow-sm
                  border-gray-200 dark:border-gray-700 focus:border-crumi-primary dark:focus:border-crumi-accent focus:ring-2 focus:ring-crumi-primary/10 dark:focus:ring-crumi-accent/10"
                placeholder="Pérez"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1.5">
              Email <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <Mail size={13} className="text-crumi-text-muted/40 dark:text-crumi-text-dark-muted/40" />
              </div>
              <input
                name="email"
                type="email"
                value={validation.values.email}
                onChange={validation.handleChange}
                onBlur={validation.handleBlur}
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border outline-none transition-all duration-200
                  bg-gray-50/50 dark:bg-gray-800/40
                  text-crumi-text-primary dark:text-white
                  placeholder:text-crumi-text-muted/60 dark:placeholder:text-crumi-text-dark-muted/60
                  focus:bg-white dark:focus:bg-gray-800/60 focus:shadow-sm
                  ${validation.touched.email && validation.errors.email
                    ? 'border-red-300 dark:border-red-500/50 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/20'
                    : 'border-gray-200 dark:border-gray-700 focus:border-crumi-primary dark:focus:border-crumi-accent focus:ring-2 focus:ring-crumi-primary/10 dark:focus:ring-crumi-accent/10'
                  }`}
                placeholder="correo@ejemplo.com"
              />
            </div>
            {validation.touched.email && validation.errors.email && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">{validation.errors.email as string}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1.5">
              Teléfono
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <Phone size={13} className="text-crumi-text-muted/40 dark:text-crumi-text-dark-muted/40" />
              </div>
              <input
                name="phone"
                value={validation.values.phone}
                onChange={validation.handleChange}
                onBlur={validation.handleBlur}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border outline-none transition-all duration-200
                  bg-gray-50/50 dark:bg-gray-800/40
                  text-crumi-text-primary dark:text-white
                  placeholder:text-crumi-text-muted/60 dark:placeholder:text-crumi-text-dark-muted/60
                  focus:bg-white dark:focus:bg-gray-800/60 focus:shadow-sm
                  border-gray-200 dark:border-gray-700 focus:border-crumi-primary dark:focus:border-crumi-accent focus:ring-2 focus:ring-crumi-primary/10 dark:focus:ring-crumi-accent/10"
                placeholder="300 123 4567"
              />
            </div>
          </div>

          {/* Password (create only) */}
          {!isEdit && (
            <div>
              <label className="block text-[11px] font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1.5">
                Contraseña <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={validation.values.password}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  className={`w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs border outline-none transition-all duration-200
                    bg-gray-50/50 dark:bg-gray-800/40
                    text-crumi-text-primary dark:text-white
                    placeholder:text-crumi-text-muted/60 dark:placeholder:text-crumi-text-dark-muted/60
                    focus:bg-white dark:focus:bg-gray-800/60 focus:shadow-sm
                    ${validation.touched.password && validation.errors.password
                      ? 'border-red-300 dark:border-red-500/50 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 focus:border-crumi-primary dark:focus:border-crumi-accent focus:ring-2 focus:ring-crumi-primary/10 dark:focus:ring-crumi-accent/10'
                    }`}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-crumi-text-muted dark:text-crumi-text-dark-muted hover:text-crumi-text-primary dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {validation.touched.password && validation.errors.password && (
                <p className="text-[10px] text-red-500 mt-1 font-medium">{validation.errors.password as string}</p>
              )}
            </div>
          )}
        </form>
      </CrumiModal>
    </>
  );
};

export default ClientesCRM;
