import{
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

import sequelize from '../database/cuestionariosConnection';

class Participante extends Model<
  InferAttributes<Participante>,
  InferCreationAttributes<Participante>
> {
    declare id: CreationOptional<number>;
    declare rfc: string;
    declare nombre: string | null;
    // area = dependencia; direccion ayuda a distinguir homónimos
    declare area: string | null;
    declare direccion: CreationOptional<string | null>;
    // Nombre(s) de pila para el saludo en pantalla
    declare nombre_pila: CreationOptional<string | null>;
    declare createdAt?: Date;
    declare updatedAt?: Date;
    }

    Participante.init(
        {
            id:{
                autoIncrement: true,
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            },
            rfc:{
                type: DataTypes.STRING(20),
                allowNull: false,
                unique: true
            },
            nombre:{
                type: DataTypes.STRING,
                allowNull: true
            },
            area:{
                type: DataTypes.STRING,
                allowNull: true
            },
            nombre_pila:{
                type: DataTypes.STRING,
                allowNull: true
            },
            direccion:{
                type: DataTypes.STRING,
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
            tableName: 'participantes',
            timestamps: true,
        }
    );
    export default Participante;
