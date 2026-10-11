// backend/routes/favouriteRoutes.js
// Maps each favourites URL to a controller function.
// Every route needs a logged-in user, so KH's `protect` runs first and sets req.user.

import { Router } from 'express'
import { protect } from '../middleware/authMiddleware.js'
import {
  getFavourites,
  addFavourite,
  updateAlert,
  removeFavourite
} from '../controllers/favouriteController.js'

const router = Router()

router.use(protect) // applies to every route below

router.get('/', getFavourites)             // GET    /api/favourites
router.post('/', addFavourite)             // POST   /api/favourites
router.patch('/:id/alert', updateAlert)    // PATCH  /api/favourites/:id/alert
router.delete('/:id', removeFavourite)     // DELETE /api/favourites/:id

export default router