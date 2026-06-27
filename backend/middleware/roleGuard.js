// ============================================
// Role Guard Middleware
// Restricts routes by user role
// ============================================

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
}

export function requireOwner(req, res, next) {
  return requireRole('owner')(req, res, next);
}

export function requireManager(req, res, next) {
  return requireRole('manager')(req, res, next);
}

export function requireOwnerOrAccountant(req, res, next) {
  return requireRole('owner', 'accountant')(req, res, next);
}

export function requireAnyAuthenticated(req, res, next) {
  return requireRole('owner', 'manager', 'accountant')(req, res, next);
}
