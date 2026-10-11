// backend/controllers/favouriteController.js
// Uses Shane's Favourite model (targetType + target + alert).
// Errors are passed to next(err) so the team's errorMiddleware formats them:
//   bad id         -> 400
//   validation     -> 400  (e.g. alert time not HH:mm)
//   duplicate      -> 409  (unique index: same user + same target)
//
// Uses KH's protect middleware, which puts the logged-in user on req.user.

import Favourite from '../models/Favourite.js'
import Stall from '../models/Stall.js'
import HawkerCentre from '../models/HawkerCentre.js'

const TARGET_MODELS = { Stall, HawkerCentre }

// GET /api/favourites
// List the logged-in user's favourites, newest first, with the stall/centre details filled in.
export async function getFavourites(req, res, next) {
  try {
    const favourites = await Favourite.find({ user: req.user._id })
      .populate('target')
      .sort({ createdAt: -1 })

    res.json({ success: true, data: favourites })
  } catch (err) {
    next(err)
  }
}

// POST /api/favourites
// Body: { "targetType": "Stall" | "HawkerCentre", "target": "<id>" }
export async function addFavourite(req, res, next) {
  try {
    const { targetType, target } = req.body

    const TargetModel = TARGET_MODELS[targetType]
    if (!TargetModel) {
      return res.status(400).json({
        success: false,
        message: 'targetType must be Stall or HawkerCentre'
      })
    }

    // Make sure the stall / hawker centre actually exists
    const exists = await TargetModel.exists({ _id: target })
    if (!exists) {
      return res.status(404).json({ success: false, message: `${targetType} not found` })
    }

    const favourite = await Favourite.create({ user: req.user._id, targetType, target })
    res.status(201).json({ success: true, data: favourite })
  } catch (err) {
    next(err) // duplicate favourite -> 409 via errorMiddleware
  }
}

// PATCH /api/favourites/:id/alert
// Body: { "enabled": true, "days": [1, 3, 5], "time": "12:30" }
export async function updateAlert(req, res, next) {
  try {
    const { enabled, days, time } = req.body

    const favourite = await Favourite.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id }, // only your own favourites
      { alert: { enabled, days, time } },
      { new: true, runValidators: true } // return updated doc + check Shane's rules
    )

    if (!favourite) {
      return res.status(404).json({ success: false, message: 'Favourite not found' })
    }

    res.json({ success: true, data: favourite })
  } catch (err) {
    next(err) // bad day/time -> 400 via errorMiddleware
  }
}

// DELETE /api/favourites/:id
export async function removeFavourite(req, res, next) {
  try {
    const favourite = await Favourite.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id // can't delete someone else's
    })

    if (!favourite) {
      return res.status(404).json({ success: false, message: 'Favourite not found' })
    }

    res.json({ success: true, data: { id: favourite._id } })
  } catch (err) {
    next(err)
  }
}