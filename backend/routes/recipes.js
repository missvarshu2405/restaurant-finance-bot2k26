// ============================================
// Recipe Routes — Menu Costing
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getAll, getById, getWhere, insert, update, remove } from '../services/memoryStore.js';

const router = Router();

// GET /api/recipes
router.get('/', authMiddleware, requireRole('owner'), async (req, res) => {
  const recipes = await getWhere('recipes', r => r.owner_id === req.user.ownerId);
  res.json(recipes);
});

// GET /api/recipes/:id
router.get('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const recipe = await getById('recipes', req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  // Calculate current cost
  const ingredientCost = (recipe.ingredients || []).reduce((sum, ing) => sum + (ing.cost_per_unit || 0) * (ing.qty || 0), 0);
  const margin = recipe.selling_price > 0 ? ((recipe.selling_price - ingredientCost) / recipe.selling_price) * 100 : 0;

  res.json({
    ...recipe,
    calculatedCost: Math.round(ingredientCost * 100) / 100,
    currentMargin: Math.round(margin * 10) / 10,
    belowTarget: margin < (recipe.target_margin || 60),
  });
});

// POST /api/recipes
router.post('/', authMiddleware, requireRole('owner'), async (req, res) => {
  const data = req.body;
  const recipe = await insert('recipes', {
    owner_id: req.user.ownerId,
    name: data.name,
    selling_price: parseFloat(data.selling_price) || 0,
    target_margin: parseFloat(data.target_margin) || 60,
    ingredients: data.ingredients || [],
    is_active: true,
  });
  res.status(201).json(recipe);
});

// PUT /api/recipes/:id
router.put('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const recipe = await getById('recipes', req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  const updated = await update('recipes', req.params.id, req.body);
  res.json(updated);
});

// DELETE /api/recipes/:id
router.delete('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  await remove('recipes', req.params.id);
  res.json({ message: 'Recipe deleted' });
});

export default router;
