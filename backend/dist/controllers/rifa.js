"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rifa = void 0;
const regalos_1 = __importDefault(require("../models/regalos"));
const rifa_1 = __importDefault(require("../models/rifa"));
const sequelize_1 = require("sequelize");
const rifa = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { Op } = require('sequelize');
    let regalo = null;
    regalo = yield regalos_1.default.findOne({
        where: {
            cantidad: {
                [Op.gt]: 0
            }
        },
        order: sequelize_1.Sequelize.literal('RAND()')
    });
    if (regalo != null) {
        yield (regalo === null || regalo === void 0 ? void 0 : regalo.update({
            cantidad: regalo.cantidad - 1
        }));
        yield rifa_1.default.create({
            id_premio: regalo === null || regalo === void 0 ? void 0 : regalo.id,
        });
    }
    res.json(regalo);
});
exports.rifa = rifa;
