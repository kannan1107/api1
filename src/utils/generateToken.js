
import jwt from 'jsonwebtoken'

const generateToken = (data) =>{
    console.log('JWT_SECRET:', process.env.JWT_SECRET);
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    const token = jwt.sign(data, process.env.JWT_SECRET, {expiresIn: '1d'});
    return token;
}


export default generateToken;