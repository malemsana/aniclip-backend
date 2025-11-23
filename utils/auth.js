require('dotenv').config();

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (token !== process.env.ADMIN_KEY) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid token' });
    }

    next();
};

module.exports = authenticateAdmin;