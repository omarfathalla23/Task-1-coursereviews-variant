import { Review } from '../models/Review.js';
import Joi from 'joi';

const reviewValidationSchema = Joi.object({
  courseCode: Joi.string().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('').optional(),
  reviewedBy: Joi.string().optional(),
});

const reviewUpdateSchema = reviewValidationSchema.fork(
  ['courseCode', 'rating'],
  (schema) => schema.optional()
);

export async function getAllReviews(req, res, next) {
  try {
    const reviews = await Review.find().populate('reviewedBy', 'name email');
    res.json(reviews);
  } catch (err) { next(err); }
}

export async function getReview(req, res, next) {
  try {
    const review = await Review.findById(req.params.id).populate('reviewedBy', 'name email');
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (err) { next(err); }
}

export async function getCourseSummary(req, res, next) {
  try {
    const { courseCode } = req.query;
    if (!courseCode) return res.status(400).json({ error: 'courseCode is required' });

    const result = await Review.aggregate([
      { $match: { courseCode } },
      {
        $group: {
          _id: '$courseCode',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    if (result.length === 0) {
      return res.json({ courseCode, averageRating: 0, reviewCount: 0 });
    }

    const { averageRating, reviewCount } = result[0];
    res.json({
      courseCode,
      averageRating: Math.round(averageRating * 10) / 10,
      reviewCount,
    });
  } catch (err) { next(err); }
}

export async function createReview(req, res, next) {
  try {
    const { error, value } = reviewValidationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const review = await Review.create(value);
    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already reviewed this course' });
    }
    next(err);
  }
}

export async function updateReview(req, res, next) {
  try {
    const { error, value } = reviewUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const review = await Review.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    }).populate('reviewedBy', 'name email');

    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already reviewed this course' });
    }
    next(err);
  }
}

export async function deleteReview(req, res, next) {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.status(204).send();
  } catch (err) { next(err); }
}