const express = require('express');
const router = express.Router();
const controller = require('../controllers/restaurantController');
const verifyToken = require('../middleware/verifyToken');

router.get('/', controller.getAllRestaurants);
router.get('/:id', controller.getRestaurantById);
router.post('/', verifyToken, controller.createRestaurant);
router.put('/:id', verifyToken, controller.updateRestaurant);
router.delete('/:id', verifyToken, controller.deleteRestaurant);

module.exports = router;
