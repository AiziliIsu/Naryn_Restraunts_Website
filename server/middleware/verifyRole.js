const verifyRole = (roles = []) => {
    if (typeof roles === 'string') roles = [roles];
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      next();
    };
  };
  
  module.exports = verifyRole;
  