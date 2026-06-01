const AWS = require('aws-sdk');

let s3Client = null;

const configureAWS = () => {
    if (!s3Client && process.env.AWS_ACCESS_KEY_ID) {
        AWS.config.update({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION
        });
        
        s3Client = new AWS.S3();
        console.log('AWS S3 configured');
    }
    
    return s3Client;
};

const getS3Client = () => {
    return s3Client || configureAWS();
};

module.exports = { configureAWS, getS3Client };