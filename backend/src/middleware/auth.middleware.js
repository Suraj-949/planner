const jwt = require('jsonwebtoken');


function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                message: 'Authorization header missing or malformed'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded.id;
        console.log("Decoded user ID from token:", req.user);

        next();
    } catch (err) {
        console.error('Authentication error:', err);
        res.status(401).json({
            message: 'Invalid or expired token'
        });
    }
    
}


module.exports = { authMiddleware };