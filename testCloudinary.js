require('dotenv').config();
const cloudinary = require('./config/cloudinary');

const testUpload = async () => {
    try {
        console.log('Testing Cloudinary Config...');
        console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
        
        // Try a ping or a simple upload of a small buffer
        const result = await cloudinary.uploader.upload('https://upload.wikimedia.org/wikipedia/commons/a/a3/June_odd-eyed-cat.jpg', {
            folder: 'test'
        });
        
        console.log('Upload Successful!');
        console.log('URL:', result.secure_url);
        process.exit(0);
    } catch (error) {
        console.error('Upload Failed!');
        console.error(error);
        process.exit(1);
    }
};

testUpload();
