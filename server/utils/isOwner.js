const db = require('../config/db');

const isOwnerOfRestaurant = (restaurantId, userId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM Restaurants WHERE restaurant_id = ? AND owner_id = ?";
    db.query(sql, [restaurantId, userId], (err, results) => {
      if (err) reject(err);
      resolve(results.length > 0);
    });
  });
};

module.exports = isOwnerOfRestaurant;
