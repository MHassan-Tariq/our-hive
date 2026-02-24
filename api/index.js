const app = require('../src/app');
const connectDB = require('../src/config/db');

module.exports = async (req, res) => {
  // Ensure DB connection is established for each serverless invocation
  await connectDB();
  return app(req, res);
};
