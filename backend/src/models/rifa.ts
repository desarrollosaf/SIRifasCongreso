import{
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

import sequelize from '../database/cuestionariosConnection';
import Regalos from './regalos';

export type EstatusGanador = 'pendiente' | 'entregado' | 'cancelado';

// Cada registro es un premio sorteado a una persona (ganador)
class Rifa extends Model<
  InferAttributes<Rifa>,
  InferCreationAttributes<Rifa>
> {
    declare id: CreationOptional<number>;
    declare id_premio: number | null;
    declare rfc: string | null;
    declare nombre: string | null;
    declare area: string | null;
    declare nombre_pila: CreationOptional<string | null>;
    declare estatus: CreationOptional<EstatusGanador>;
    declare confirmadoAt: Date | null;
    declare createdAt?: Date;
    declare updatedAt?: Date;

    declare m_regalo?: Regalos;
    }

    Rifa.init(
        {
            id:{
                autoIncrement: true,
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            }, 
            id_premio:{
                type: DataTypes.INTEGER,
                allowNull: true
            },
            rfc:{
                type: DataTypes.STRING(20),
                allowNull: true
            },
            nombre:{
                type: DataTypes.STRING,
                allowNull: true
            },
            nombre_pila:{
                type: DataTypes.STRING,
                allowNull: true
            },
            area:{
                type: DataTypes.STRING,
                allowNull: true
            },
            estatus:{
                type: DataTypes.ENUM('pendiente', 'entregado', 'cancelado'),
                allowNull: false,
                defaultValue: 'entregado'
            },
            confirmadoAt:{
                type: DataTypes.DATE,
                allowNull: true
            },
            createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: DataTypes.NOW
            },
        },
        {
            sequelize,
            tableName: 'rifa',
            timestamps: true,
        }
    );

    Rifa.belongsTo(Regalos,{
        foreignKey: "id_premio", 
        as: "m_regalo"
    })

    export default Rifa;
