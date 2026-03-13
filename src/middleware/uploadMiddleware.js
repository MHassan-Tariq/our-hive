const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'our-hive',
    allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
    resource_type: 'auto',
    type: 'upload',
    access_mode: 'public',
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = upload;
