// const express = require("express");
// const productController = require("../controllers/Product");
// const ProductRouter = express.Router();
// const { verifyToken } = require("../middleware/VerifyToken");
// const {checkAdmin} = require("../middleware/CheckAdminData.js");
// ProductRouter
// 	.post("/", verifyToken, productController.create)
// 	.get("/", verifyToken, productController.getAll)
// 	.get("/:id", verifyToken, productController.getById)
// 	.patch("/:id", verifyToken, productController.updateById)
// 	.patch("/undelete/:id", verifyToken,checkAdmin, productController.undeleteById)
// 	.delete("/:id", verifyToken,checkAdmin, productController.deleteById);
	
// module.exports = ProductRouter;
