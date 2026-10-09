import { Model, DataTypes, InferAttributes, InferCreationAttributes } from 'sequelize';

import sequelize from '../database/cuestionariosConnection';

// Configuración clave-valor del evento (título, año...)
class Config extends Model<InferAttributes<Config>, InferCreationAttributes<Config>> {
    declare clave: string;
    declare valor: string | null;
}

Config.init(
    {
        clave: { type: DataTypes.STRING(64), primaryKey: true },
        valor: { type: DataTypes.TEXT, allowNull: true },
    },
    {
        sequelize,
        tableName: 'config',
        timestamps: false,
    }
);

export const CONFIG_DEFAULT: Record<string, string> = {
    evento_titulo: 'Gran Sorteo Navideño',
    evento_anio: String(new Date().getFullYear()),
};

export const getConfig = async (): Promise<Record<string, string>> => {
    const filas = await Config.findAll();
    const config = { ...CONFIG_DEFAULT };
    filas.forEach(f => { config[f.clave] = f.valor ?? ''; });
    return config;
};

export default Config;
