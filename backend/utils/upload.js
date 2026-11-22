const multer = require('multer');
const path = require('path');

// Where profile resume PDFs are kept:
//   - default: in the Postgres database (files table) - nothing extra to configure
//   - FILE_STORAGE=cloudinary + CLOUDINARY_* keys: Cloudinary
const useCloudinary = process.env.FILE_STORAGE === 'cloudinary'
    && !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

let storage;
if (useCloudinary) {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    storage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'resumes',
            resource_type: 'raw', // raw must be used for PDFs in Cloudinary
            format: 'pdf',
            public_id: (req, file) => `resume_${Date.now()}_${path.basename(file.originalname, '.pdf')}`,
        },
    });
    console.log('Resume uploads: Cloudinary');
} else {
    storage = multer.memoryStorage(); // buffer is saved to the database by the controller
    console.log('Resume uploads: database');
}

// Only allow PDFs (MIME type AND extension)
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === 'application/pdf' && ext === '.pdf') return cb(null, true);
    const err = new Error('Invalid file type. Only PDF files are allowed.');
    err.status = 400;
    cb(err, false);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = { upload, useCloudinary };
