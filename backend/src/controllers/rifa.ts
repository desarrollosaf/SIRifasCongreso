import { Request, Response } from "express"
import Regalos from "../models/regalos";
import Rifa from "../models/rifa";
import { Sequelize } from "sequelize";

export const rifa = async (req: Request, res: Response): Promise<any> => {
    const { Op } = require('sequelize');
    let regalo = null;

    regalo = await Regalos.findOne({
        where:{
            cantidad: {
                [Op.gt]: 0
            }
        },
        order: Sequelize.literal('RAND()')
    });

    if(regalo != null){
        await regalo?.update({
            cantidad: regalo.cantidad! - 1
        });

        await Rifa.create({
            id_premio: regalo?.id,
        })
    }
    res.json( regalo );
}