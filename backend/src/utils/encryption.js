const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const encrypt = (text, key) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
};

const decrypt = (encryptedData, key) => {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(key, 'hex'),
        Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
};

const hashData = (data, salt = null) => {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
};

const verifyHash = (data, hash, salt) => {
    const { hash: computedHash } = hashData(data, salt);
    return computedHash === hash;
};

module.exports = {
    encrypt,
    decrypt,
    hashData,
    verifyHash
};