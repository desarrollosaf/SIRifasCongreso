import{
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from 'sequelize';

import sequelize from '../database/cuestionariosConnection';

class Regalos extends Model<
  InferAttributes<Regalos>,
  InferCreationAttributes<Regalos>
> {
    declare id: CreationOptional<number>;
    declare premio: string | null;
    declare cantidad: number | null;
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
    export default Regalos;