const app = require('../src/app');
const connectDB = require('../src/config/db');

module.exports = async (req, res) => {
  try {
    // Wait for DB connection before handling the request
    await connectDB();
    
    // Pass request to Express app
    return app(req, res);
  } catch (err) {
    console.error('Vercel API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server failed to initialize',
      details: err.message
    });
  }
};
