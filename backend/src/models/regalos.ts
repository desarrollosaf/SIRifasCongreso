import{
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

import sequelize from '../database/cuestionariosConnection';

class Regalos extends Model<
  InferAttributes<Regalos>,
  InferCreationAttributes<Regalos>
> {
    declare id: CreationOptional<number>;
    declare premio: string | null;
    // Unidades disponibles para sortear
    declare cantidad: number | null;
    // Unidades totales del premio; cantidad = stock_inicial - entregados/pendientes
    declare stock_inicial: number | null;
    declare path: string | null;
    declare activo: CreationOptional<boolean>;
    declare createdAt?: Date;
    declare updatedAt?: Date;
    }

    Regalos.init(
        {
            id:{
                autoIncrement: true,
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            }, 
            premio:{
                type: DataTypes.STRING,
                allowNull: true
            },
            cantidad:{
                type: DataTypes.INTEGER,
                allowNull: true
            },
            stock_inicial:{
                type: DataTypes.INTEGER,
                allowNull: true
            },
            path:{
                type: DataTypes.STRING,
                allowNull: true
            },
            activo:{
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
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
            tableName: 'premios',
            timestamps: true,
        }
    );
    export default Regalos;
