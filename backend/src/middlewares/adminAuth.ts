import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SECRET = () => process.env.JWT_SECRET || process.env.SECRET_KEY || 'TSE-Poder-legislativo';
const COOKIE = 'adminToken';
const DURACION_MS = 12 * 60 * 60 * 1000;

const iguales = (a: string, b: string) => {
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
};

const opcionesCookie = () => ({
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
});

export const loginAdmin = (req: Request, res: Response): any => {
    const { usuario, password } = req.body || {};
    const usuarioEsperado = process.env.ADMIN_USER || 'admin';
    const passwordEsperado = process.env.ADMIN_PASSWORD;
    if (!passwordEsperado) {
        return res.status(503).json({ msg: 'Falta configurar ADMIN_PASSWORD en el archivo .env' });
    }
    if (!usuario || !password || !iguales(String(usuario), usuarioEsperado) || !iguales(String(password), passwordEsperado)) {
        return res.status(401).json({ msg: 'Usuario o contraseña incorrectos' });
    }
    const token = jwt.sign({ admin: true, usuario: usuarioEsperado }, SECRET(), { expiresIn: '12h' });
    res.cookie(COOKIE, token, { ...opcionesCookie(), maxAge: DURACION_MS });
    return res.json({ usuario: usuarioEsperado });
};

export const logoutAdmin = (req: Request, res: Response): any => {
    res.clearCookie(COOKIE, opcionesCookie());
    return res.json({ msg: 'Sesión cerrada' });
};

export const adminActual = (req: Request, res: Response): any => res.json({ usuario: (req as any).admin?.usuario });

export const verifyAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const token = req.cookies?.[COOKIE];
    if (!token) {
        res.status(401).json({ msg: 'Inicia sesión como administrador' });
        return;
    }
    try {
        const datos = jwt.verify(token, SECRET()) as any;
        if (!datos.admin) throw new Error('no admin');
        (req as any).admin = datos;
        next();
    } catch {
        res.status(401).json({ msg: 'Sesión expirada, vuelve a iniciar sesión' });
    }
};
