const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// ── Profile Images Storage ───────────────────────────────────────────────
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});
const upload = multer({ storage: profileStorage });

// ── Product Images Storage ───────────────────────────────────────────────
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'fill' }]
  }
});
const productUpload = multer({ 
    storage: productStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// ── Banner Images Storage ────────────────────────────────────────────────
const bannerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce/banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1920, height: 1080, crop: 'limit' }]
  }
});
const bannerUpload = multer({ 
    storage: bannerStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = { upload, productUpload, bannerUpload };
