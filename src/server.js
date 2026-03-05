require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
 
const PORT = process.env.PORT || 5000;
const os = require("os");

const getNetworkIP = () => {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "localhost";
};
// Connect to MongoDB then start the server
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
      const networkIP = getNetworkIP();
    console.log(`\n🐝 Our Hive API Server`);
    console.log(`🚀 Running on  : http://localhost:${PORT}`);
     console.log(`🌐 Network: http://${networkIP}:${PORT}`);
    console.log(`📖 Swagger Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🌍 Environment : ${process.env.NODE_ENV || 'development'}\n`);
  });
});
