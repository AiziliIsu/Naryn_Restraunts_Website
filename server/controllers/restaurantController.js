const db = require('../config/db');

// GET /api/restaurants
exports.getAllRestaurants = (req, res) => {
  const sql = `
    SELECT r.restaurant_id, r.name, r.address, r.contact_general, r.delivery_available,
           dz.zone_name AS delivery_zone, sp.policy_name AS smoking_policy, 
           ap.policy_name AS alcohol_policy, r.average_bill
    FROM Restaurants r
    LEFT JOIN DeliveryZones dz ON r.delivery_zone_id = dz.delivery_zone_id
    LEFT JOIN SmokingPolicies sp ON r.smoking_policy_id = sp.smoking_policy_id
    LEFT JOIN AlcoholPolicies ap ON r.alcohol_policy_id = ap.alcohol_policy_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

// GET /api/restaurants/:id
exports.getRestaurantById = (req, res) => {
    const id = req.params.id;
    const sql = `SELECT * FROM Restaurants WHERE restaurant_id = ?`;
    db.query(sql, [id], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0) return res.status(404).json({ error: 'Not found' });
  
      const restaurant = results[0];
  
      const getJoinData = (table, joinField, returnField) => {
        const sql = `
          SELECT ref.${returnField} FROM ${table} link
          JOIN ${table.replace('Restaurant', '')} ref ON link.${joinField} = ref.${joinField}
          WHERE link.restaurant_id = ?
        `;
        return new Promise((resolve, reject) => {
          db.query(sql, [id], (err, result) => {
            if (err) reject(err);
            resolve(result.map(r => r[returnField]));
          });
        });
      };
  
      Promise.all([
        getJoinData('RestaurantAmenities', 'amenity_id', 'amenity_name'),
        getJoinData('RestaurantCuisineTypes', 'cuisine_type_id', 'cuisine_name'),
        getJoinData('RestaurantPaymentMethods', 'payment_method_id', 'method_name'),
        getJoinData('RestaurantServiceLanguages', 'language_id', 'language_name')
      ])
      .then(([amenities, cuisines, payment_methods, service_languages]) => {
        res.json({
          ...restaurant,
          amenities,
          cuisines,
          payment_methods,
          service_languages
        });
      })
      .catch(err => res.status(500).json({ error: err }));
    });
  };
  

// POST /api/restaurants
exports.createRestaurant = (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  if (role === 'owner') {
    const checkSql = "SELECT * FROM Restaurants WHERE owner_id = ?";
    db.query(checkSql, [userId], (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.length > 0) {
        return res.status(403).json({ error: 'Owners can create only one restaurant' });
      } else {
        return insertRestaurant(req, res);
      }
    });
  } else if (role === 'moderator') {
    return insertRestaurant(req, res);
  } else {
    return res.status(403).json({ error: 'Unauthorized role' });
  }
};

function insertRestaurant(req, res) {
    const {
        name, address, contact_general, contact_uca, delivery_available,
        delivery_zone_id, booth_capacity, hall_capacity, entertainment,
        smoking_policy_id, alcohol_policy_id, average_bill, restroom_available,
        social_instagram, surveillance_camera, year_established, certificates,
        owner_id, operating_hours_id, service_charge_id, table_reservation_policy_id,
        table_capacity
    } = req.body;

    // metadata arrays - declare and initialize BEFORE destructuring
    const {
        amenities = [],
        cuisine_type_ids = [],
        payment_method_ids = [],
        language_ids = []
    } = req.body;

    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: err });

        const sql = `INSERT INTO Restaurants
        (name, address, contact_general, contact_uca, delivery_available,
        delivery_zone_id, booth_capacity, hall_capacity, entertainment,
        smoking_policy_id, alcohol_policy_id, average_bill, restroom_available,
        social_instagram, surveillance_camera, year_established, certificates,
        owner_id, operating_hours_id, service_charge_id, table_reservation_policy_id,
        table_capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`; // 22 placeholders

        const values = [
            name, address, contact_general, contact_uca, delivery_available,
            delivery_zone_id, booth_capacity, hall_capacity, entertainment,
            smoking_policy_id, alcohol_policy_id, average_bill, restroom_available,
            social_instagram, surveillance_camera, year_established, certificates,
            owner_id, operating_hours_id, service_charge_id, table_reservation_policy_id,
            table_capacity
        ];

        db.query(sql, values, (err, result) => {
            if (err) {
                return db.rollback(() => res.status(500).json({ error: err }));
            }

            const restaurantId = result.insertId;

            const insertMany = (table, field, values) => {
                if (!values || values.length === 0) return Promise.resolve();
                const entries = values.map(v => [restaurantId, v]);
                const sql = `INSERT INTO ${table} (restaurant_id, ${field}) VALUES ?`;
                return new Promise((resolve, reject) => {
                    db.query(sql, [entries], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            };

            Promise.all([
                insertMany('RestaurantAmenities', 'amenity_id', amenities),
                insertMany('RestaurantCuisineTypes', 'cuisine_type_id', cuisine_type_ids),
                insertMany('RestaurantPaymentMethods', 'payment_method_id', payment_method_ids),
                insertMany('RestaurantServiceLanguages', 'language_id', language_ids)
            ])
            .then(() => {
                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => res.status(500).json({ error: err }));
                    }
                    res.status(201).json({ message: 'Restaurant and metadata created successfully', restaurant_id: restaurantId });
                });
            })
            .catch(err => {
                db.rollback(() => res.status(500).json({ error: err }));
            });
        });
    });
}
  
// PUT /api/restaurants/:id
exports.updateRestaurant = (req, res) => {
  const restaurantId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  if (role === 'moderator') {
    performUpdate(req, res, restaurantId);
  } else if (role === 'owner') {
    const sql = "SELECT * FROM Restaurants WHERE restaurant_id = ? AND owner_id = ?";
    db.query(sql, [restaurantId, userId], (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.length === 0) return res.status(403).json({ error: "You can only edit your own restaurant" });

      performUpdate(req, res, restaurantId);
    });
  } else {
    return res.status(403).json({ error: 'Unauthorized role' });
  }
};

function performUpdate(req, res, restaurantId) {
  const updateSql = "UPDATE Restaurants SET ? WHERE restaurant_id = ?";
  db.query(updateSql, [req.body, restaurantId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Restaurant updated successfully" });
  });
}

// DELETE /api/restaurants/:id
exports.deleteRestaurant = (req, res) => {
  const restaurantId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  if (role === 'moderator') {
    return performDelete(req, res, restaurantId);
  }

  if (role === 'owner') {
    const checkSql = "SELECT * FROM Restaurants WHERE restaurant_id = ? AND owner_id = ?";
    db.query(checkSql, [restaurantId, userId], (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.length === 0) return res.status(403).json({ error: "You can only delete your own restaurant" });

      return performDelete(req, res, restaurantId);
    });
  } else {
    return res.status(403).json({ error: 'Unauthorized role' });
  }
};

function performDelete(req, res, restaurantId) {
  const deleteSql = "DELETE FROM Restaurants WHERE restaurant_id = ?";
  db.query(deleteSql, [restaurantId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Restaurant deleted successfully" });
  });
}
