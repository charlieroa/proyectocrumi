// src/middleware/permissionsMiddleware.js

/**
 * Middleware de Autorización por Roles.
 * Esta es una "función de fábrica": una función que crea y devuelve otra función.
 * La usamos para poder pasarle una lista de roles permitidos a nuestras rutas.
 * @param {Array<number>} allowedRoles - Un array de IDs de roles que tienen permiso.
 * @returns {Function} - El middleware de Express que se ejecutará.
 */
exports.authorize = (allowedRoles) => {
  // Esta es la función de middleware que Express realmente usará.
  return (req, res, next) => {
    // Asumimos que authMiddleware ya se ejecutó y nos dejó el usuario en `req.user`.
    if (!req.user || typeof req.user.role_id === 'undefined') {
      return res.status(403).json({ message: 'No se pudo verificar el rol del usuario.' });
    }

    const userRoleId = req.user.role_id;

    // =======================================================
    // == LÓGICA CLAVE: "ADMIN Y SUPER ADMIN VEN TODO"      ==
    // =======================================================
    // Rol 1 (Admin) y 99 (Super Admin) tienen acceso total.
    if (userRoleId === 1 || userRoleId === 99) {
      return next();
    }

    // Si el usuario NO es Admin, entonces revisamos si su rol está en la lista de permitidos.
    if (allowedRoles.includes(userRoleId)) {
      return next(); // El rol está permitido. Continúa a la siguiente función.
    }

    // Si llegamos hasta aquí, significa que el usuario no es Admin y su rol tampoco está en la lista.
    // Por lo tanto, le denegamos el acceso.
    return res.status(403).json({ message: 'Acceso denegado. No tienes los permisos necesarios.' });
  };
};