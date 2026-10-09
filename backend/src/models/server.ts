import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors'
import UsersSafs from '../models/saf/users';
import routeUser from "../routes/user";
import cookieParser from 'cookie-parser';
import path from 'path';
import { verifyToken } from '../middlewares/auth';
import rRifa from "../routes/rifa"
<<<<<<< HEAD
import { asegurarEsquema, sembrarPremiosSiVacio } from '../database/setup';
import { refrescarEstadoBase } from '../controllers/sorteo';
=======
import rPartido from "../routes/partido"
>>>>>>> e992aaf2063451ee085385379f5cc4a80af4d7a2
class Server {

    private app: Application
    private port: string
    

    constructor(){
        this.app = express()
        this.port = process.env.PORT || '3018'
        this.midlewares();
        this.router();
        this.DBconnetc();
        this.listen();
        
    }

    listen(){
        this.app.listen(this.port, () => {
            console.log("La aplicación se esta corriendo exitosamente en el puerto => "+ this.port)           
        })
    }

    router(){
        this.app.use(routeUser);
        this.app.use(rRifa);
        this.app.use(rPartido);

    }

    
    midlewares(){
        this.app.use(express.json())
        this.app.use(cors({
<<<<<<< HEAD
            //origin: 'http://localhost:4200',
            origin: process.env.CORS_ORIGIN || 'https://rifas.congresoedomex.gob.mx',
=======
            origin: 'http://localhost:4200',
            //origin: 'https://rifas.congresoedomex.gob.mx',
>>>>>>> e992aaf2063451ee085385379f5cc4a80af4d7a2
            credentials: true
        }));

        this.app.use(cookieParser());
        this.app.use('/storage', express.static(path.join(process.cwd(), 'storage')));

        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const publicPaths = [
                '/api/user/login',
<<<<<<< HEAD
                '/api/admin',   // protegido por verifyAdmin en sus rutas
                '/api/sorteo'   // pantalla pública
=======
                '/api/rifa',
                '/api/partido'
>>>>>>> e992aaf2063451ee085385379f5cc4a80af4d7a2
            ];
            const isPublic = publicPaths.some(path => req.originalUrl.startsWith(path));
            if (isPublic) {
                return next(); 
            }
            return verifyToken(req, res, next); 
        });

    }

    async DBconnetc(){
        // La BD de SAF solo es accesible desde la red interna; en Docker local se desactiva con ENABLE_SAF=false
        if (process.env.ENABLE_SAF !== 'false') {
            try {
                await UsersSafs.sync();
                console.log("Conexion de DB exitoso");

            } catch (error) {
                console.log("Conexion de DB errorena => "+error);
                
            }
        }

        // BD del sorteo: crea tablas/columnas faltantes y carga los premios iniciales
        for (let intento = 1; intento <= 10; intento++) {
            try {
                await asegurarEsquema();
                await sembrarPremiosSiVacio();
                await refrescarEstadoBase();
                console.log("🎄 BD del sorteo lista");
                return;
            } catch (error) {
                console.log(`BD del sorteo no disponible (intento ${intento}) => ${error}`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }

    
}


export default Server