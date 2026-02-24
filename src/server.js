require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start the server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🐝 Our Hive API Server`);
    console.log(`🚀 Running on  : http://localhost:${PORT}`);
    console.log(`📖 Swagger Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🌍 Environment : ${process.env.NODE_ENV || 'development'}\n`);
  });
});
