import{
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from 'sequelize';

import sequelize from '../database/cuestionariosConnection';
import Regalos from './regalos';


class Rifa extends Model<
  InferAttributes<Rifa>,
  InferCreationAttributes<Rifa>
> {
    declare id: CreationOptional<number>;
    declare id_premio: number | null;
    declare createdAt?: Date;
    declare updatedAt?: Date;

    declare m_regalo?: Regalos[];
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
        foreignKey: "id_premio", as: "m_regalo"
    })

    export default Rifa;