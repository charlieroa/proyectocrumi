import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    Col,
    Form,
    Input,
    Label,
    Row,
    Spinner,
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { jwtDecode } from 'jwt-decode';
import { api } from '../../../../services/api';
import { getToken } from '../../../../services/auth';

type Profile = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
};

const emptyProfile: Profile = {
    id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
};

const MiPerfil: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<Profile>(emptyProfile);
    const [initial, setInitial] = useState<Profile>(emptyProfile);
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);

    const userId = useMemo(() => {
        try {
            const t = getToken();
            if (!t) return null;
            const d: any = jwtDecode(t);
            return d?.user?.id || d?.id || null;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!userId) {
                setError('No se pudo identificar al usuario (token inválido).');
                setLoading(false);
                return;
            }
            try {
                const { data } = await api.get(`/users/${userId}`);
                if (cancelled) return;
                const p: Profile = {
                    id: String(data?.id || userId),
                    first_name: data?.first_name || '',
                    last_name: data?.last_name || '',
                    email: data?.email || '',
                    phone: data?.phone || '',
                };
                setProfile(p);
                setInitial(p);
            } catch (e: any) {
                setError(e?.response?.data?.message || 'No se pudo cargar tu perfil');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const hasChanges =
        JSON.stringify(profile) !== JSON.stringify(initial) ||
        password.length > 0 ||
        passwordConfirm.length > 0;

    const handleSave = async () => {
        setError(null);
        if (password || passwordConfirm) {
            if (password !== passwordConfirm) {
                setError('Las contraseñas no coinciden.');
                return;
            }
            if (password.length < 6) {
                setError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }
        }
        if (!profile.email.trim()) {
            setError('El email es obligatorio.');
            return;
        }

        setSaving(true);
        try {
            const body: Record<string, any> = {
                first_name: profile.first_name.trim(),
                last_name: profile.last_name.trim(),
                email: profile.email.trim(),
                phone: profile.phone.trim(),
            };
            if (password) body.password = password;

            const { data } = await api.put(`/users/${userId}`, body);
            const updated: Profile = {
                id: String(data?.id || userId),
                first_name: data?.first_name || body.first_name,
                last_name: data?.last_name || body.last_name,
                email: data?.email || body.email,
                phone: data?.phone || body.phone,
            };
            setProfile(updated);
            setInitial(updated);
            setPassword('');
            setPasswordConfirm('');
            await Swal.fire({
                icon: 'success',
                title: 'Perfil actualizado',
                confirmButtonColor: '#1A1D1F',
                timer: 1600,
            });
        } catch (e: any) {
            setError(e?.response?.data?.error || e?.response?.data?.message || 'No se pudo actualizar el perfil');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner color="primary" />
            </div>
        );
    }

    return (
        <Card className="shadow-none border-0">
            <CardHeader className="border-bottom bg-transparent px-0">
                <div className="d-flex align-items-center gap-2">
                    <i className="ri-user-3-line text-primary" style={{ fontSize: 22 }} />
                    <h5 className="mb-0">Mi perfil</h5>
                    <Badge color="primary" className="badge-soft-primary">Datos personales</Badge>
                </div>
                <div className="text-muted fs-13 mt-1">
                    Nombre, email y contraseña de tu cuenta. Los datos de tu empresa se gestionan en{' '}
                    <a href="/contabilidad/config/empresa">Contabilidad → Datos de la Empresa</a>.
                </div>
            </CardHeader>
            <CardBody className="px-0">
                {error && (
                    <Alert color="danger" fade={false} className="mb-3">
                        {error}
                    </Alert>
                )}
                <Form onSubmit={e => { e.preventDefault(); handleSave(); }}>
                    <Row className="g-3">
                        <Col md={6}>
                            <Label className="form-label mb-1">Nombre</Label>
                            <Input
                                value={profile.first_name}
                                onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))}
                                placeholder="Tu nombre"
                            />
                        </Col>
                        <Col md={6}>
                            <Label className="form-label mb-1">Apellido</Label>
                            <Input
                                value={profile.last_name}
                                onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))}
                                placeholder="Tu apellido"
                            />
                        </Col>
                        <Col md={6}>
                            <Label className="form-label mb-1">Email</Label>
                            <Input
                                type="email"
                                value={profile.email}
                                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                                placeholder="tu@correo.com"
                            />
                        </Col>
                        <Col md={6}>
                            <Label className="form-label mb-1">Teléfono (opcional)</Label>
                            <Input
                                value={profile.phone}
                                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                                placeholder="+57 300 123 4567"
                            />
                        </Col>

                        <Col xs={12}>
                            <hr className="my-2" />
                            <h6 className="text-muted text-uppercase fs-12 mb-3">Cambiar contraseña</h6>
                        </Col>
                        <Col md={6}>
                            <Label className="form-label mb-1">Nueva contraseña</Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                autoComplete="new-password"
                            />
                        </Col>
                        <Col md={6}>
                            <Label className="form-label mb-1">Confirmar contraseña</Label>
                            <Input
                                type="password"
                                value={passwordConfirm}
                                onChange={e => setPasswordConfirm(e.target.value)}
                                placeholder="Repite la contraseña"
                                autoComplete="new-password"
                            />
                        </Col>
                        <Col xs={12} className="text-muted fs-12">
                            Deja los campos de contraseña vacíos si no quieres cambiarla.
                        </Col>
                    </Row>

                    <div className="d-flex justify-content-end gap-2 mt-4">
                        <Button
                            type="button"
                            color="light"
                            disabled={saving || !hasChanges}
                            onClick={() => {
                                setProfile(initial);
                                setPassword('');
                                setPasswordConfirm('');
                                setError(null);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" color="primary" disabled={!hasChanges || saving}>
                            {saving ? <Spinner size="sm" /> : 'Guardar cambios'}
                        </Button>
                    </div>
                </Form>
            </CardBody>
        </Card>
    );
};

export default MiPerfil;
