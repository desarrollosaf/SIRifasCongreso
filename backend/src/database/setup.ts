import { QueryTypes, Transaction } from 'sequelize';
import sequelize from './cuestionariosConnection';
import Regalos from '../models/regalos';
import Rifa from '../models/rifa';
import Participante from '../models/participante';
import Config from '../models/config';
import { premiosSeedRows } from './seedPremios';

const MODELOS: any[] = [Regalos, Rifa, Participante, Config];

// Crea las tablas que falten y agrega columnas nuevas a las existentes (nunca borra nada).
export const asegurarEsquema = async () => {
    const qi = sequelize.getQueryInterface();
    for (const modelo of MODELOS) {
        const tabla = modelo.getTableName() as string;
        const existe = await qi.tableExists(tabla);
        if (!existe) {
            await modelo.sync();
            console.log(`🆕 Tabla creada: ${tabla}`);
            continue;
        }
        const columnas = await qi.describeTable(tabla);
        const atributos = modelo.getAttributes();
        for (const [nombre, def] of Object.entries(atributos)) {
            const campo = (def as any).field || nombre;
            if (!columnas[campo]) {
                await qi.addColumn(tabla, campo, def as any);
                console.log(`➕ Columna agregada: ${tabla}.${campo}`);
            }
        }
    }

    // Datos previos a la migración: calcular stock_inicial a partir de lo ya sorteado
    await sequelize.query(
        `UPDATE premios p
            SET p.stock_inicial = COALESCE(p.cantidad, 0) +
                (SELECT COUNT(*) FROM rifa r WHERE r.id_premio = p.id AND r.estatus <> 'cancelado')
          WHERE p.stock_inicial IS NULL`,
        { type: QueryTypes.UPDATE }
    );

    // El seeder original guardaba "regalos/01.jpg", pero los archivos se llaman "1.jpg"
    await sequelize.query(
        `UPDATE premios SET path = CONCAT('images/navidad/regalos/', id, '.jpg')
          WHERE path REGEXP '^images/navidad/regalos/0[0-9]+\\\\.jpg$'`,
        { type: QueryTypes.UPDATE }
    );
};

export const sembrarPremiosSiVacio = async () => {
    const total = await Regalos.count();
    if (total === 0) {
        await Regalos.bulkCreate(premiosSeedRows());
        console.log('🎁 Premios iniciales cargados');
    }
};

// Corrige "cantidad" para que siempre sea stock_inicial - (pendientes + entregados)
export const recalcularStock = async (transaction?: Transaction) => {
    await sequelize.query(
        `UPDATE premios p
            SET p.cantidad = GREATEST(0, COALESCE(p.stock_inicial, 0) -
                (SELECT COUNT(*) FROM rifa r WHERE r.id_premio = p.id AND r.estatus <> 'cancelado'))`,
        { type: QueryTypes.UPDATE, transaction }
    );
};

export const premiosRestantes = async (): Promise<number> =>
    (await Regalos.sum('cantidad', { where: { activo: true } })) || 0;
