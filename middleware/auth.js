
// Ensure the user is logged in at all
function ensureLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// Ensure the user has the given role
function ensureRole(role) {
  return (req, res, next) => {
    if (req.session.user?.role === role) return next();
    res.status(403).send('Access denied');
  };
}

module.exports = { ensureLoggedIn, ensureRole };
