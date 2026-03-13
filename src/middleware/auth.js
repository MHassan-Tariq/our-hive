const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect middleware — verifies the JWT from the Authorization header.
 * Attaches the authenticated user to req.user.
 */
const protect = async (req, res, next) => {
  let token;

  // 🔹 Log which route is being hit
  console.log(`🔐 Protect middleware triggered — Route: ${req.method} ${req.originalUrl}`);

  // 1️⃣ Extract token
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
    console.log('📌 Token received:', token);
  }

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token provided',
    });
  }

  try {
    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded successfully:', decoded);

    // 3️⃣ Fetch user from DB
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      console.log('❌ User not found for decoded ID:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'Not authorized — user no longer exists',
      });
    }

    // 4️⃣ Attach user to request
    req.user = user;

    console.log('👤 Authenticated user:', {
      id: user._id,
      email: user.email,
      role: user.role,
    });

    next();

  } catch (err) {
    console.log('❌ Token verification failed');
    console.log('Error:', err.message);

    return res.status(401).json({
      success: false,
      message: 'Not authorized — token invalid or expired',
    });
  }
};

/**
 * Authorize middleware — restricts access to specific roles.
 * Must be used AFTER the protect middleware.
 * Usage: authorize('admin', 'volunteer')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Log route access attempt
    console.log(`🛡 Authorize check — Route: ${req.method} ${req.originalUrl} — User role: ${req.user?.role}`);

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied — role '${req.user.role}' is not permitted to access this resource`,
      });
    }
    next();
  };
};

/**
 * Optional protect — similar to protect but doesn't return 401 when
 * no token is provided. If a valid token is present it will attach the
 * user; otherwise it simply calls next(). This enables public routes to
 * still know about the caller when authenticated.
 */
const optionalProtect = async (req, res, next) => {
  // Log route being accessed
  console.log(`🔓 OptionalProtect middleware triggered — Route: ${req.method} ${req.originalUrl}`);

  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(); // continue without attaching a user
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user) {
      req.user = user;
    }
  } catch (err) {
    // ignore errors; treat as unauthenticated
    console.log('optionalProtect: token invalid, continuing as guest');
  }

  next();
};

module.exports = { protect, authorize, optionalProtect };