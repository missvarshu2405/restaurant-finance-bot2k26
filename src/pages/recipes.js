// ============================================
// Recipes Page — Menu Costing Module
// ============================================

import { recipes as recipesApi } from '../services/api.js';
import { formatCurrency } from '../data/store.js';
import { showToast } from '../components/toast.js';
import { showModal as openModal, hideModal as closeModal } from '../components/modal.js';

let recipeList = [];

export function render(container) {
  container.innerHTML = `
    <div class="recipes-page">
      <div class="page-actions">
        <button class="btn btn-primary" id="add-recipe-btn">+ New Recipe</button>
      </div>

      <div id="recipe-grid" class="recipe-grid">
        <div class="skeleton-row"></div>
      </div>
    </div>
  `;
}

export async function init() {
  try {
    recipeList = await recipesApi.list();
    renderRecipeGrid();
  } catch (err) {
    document.getElementById('recipe-grid').innerHTML = '<div class="empty-state-small">Failed to load recipes</div>';
  }

  document.getElementById('add-recipe-btn')?.addEventListener('click', () => showRecipeForm());
}

function renderRecipeGrid() {
  const grid = document.getElementById('recipe-grid');
  if (recipeList.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👨‍🍳</div>
        <h3>No recipes yet</h3>
        <p>Add your menu items to track ingredient costs and profit margins.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = recipeList.map(r => {
    const cost = (r.ingredients || []).reduce((sum, i) => sum + (i.cost_per_unit || 0) * (i.qty || 0), 0);
    const margin = r.selling_price > 0 ? ((r.selling_price - cost) / r.selling_price * 100) : 0;
    const marginClass = margin < (r.target_margin || 60) ? 'margin-low' : 'margin-ok';

    return `
      <div class="recipe-card" data-recipe-id="${r.id}">
        <div class="recipe-header">
          <h4 class="recipe-name">${r.name}</h4>
          <span class="recipe-margin ${marginClass}">${Math.round(margin)}% margin</span>
        </div>
        <div class="recipe-details">
          <div class="recipe-stat">
            <span class="recipe-stat-label">Selling Price</span>
            <span class="recipe-stat-value">${formatCurrency(r.selling_price)}</span>
          </div>
          <div class="recipe-stat">
            <span class="recipe-stat-label">Ingredient Cost</span>
            <span class="recipe-stat-value">${formatCurrency(cost)}</span>
          </div>
          <div class="recipe-stat">
            <span class="recipe-stat-label">Target Margin</span>
            <span class="recipe-stat-value">${r.target_margin || 60}%</span>
          </div>
        </div>
        <div class="recipe-ingredients">
          <span class="recipe-ing-count">${(r.ingredients || []).length} ingredients</span>
        </div>
      </div>
    `;
  }).join('');
}

function showRecipeForm(recipe = null) {
  const isEdit = !!recipe;
  const ingredients = recipe?.ingredients || [];

  const html = `
    <div class="recipe-form">
      <div class="form-group">
        <label class="form-label">Recipe Name *</label>
        <input type="text" class="form-input" id="recipe-name" value="${recipe?.name || ''}" placeholder="e.g., Butter Chicken" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Selling Price (₹) *</label>
          <input type="number" class="form-input" id="recipe-price" value="${recipe?.selling_price || ''}" placeholder="350" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Target Margin (%)</label>
          <input type="number" class="form-input" id="recipe-margin" value="${recipe?.target_margin || 60}" min="0" max="100">
        </div>
      </div>

      <h4>Ingredients</h4>
      <div id="ingredients-list">
        ${ingredients.map((ing, i) => ingredientRow(i, ing)).join('')}
      </div>
      <button class="btn btn-outline btn-sm" id="add-ingredient-btn">+ Add Ingredient</button>

      <div class="form-actions" style="margin-top: 16px">
        <button class="btn btn-outline" id="cancel-recipe">Cancel</button>
        <button class="btn btn-primary" id="save-recipe">${isEdit ? 'Update' : 'Create'} Recipe</button>
      </div>
    </div>
  `;

  openModal({ title: isEdit ? 'Edit Recipe' : 'New Recipe', content: html, size: 'large' });

  let ingIndex = ingredients.length;

  document.getElementById('add-ingredient-btn')?.addEventListener('click', () => {
    const list = document.getElementById('ingredients-list');
    list.insertAdjacentHTML('beforeend', ingredientRow(ingIndex++));
  });

  document.getElementById('cancel-recipe')?.addEventListener('click', closeModal);

  document.getElementById('save-recipe')?.addEventListener('click', async () => {
    const name = document.getElementById('recipe-name').value.trim();
    if (!name) return showToast('Name is required', 'error');

    const ingRows = document.querySelectorAll('.ingredient-row');
    const ingredientsList = [];
    ingRows.forEach(row => {
      const ingName = row.querySelector('.ing-name')?.value?.trim();
      if (ingName) {
        ingredientsList.push({
          name: ingName,
          qty: parseFloat(row.querySelector('.ing-qty')?.value) || 0,
          unit: row.querySelector('.ing-unit')?.value || 'kg',
          cost_per_unit: parseFloat(row.querySelector('.ing-cost')?.value) || 0,
        });
      }
    });

    const data = {
      name,
      selling_price: parseFloat(document.getElementById('recipe-price').value) || 0,
      target_margin: parseFloat(document.getElementById('recipe-margin').value) || 60,
      ingredients: ingredientsList,
    };

    try {
      if (isEdit) {
        await recipesApi.update(recipe.id, data);
        showToast('Recipe updated ✓', 'success');
      } else {
        await recipesApi.create(data);
        showToast('Recipe created ✓', 'success');
      }
      closeModal();
      recipeList = await recipesApi.list();
      renderRecipeGrid();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });
}

function ingredientRow(index, ing = {}) {
  return `
    <div class="ingredient-row" data-index="${index}">
      <input type="text" class="form-input ing-name" placeholder="Ingredient" value="${ing.name || ''}">
      <input type="number" class="form-input ing-qty" placeholder="Qty" value="${ing.qty || ''}" min="0" step="0.01">
      <select class="form-input ing-unit">
        <option value="kg" ${ing.unit === 'kg' ? 'selected' : ''}>kg</option>
        <option value="g" ${ing.unit === 'g' ? 'selected' : ''}>g</option>
        <option value="litre" ${ing.unit === 'litre' ? 'selected' : ''}>L</option>
        <option value="ml" ${ing.unit === 'ml' ? 'selected' : ''}>ml</option>
        <option value="pieces" ${ing.unit === 'pieces' ? 'selected' : ''}>pcs</option>
      </select>
      <input type="number" class="form-input ing-cost" placeholder="₹/unit" value="${ing.cost_per_unit || ''}" min="0">
    </div>
  `;
}

export function cleanup() {
  recipeList = [];
}
