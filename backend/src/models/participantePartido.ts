import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

import sequelize from '../database/cuestionariosConnection';

class ParticipantePartido extends Model<
  InferAttributes<ParticipantePartido>,
  InferCreationAttributes<ParticipantePartido>
> {
  declare id: CreationOptional<number>;
  declare folio: string;
  declare nombre_completo: string;
  declare adscripcion: string;
  declare ganador: CreationOptional<boolean>;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

ParticipantePartido.init(
  {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    folio: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    nombre_completo: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    adscripcion: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ganador: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'partido_participantes',
    timestamps: true,
  }
);

export default ParticipantePartido;
