import type { Aisle, Ingredient, Recipe, Step, Taste } from '@/lib/types'

// [name, key, quantity, unit, aisle, optional?]
type Ing = [string, string, number, string, Aisle, boolean?]
// A plain string, or [text, timerMinutes]
type StepIn = string | [string, number]

const PR: Aisle = 'produce'
const DA: Aisle = 'dairy'
const MF: Aisle = 'meat-fish'
const BK: Aisle = 'bakery'
const PA: Aisle = 'pantry'
const FR: Aisle = 'frozen'
const SP: Aisle = 'spices'

interface Meta {
  id: string
  title: string
  description: string
  photo: string
  active: number
  total: number
  servings: number
  tastes: Taste[]
  weather: 'warm' | 'light' | 'any'
  leftovers?: boolean
  favorite?: boolean
}

function build(m: Meta, ings: Ing[], steps: StepIn[]): Recipe {
  const ingredients: Ingredient[] = ings.map(([name, key, quantity, unit, aisle, optional], i) => ({
    id: `${m.id}-i${i + 1}`,
    name,
    key,
    quantity,
    unit,
    aisle,
    ...(optional ? { optional: true } : {}),
  }))
  const stepList: Step[] = steps.map((s, i) =>
    typeof s === 'string'
      ? { id: `${m.id}-s${i + 1}`, text: s }
      : { id: `${m.id}-s${i + 1}`, text: s[0], timerMinutes: s[1] }
  )
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    imageUrl: `https://images.unsplash.com/photo-${m.photo}?auto=format&fit=crop&w=1200&q=80`,
    activeMinutes: m.active,
    totalMinutes: m.total,
    servings: m.servings,
    ingredients,
    steps: stepList,
    tastes: m.tastes,
    weather: m.weather,
    ...(m.leftovers ? { leftovers: true } : {}),
    source: 'Plantry kitchen',
    isFavorite: m.favorite ?? false,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

/** Bump when recipes are added, so kitchens saved earlier get the new ones once. */
export const SEED_VERSION = 2

export const seedRecipes: Recipe[] = [
  build(
    {
      id: 'r-lemony-chickpea-skillet',
      title: 'Lemony chickpea skillet',
      description:
        'Chickpeas simmered with cumin and garlic, wilted spinach, and a salty crumble of feta on top.',
      photo: '1540189549336-e6e99c3679fe',
      active: 20,
      total: 30,
      servings: 4,
      tastes: ['one-pan', 'veg-forward', 'fresh'],
      weather: 'any',
      favorite: true,
    },
    [
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Chickpeas', 'chickpea', 2, 'can', PA],
      ['Cumin', 'cumin', 1, 'tsp', SP],
      ['Chili flakes', 'chili flake', 0.5, 'tsp', SP],
      ['Lemon', 'lemon', 1, 'whole', PR],
      ['Spinach', 'spinach', 150, 'g', PR],
      ['Feta', 'feta', 100, 'g', DA],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      'Heat the olive oil in a large deep skillet over medium heat. Slice the onion thinly.',
      ['Cook the onion with a pinch of salt until soft and golden, about 6 minutes.', 6],
      'Add the sliced garlic, cumin and chili flakes and stir for 1 minute until fragrant.',
      'Drain and rinse the chickpeas, then add them to the pan with a splash of water.',
      ['Simmer, mashing a few chickpeas against the pan, for 10 minutes until saucy.', 10],
      'Stir in the spinach a handful at a time until wilted, then add the zest and juice of the lemon.',
      'Crumble the feta over the top, scatter with parsley and bring the whole pan to the table.',
    ]
  ),

  build(
    {
      id: 'r-spinach-feta-quesadillas',
      title: 'Spinach and feta quesadillas',
      description:
        'Crisp tortillas folded around melting cheddar, salty feta and a good handful of spinach.',
      photo: '1565299624946-b28f40a0ae38',
      active: 10,
      total: 15,
      servings: 2,
      tastes: ['fast', 'veg-forward', 'kid-friendly'],
      weather: 'any',
    },
    [
      ['Tortillas', 'tortilla', 4, 'whole', BK],
      ['Spinach', 'spinach', 100, 'g', PR],
      ['Feta', 'feta', 80, 'g', DA],
      ['Cheddar', 'cheddar', 100, 'g', DA],
      ['Butter', 'butter', 1, 'tbsp', DA],
      ['Paprika', 'paprika', 0.5, 'tsp', SP],
      ['Scallions', 'scallion', 2, 'whole', PR, true],
      ['Yogurt', 'yogurt', 4, 'tbsp', DA, true],
    ],
    [
      'Grate the cheddar, crumble the feta and roughly chop the spinach. Slice the scallions if using.',
      'Toss the cheeses, spinach, scallions and paprika together in a bowl.',
      'Spread a quarter of the filling over half of each tortilla and fold over.',
      'Melt a little butter in a large nonstick pan over medium heat.',
      [
        'Cook two quesadillas at a time for 3 minutes per side, pressing down, until crisp and golden.',
        3,
      ],
      'Cut into wedges and serve with spoonfuls of yogurt.',
    ]
  ),

  build(
    {
      id: 'r-sweet-potato-black-bean-tacos',
      title: 'Sweet potato and black bean tacos',
      description: 'Roasted sweet potato with smoky black beans, cool avocado and plenty of lime.',
      photo: '1551183053-bf91a1d81141',
      active: 20,
      total: 40,
      servings: 4,
      tastes: ['veg-forward', 'kid-friendly', 'fresh'],
      weather: 'any',
    },
    [
      ['Sweet potatoes', 'sweet potato', 2, 'whole', PR],
      ['Black beans', 'black bean', 1, 'can', PA],
      ['Tortillas', 'tortilla', 8, 'whole', BK],
      ['Cumin', 'cumin', 1, 'tsp', SP],
      ['Paprika', 'paprika', 1, 'tsp', SP],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Limes', 'lime', 2, 'whole', PR],
      ['Avocado', 'avocado', 1, 'whole', PR],
      ['Yogurt', 'yogurt', 100, 'g', DA, true],
      ['Cilantro', 'cilantro', 0.5, 'bunch', PR, true],
    ],
    [
      'Heat the oven to 220C. Cut the sweet potatoes into 1 cm cubes.',
      'Toss the sweet potato on a tray with the olive oil, half the cumin, half the paprika and a good pinch of salt.',
      ['Roast for 25 minutes, turning once, until tender and browned at the edges.', 25],
      'Meanwhile, warm the drained black beans in a small pan with the remaining spices and a squeeze of lime.',
      'Mash the avocado with the juice of one lime and a pinch of salt.',
      'Warm the tortillas in a dry pan or wrapped in foil in the oven.',
      'Fill the tortillas with sweet potato, beans and avocado, then top with yogurt and cilantro.',
    ]
  ),

  build(
    {
      id: 'r-red-lentil-dal',
      title: 'Red lentil dal with rice',
      description:
        'A soft, golden pot of lentils and tomato, finished with lemon and good for three dinners.',
      photo: '1574484284002-952d92456975',
      active: 20,
      total: 45,
      servings: 4,
      tastes: ['cozy', 'big-batch', 'veg-forward'],
      weather: 'warm',
      leftovers: true,
    },
    [
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 4, 'clove', PR],
      ['Ginger', 'ginger', 2, 'tbsp', PR],
      ['Cumin', 'cumin', 2, 'tsp', SP],
      ['Chili flakes', 'chili flake', 0.5, 'tsp', SP],
      ['Lentils', 'lentil', 250, 'g', PA],
      ['Canned tomatoes', 'canned tomato', 1, 'can', PA],
      ['Coconut milk', 'coconut milk', 1, 'can', PA],
      ['Lemon', 'lemon', 1, 'whole', PR],
      ['Rice', 'rice', 300, 'g', PA],
      ['Cilantro', 'cilantro', 0.5, 'bunch', PR, true],
    ],
    [
      'Rinse the red lentils in a sieve until the water runs mostly clear.',
      [
        'Soften the chopped onion in the olive oil in a large pot over medium heat for 8 minutes.',
        8,
      ],
      'Add the garlic, grated ginger, cumin and chili flakes and stir for 1 minute.',
      'Add the lentils, canned tomatoes, coconut milk and 600 ml of water, and bring to a boil.',
      [
        'Reduce to a simmer and cook, stirring now and then, for 20 minutes until the lentils collapse.',
        20,
      ],
      'Cook the rice according to the packet while the dal simmers.',
      'Season with salt and the juice of the lemon. Add a splash of water if it has thickened too far.',
      'Serve over rice with cilantro. Leftovers thicken overnight and keep for 4 days.',
    ]
  ),

  build(
    {
      id: 'r-thai-coconut-tofu-curry',
      title: 'Thai coconut tofu curry',
      description:
        'Golden tofu and crisp peppers in a fragrant green curry, ready in the time the rice takes.',
      photo: '1455619452474-d2be8b1e70cd',
      active: 25,
      total: 35,
      servings: 4,
      tastes: ['spicy', 'veg-forward', 'one-pan'],
      weather: 'any',
    },
    [
      ['Tofu', 'tofu', 400, 'g', PA],
      ['Coconut milk', 'coconut milk', 1, 'can', PA],
      ['Thai green curry paste', 'thai green curry paste', 3, 'tbsp', PA],
      ['Bell peppers', 'bell pepper', 2, 'whole', PR],
      ['Zucchini', 'zucchini', 1, 'whole', PR],
      ['Ginger', 'ginger', 1, 'tbsp', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Soy sauce', 'soy sauce', 2, 'tbsp', PA],
      ['Olive oil', 'olive oil', 1, 'tbsp', PA],
      ['Lime', 'lime', 1, 'whole', PR],
      ['Rice', 'rice', 300, 'g', PA],
      ['Cilantro', 'cilantro', 0.5, 'bunch', PR, true],
    ],
    [
      'Start the rice according to the packet. Press the tofu between towels for 5 minutes, then cut into cubes.',
      [
        'Fry the tofu in the oil in a wide pan over medium-high heat for 8 minutes, turning until golden. Remove to a plate.',
        8,
      ],
      'In the same pan, fry the garlic, ginger and curry paste for 1 minute.',
      'Pour in the coconut milk and a splash of water, scraping up the browned bits.',
      'Add the sliced peppers and zucchini, then return the tofu to the pan.',
      ['Simmer for 10 minutes until the vegetables are just tender.', 10],
      'Season with soy sauce and lime juice, then taste and adjust.',
      'Serve over rice with cilantro.',
    ]
  ),

  build(
    {
      id: 'r-loaded-avocado-egg-toast',
      title: 'Loaded avocado and egg toast',
      description:
        'Thick toast, mashed avocado, a runny egg and tomatoes blistered in the same pan.',
      photo: '1588166524941-3bf61a9c41db',
      active: 10,
      total: 10,
      servings: 2,
      tastes: ['fast', 'fresh', 'veg-forward'],
      weather: 'light',
    },
    [
      ['Bread', 'bread', 4, 'slice', BK],
      ['Avocado', 'avocado', 2, 'whole', PR],
      ['Eggs', 'egg', 2, 'whole', DA],
      ['Cherry tomatoes', 'cherry tomato', 150, 'g', PR],
      ['Lemon', 'lemon', 0.5, 'whole', PR],
      ['Chili flakes', 'chili flake', 0.25, 'tsp', SP],
      ['Olive oil', 'olive oil', 1, 'tbsp', PA],
      ['Feta', 'feta', 50, 'g', DA, true],
    ],
    [
      'Toast the bread until properly crisp.',
      'Mash the avocado with the lemon juice and a pinch of salt.',
      'Heat the olive oil in a small pan and add the halved cherry tomatoes. Cook until they just blister.',
      'Push the tomatoes aside and crack in the eggs.',
      ['Fry the eggs for 3 minutes, until the whites are set and the yolks still run.', 3],
      'Pile the avocado on the toast, then top with tomatoes and an egg.',
      'Finish with chili flakes, crumbled feta if you have it, and black pepper.',
    ]
  ),

  build(
    {
      id: 'r-egg-fried-rice',
      title: 'Egg fried rice with peas',
      description:
        'Day-old rice, soft egg and sweet peas fried hot with soy and a drop of sesame oil.',
      photo: '1512621776951-a57141f2eefd',
      active: 12,
      total: 15,
      servings: 2,
      tastes: ['fast', 'kid-friendly', 'one-pan'],
      weather: 'any',
    },
    [
      ['Rice', 'rice', 200, 'g', PA],
      ['Eggs', 'egg', 3, 'whole', DA],
      ['Frozen peas', 'frozen pea', 100, 'g', FR],
      ['Carrot', 'carrot', 1, 'whole', PR],
      ['Scallions', 'scallion', 3, 'whole', PR],
      ['Garlic', 'garlic', 2, 'clove', PR],
      ['Soy sauce', 'soy sauce', 2, 'tbsp', PA],
      ['Sesame oil', 'sesame oil', 1, 'tsp', PA],
      ['Olive oil', 'olive oil', 1, 'tbsp', PA],
    ],
    [
      'Use rice that is already cooked and cold, or cook it earlier and spread it on a plate to cool. Dice the carrot finely.',
      'Beat the eggs with a pinch of salt. Heat the oil in a large pan over high heat.',
      'Scramble the eggs for 30 seconds until barely set, then tip them onto a plate.',
      'Add the carrot and garlic to the pan and stir-fry for 2 minutes.',
      'Add the rice and peas, breaking up any clumps, and keep it moving.',
      ['Fry for 3 minutes until the rice is hot and starting to crisp.', 3],
      'Return the eggs, add the soy sauce and sesame oil, and toss through the sliced scallions.',
    ]
  ),

  build(
    {
      id: 'r-baked-tomato-feta-pasta',
      title: 'Baked tomato and feta pasta',
      description:
        'Cherry tomatoes burst around a block of feta in the oven, then get tossed through pasta.',
      photo: '1473093226795-af9932fe5856',
      active: 15,
      total: 50,
      servings: 4,
      tastes: ['cozy', 'veg-forward', 'big-batch'],
      weather: 'warm',
      leftovers: true,
      favorite: true,
    },
    [
      ['Cherry tomatoes', 'cherry tomato', 600, 'g', PR],
      ['Feta', 'feta', 200, 'g', DA],
      ['Olive oil', 'olive oil', 4, 'tbsp', PA],
      ['Garlic', 'garlic', 4, 'clove', PR],
      ['Chili flakes', 'chili flake', 0.5, 'tsp', SP],
      ['Oregano', 'oregano', 1, 'tsp', SP],
      ['Pasta', 'pasta', 350, 'g', PA],
      ['Spinach', 'spinach', 100, 'g', PR],
      ['Parmesan', 'parmesan', 30, 'g', DA, true],
    ],
    [
      'Heat the oven to 200C. Put the cherry tomatoes and whole garlic cloves in a baking dish.',
      'Nestle the block of feta in the middle and pour the olive oil over everything. Add the chili flakes, oregano and salt.',
      ['Bake for 35 minutes until the tomatoes have burst and the feta is soft and golden.', 35],
      [
        'Cook the pasta in well-salted water for 10 minutes, saving a mug of the cooking water before draining.',
        10,
      ],
      'Mash the feta and tomatoes together in the dish to make a sauce, squashing the garlic in.',
      'Fold in the pasta, the spinach and a splash of pasta water until glossy.',
      'Serve with grated parmesan. It reheats well with a little water.',
    ]
  ),

  build(
    {
      id: 'r-tomato-soup-cheddar-toasts',
      title: 'Tomato soup with mustard cheddar toasts',
      description: 'A smooth, slightly sweet tomato soup with sharp cheddar toasts for dunking.',
      photo: '1547592166-23ac45744acd',
      active: 25,
      total: 50,
      servings: 4,
      tastes: ['cozy', 'big-batch', 'kid-friendly'],
      weather: 'warm',
      leftovers: true,
    },
    [
      ['Canned tomatoes', 'canned tomato', 2, 'can', PA],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Carrot', 'carrot', 1, 'whole', PR],
      ['Stock', 'stock', 500, 'ml', PA],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Butter', 'butter', 1, 'tbsp', DA],
      ['Oregano', 'oregano', 1, 'tsp', SP],
      ['Bread', 'bread', 8, 'slice', BK],
      ['Cheddar', 'cheddar', 150, 'g', DA],
      ['Mustard', 'mustard', 1, 'tsp', PA],
    ],
    [
      'Dice the onion and carrot. Melt the butter with the olive oil in a large pot over medium heat.',
      [
        'Cook the onion and carrot for 10 minutes until soft, adding the garlic for the last minute.',
        10,
      ],
      'Add the canned tomatoes, stock and oregano, then bring to a boil.',
      ['Simmer for 20 minutes, then blend until smooth with a stick blender.', 20],
      'Season with salt and pepper. A pinch of sugar or a little honey rounds out the tomatoes if they taste sharp.',
      'Heat the grill. Spread the bread with mustard, cover with grated cheddar and set on a tray.',
      ['Grill the toasts for 4 minutes until bubbling and browned at the edges.', 4],
      'Ladle the soup into bowls and serve with the toasts alongside.',
    ]
  ),

  build(
    {
      id: 'r-crispy-chickpea-tahini-bowl',
      title: 'Crispy chickpea tahini bowl',
      description:
        'Quinoa with paprika-crisped chickpeas, cool cucumber and a lemony tahini sauce.',
      photo: '1546069901-ba9599a7e63c',
      active: 20,
      total: 30,
      servings: 2,
      tastes: ['fresh', 'veg-forward', 'big-batch'],
      weather: 'light',
    },
    [
      ['Quinoa', 'quinoa', 150, 'g', PA],
      ['Chickpeas', 'chickpea', 1, 'can', PA],
      ['Cucumber', 'cucumber', 1, 'whole', PR],
      ['Cherry tomatoes', 'cherry tomato', 200, 'g', PR],
      ['Tahini', 'tahini', 3, 'tbsp', PA],
      ['Lemon', 'lemon', 1, 'whole', PR],
      ['Garlic', 'garlic', 1, 'clove', PR],
      ['Paprika', 'paprika', 1, 'tsp', SP],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      [
        'Rinse the quinoa and simmer it in 300 ml of salted water, covered, for 15 minutes. Leave it to steam off the heat.',
        15,
      ],
      'Drain the chickpeas and pat them very dry with a towel.',
      [
        'Fry the chickpeas in the olive oil over medium-high heat, shaking the pan, for 12 minutes until crisp. Add the paprika and salt in the last minute.',
        12,
      ],
      'Whisk the tahini with the lemon juice, the grated garlic and enough cold water to make a pourable sauce.',
      'Chop the cucumber and halve the tomatoes.',
      'Divide the quinoa between bowls and top with cucumber, tomatoes and chickpeas.',
      'Drizzle with the tahini sauce and scatter with parsley.',
    ]
  ),

  build(
    {
      id: 'r-chili-garlic-spaghetti',
      title: 'Chili garlic spaghetti with spinach',
      description:
        'Pasta in a quick sauce of golden garlic, olive oil and chili, with lemon to brighten it.',
      photo: '1563379926898-05f4575a45d8',
      active: 12,
      total: 20,
      servings: 2,
      tastes: ['fast', 'spicy', 'veg-forward'],
      weather: 'any',
    },
    [
      ['Pasta', 'pasta', 200, 'g', PA],
      ['Garlic', 'garlic', 5, 'clove', PR],
      ['Chili flakes', 'chili flake', 1, 'tsp', SP],
      ['Olive oil', 'olive oil', 4, 'tbsp', PA],
      ['Spinach', 'spinach', 100, 'g', PR],
      ['Lemon', 'lemon', 1, 'whole', PR],
      ['Parmesan', 'parmesan', 40, 'g', DA],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      [
        'Cook the pasta in well-salted boiling water for 10 minutes, saving a mug of the water before draining.',
        10,
      ],
      'While it cooks, slice the garlic as thinly as you can.',
      'Warm the olive oil in a wide pan over low heat. Add the garlic and chili flakes.',
      'Cook gently for 3 minutes, until the garlic is pale gold and not a shade darker.',
      'Add the drained pasta and a splash of pasta water and toss over the heat until glossy.',
      'Fold in the spinach until it wilts, then add the lemon zest and juice.',
      'Serve with plenty of parmesan, parsley and black pepper.',
    ]
  ),

  build(
    {
      id: 'r-sheet-pan-salmon-potatoes',
      title: 'Sheet-pan mustard salmon and potatoes',
      description:
        'Salmon glazed with mustard and honey over crisp lemony potatoes, all on one tray.',
      photo: '1559847844-5315695dadae',
      active: 15,
      total: 40,
      servings: 2,
      tastes: ['one-pan', 'fresh'],
      weather: 'any',
    },
    [
      ['Salmon', 'salmon', 300, 'g', MF],
      ['Potatoes', 'potato', 500, 'g', PR],
      ['Zucchini', 'zucchini', 1, 'whole', PR],
      ['Lemon', 'lemon', 1, 'whole', PR],
      ['Olive oil', 'olive oil', 3, 'tbsp', PA],
      ['Garlic', 'garlic', 2, 'clove', PR],
      ['Mustard', 'mustard', 1, 'tbsp', PA],
      ['Honey', 'honey', 1, 'tsp', PA],
      ['Paprika', 'paprika', 1, 'tsp', SP],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      'Heat the oven to 220C. Cut the potatoes into 2 cm chunks and toss on a large tray with two tablespoons of oil, the paprika, garlic and salt.',
      ['Roast the potatoes for 20 minutes until starting to brown.', 20],
      'Mix the mustard, honey, the remaining oil and a squeeze of lemon. Slice the zucchini into half-moons.',
      'Push the potatoes aside, add the zucchini and the salmon, and brush the salmon with the mustard glaze.',
      ['Roast for 12 minutes, until the salmon flakes easily.', 12],
      'Squeeze over the remaining lemon, scatter with parsley and serve from the tray.',
    ]
  ),

  build(
    {
      id: 'r-teriyaki-salmon-rice-bowl',
      title: 'Teriyaki salmon rice bowl',
      description:
        'Glossy soy and honey salmon over rice with cucumber, avocado and pickled ginger crunch.',
      photo: '1540914124281-342587941389',
      active: 20,
      total: 30,
      servings: 2,
      tastes: ['fresh', 'fast'],
      weather: 'any',
    },
    [
      ['Salmon', 'salmon', 300, 'g', MF],
      ['Rice', 'rice', 200, 'g', PA],
      ['Soy sauce', 'soy sauce', 3, 'tbsp', PA],
      ['Honey', 'honey', 1, 'tbsp', PA],
      ['Ginger', 'ginger', 1, 'tbsp', PR],
      ['Garlic', 'garlic', 1, 'clove', PR],
      ['Vinegar', 'vinegar', 1, 'tbsp', PA],
      ['Cucumber', 'cucumber', 1, 'whole', PR],
      ['Avocado', 'avocado', 1, 'whole', PR],
      ['Sesame oil', 'sesame oil', 1, 'tsp', PA],
      ['Scallions', 'scallion', 2, 'whole', PR, true],
    ],
    [
      [
        'Rinse the rice and cook it according to the packet, about 12 minutes, then rest it covered.',
        12,
      ],
      'Stir together the soy sauce, honey, grated ginger and garlic for the glaze.',
      'Slice the cucumber and toss it with the vinegar and a pinch of salt. Slice the avocado.',
      'Pat the salmon dry and cut into four pieces. Sear in a hot oiled pan, skin side down first, for 3 minutes.',
      'Flip the salmon, pour in the glaze and let it bubble.',
      ['Cook for 3 more minutes, spooning the glaze over the fish until sticky.', 3],
      'Spoon the rice into bowls with the salmon, cucumber and avocado. Drizzle with sesame oil and scatter with scallions.',
    ]
  ),

  build(
    {
      id: 'r-garlic-lime-prawn-noodles',
      title: 'Garlic lime prawn noodles',
      description: 'Quick-seared prawns and thin noodles in a sharp lime, soy and chili dressing.',
      photo: '1598515214211-89d3c73ae83b',
      active: 15,
      total: 20,
      servings: 2,
      tastes: ['fast', 'fresh', 'spicy'],
      weather: 'light',
    },
    [
      ['Prawns', 'prawn', 250, 'g', MF],
      ['Noodles', 'noodle', 200, 'g', PA],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Limes', 'lime', 2, 'whole', PR],
      ['Soy sauce', 'soy sauce', 2, 'tbsp', PA],
      ['Honey', 'honey', 1, 'tsp', PA],
      ['Chili flakes', 'chili flake', 0.5, 'tsp', SP],
      ['Carrot', 'carrot', 1, 'whole', PR],
      ['Sesame oil', 'sesame oil', 1, 'tsp', PA],
      ['Cilantro', 'cilantro', 0.5, 'bunch', PR, true],
    ],
    [
      'Whisk the juice of both limes with the soy sauce, honey, sesame oil and chili flakes.',
      [
        'Cook the noodles in boiling water for 4 minutes, then drain and rinse under cold water.',
        4,
      ],
      'Cut the carrot into thin matchsticks. Mince the garlic.',
      'Heat a splash of oil in a hot pan and add the prawns with the garlic.',
      ['Sear for 3 minutes, turning once, until pink and curled.', 3],
      'Toss the noodles, carrot and prawns with the dressing.',
      'Serve at once with cilantro on top.',
    ]
  ),

  build(
    {
      id: 'r-lemon-oregano-chicken-tray-bake',
      title: 'Lemon oregano chicken tray bake',
      description:
        'Crisp-skinned chicken thighs roasted on potatoes and onions, with tomatoes bursting at the end.',
      photo: '1504674900247-0877df9cc836',
      active: 15,
      total: 60,
      servings: 4,
      tastes: ['one-pan', 'cozy'],
      weather: 'warm',
      favorite: true,
    },
    [
      ['Chicken thighs', 'chicken thigh', 800, 'g', MF],
      ['Potatoes', 'potato', 700, 'g', PR],
      ['Onions', 'onion', 2, 'whole', PR],
      ['Garlic', 'garlic', 6, 'clove', PR],
      ['Lemon', 'lemon', 1, 'whole', PR],
      ['Olive oil', 'olive oil', 3, 'tbsp', PA],
      ['Oregano', 'oregano', 2, 'tsp', SP],
      ['Paprika', 'paprika', 1, 'tsp', SP],
      ['Cherry tomatoes', 'cherry tomato', 250, 'g', PR],
      ['Feta', 'feta', 100, 'g', DA, true],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      'Heat the oven to 210C. Cut the potatoes into chunks and the onions into wedges.',
      'Toss the potatoes, onions and whole garlic cloves on a large tray with two tablespoons of oil and half the oregano.',
      'Rub the chicken with the remaining oil, oregano, paprika and plenty of salt. Nestle it skin-side up in the vegetables.',
      'Cut the lemon in half, squeeze one half over the tray and add both halves to the tray.',
      ['Roast for 40 minutes, until the chicken skin is deep golden.', 40],
      ['Scatter the tomatoes over the tray and roast for 10 more minutes until they burst.', 10],
      'Rest for 5 minutes, then top with feta and parsley and squeeze over the roasted lemon.',
    ]
  ),

  build(
    {
      id: 'r-peanut-chicken-noodles',
      title: 'Peanut chicken noodles',
      description:
        'Tender chicken and noodles in a creamy peanut and lime sauce, with crunchy carrot and cucumber.',
      photo: '1529042410759-befb1204b468',
      active: 25,
      total: 30,
      servings: 4,
      tastes: ['spicy', 'fresh', 'fast'],
      weather: 'any',
    },
    [
      ['Chicken breast', 'chicken breast', 400, 'g', MF],
      ['Noodles', 'noodle', 250, 'g', PA],
      ['Peanut butter', 'peanut butter', 3, 'tbsp', PA],
      ['Soy sauce', 'soy sauce', 3, 'tbsp', PA],
      ['Lime', 'lime', 1, 'whole', PR],
      ['Honey', 'honey', 1, 'tbsp', PA],
      ['Ginger', 'ginger', 1, 'tbsp', PR],
      ['Garlic', 'garlic', 2, 'clove', PR],
      ['Carrots', 'carrot', 2, 'whole', PR],
      ['Cucumber', 'cucumber', 1, 'whole', PR],
      ['Chili flakes', 'chili flake', 1, 'tsp', SP],
      ['Scallions', 'scallion', 3, 'whole', PR, true],
    ],
    [
      'Whisk the peanut butter, soy sauce, lime juice, honey, grated ginger, garlic and chili flakes with 4 tablespoons of hot water.',
      'Slice the chicken into thin strips and season with salt. Cut the carrots and cucumber into matchsticks.',
      [
        'Fry the chicken in a hot oiled pan for 8 minutes, turning, until cooked through and golden.',
        8,
      ],
      ['Cook the noodles in boiling water for 4 minutes, then drain.', 4],
      'Toss the noodles and chicken with the peanut sauce, loosening with a splash of water.',
      'Fold through the carrot and cucumber and scatter with scallions.',
    ]
  ),

  build(
    {
      id: 'r-chicken-shawarma-bowls',
      title: 'Chicken shawarma bowls',
      description:
        'Spiced yogurt-marinated chicken over rice with cucumber, tomato and a garlicky tahini drizzle.',
      photo: '1593560708920-61dd98c46a07',
      active: 25,
      total: 50,
      servings: 4,
      tastes: ['fresh', 'big-batch'],
      weather: 'light',
      leftovers: true,
    },
    [
      ['Chicken thighs', 'chicken thigh', 600, 'g', MF],
      ['Yogurt', 'yogurt', 200, 'g', DA],
      ['Cumin', 'cumin', 2, 'tsp', SP],
      ['Paprika', 'paprika', 2, 'tsp', SP],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Lemons', 'lemon', 2, 'whole', PR],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Tahini', 'tahini', 2, 'tbsp', PA],
      ['Cucumber', 'cucumber', 1, 'whole', PR],
      ['Cherry tomatoes', 'cherry tomato', 250, 'g', PR],
      ['Rice', 'rice', 300, 'g', PA],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      'Mix half the yogurt with the cumin, paprika, two crushed garlic cloves, the juice of one lemon, the oil and a good pinch of salt.',
      ['Toss the boneless chicken thighs in the marinade and leave for 15 minutes.', 15],
      'Cook the rice according to the packet.',
      'Heat a heavy pan over medium-high heat and cook the chicken in a single layer.',
      [
        'Cook for 10 minutes, turning once, until charred in places and cooked through. Slice into strips.',
        10,
      ],
      'Stir the tahini, remaining yogurt, remaining garlic and the juice of the second lemon with a splash of water into a sauce.',
      'Chop the cucumber and tomatoes. Build bowls of rice, chicken and salad, then drizzle with the sauce and scatter with parsley.',
    ]
  ),

  build(
    {
      id: 'r-paprika-chicken-and-rice',
      title: 'Paprika chicken and rice',
      description:
        'Browned chicken thighs cooked down with rice, peppers and peas in a single pan.',
      photo: '1432139555190-58524dae6a55',
      active: 20,
      total: 50,
      servings: 4,
      tastes: ['one-pan', 'cozy', 'kid-friendly'],
      weather: 'warm',
    },
    [
      ['Chicken thighs', 'chicken thigh', 600, 'g', MF],
      ['Rice', 'rice', 300, 'g', PA],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Paprika', 'paprika', 2, 'tsp', SP],
      ['Stock', 'stock', 600, 'ml', PA],
      ['Bell peppers', 'bell pepper', 2, 'whole', PR],
      ['Frozen peas', 'frozen pea', 100, 'g', FR],
      ['Lemon', 'lemon', 1, 'whole', PR],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      'Season the chicken with salt, pepper and half the paprika. Dice the onion and slice the peppers.',
      [
        'Brown the chicken in the oil in a wide lidded pan for 8 minutes, skin side down. Set it aside.',
        8,
      ],
      'Cook the onion, peppers and garlic in the chicken fat for 5 minutes, then stir in the rest of the paprika and the rice.',
      'Pour in the stock and bring to a boil, then nestle the chicken back on top.',
      [
        'Cover and simmer on low for 20 minutes, until the rice is tender and the stock absorbed.',
        20,
      ],
      'Scatter the frozen peas over the top, replace the lid and leave off the heat.',
      ['Rest for 5 minutes, then squeeze over the lemon and add parsley.', 5],
    ]
  ),

  build(
    {
      id: 'r-black-bean-beef-chili',
      title: 'Black bean beef chili',
      description:
        'A thick, smoky pot of beef, beans and tomato that tastes even better the next day.',
      photo: '1543339308-43e59d6b73a6',
      active: 20,
      total: 60,
      servings: 4,
      tastes: ['cozy', 'big-batch', 'spicy'],
      weather: 'warm',
      leftovers: true,
    },
    [
      ['Ground beef', 'ground beef', 500, 'g', MF],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 4, 'clove', PR],
      ['Bell pepper', 'bell pepper', 1, 'whole', PR],
      ['Black beans', 'black bean', 2, 'can', PA],
      ['Canned tomatoes', 'canned tomato', 1, 'can', PA],
      ['Stock', 'stock', 300, 'ml', PA],
      ['Cumin', 'cumin', 2, 'tsp', SP],
      ['Paprika', 'paprika', 2, 'tsp', SP],
      ['Chili flakes', 'chili flake', 1, 'tsp', SP],
      ['Cheddar', 'cheddar', 80, 'g', DA, true],
      ['Yogurt', 'yogurt', 4, 'tbsp', DA, true],
    ],
    [
      'Dice the onion and pepper and mince the garlic.',
      [
        'Brown the beef in a large heavy pot over high heat for 8 minutes, breaking it up. Drain off excess fat.',
        8,
      ],
      'Add the onion and pepper and cook for 5 minutes until soft, then stir in the garlic, cumin, paprika and chili flakes for 1 minute.',
      'Pour in the canned tomatoes and stock, add the drained black beans and bring to a boil.',
      [
        'Reduce the heat and simmer, partly covered, for 35 minutes, stirring now and then, until thick.',
        35,
      ],
      'Season well with salt and pepper.',
      'Ladle into bowls and top with grated cheddar and a spoonful of yogurt. Cool leftovers quickly and refrigerate.',
    ]
  ),

  build(
    {
      id: 'r-slow-simmered-beef-ragu',
      title: 'Slow-simmered beef ragu',
      description:
        'Beef, carrot and celery cooked down in tomato until deep and savory, tossed with pasta.',
      photo: '1476124369491-e7addf5db371',
      active: 30,
      total: 90,
      servings: 4,
      tastes: ['cozy', 'big-batch'],
      weather: 'warm',
      leftovers: true,
    },
    [
      ['Ground beef', 'ground beef', 500, 'g', MF],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Carrot', 'carrot', 1, 'whole', PR],
      ['Celery', 'celery', 2, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Canned tomatoes', 'canned tomato', 2, 'can', PA],
      ['Stock', 'stock', 200, 'ml', PA],
      ['Oregano', 'oregano', 2, 'tsp', SP],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Pasta', 'pasta', 350, 'g', PA],
      ['Parmesan', 'parmesan', 40, 'g', DA],
    ],
    [
      'Finely chop the onion, carrot and celery.',
      [
        'Soften the vegetables in the olive oil in a large pot over medium heat for 10 minutes.',
        10,
      ],
      'Push them aside, turn up the heat and brown the beef well, breaking it into small pieces. Add the garlic and oregano.',
      'Add the canned tomatoes and stock, season with salt, and bring to a gentle bubble.',
      ['Simmer, partly covered, for 45 minutes, stirring now and then, until rich and thick.', 45],
      ['Cook the pasta in well-salted water for 10 minutes.', 10],
      'Toss the drained pasta with a generous amount of ragu and serve with grated parmesan.',
      'Freeze any extra sauce in portions for up to 3 months.',
    ]
  ),

  build(
    {
      id: 'r-ginger-pork-stir-fry',
      title: 'Ginger pork stir-fry',
      description:
        'Minced pork browned hard with ginger, garlic and soy, with crunchy peppers over rice.',
      photo: '1484723091739-30a097e8f929',
      active: 20,
      total: 30,
      servings: 4,
      tastes: ['fast', 'spicy', 'kid-friendly'],
      weather: 'any',
    },
    [
      ['Ground pork', 'ground pork', 400, 'g', MF],
      ['Rice', 'rice', 300, 'g', PA],
      ['Ginger', 'ginger', 2, 'tbsp', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Soy sauce', 'soy sauce', 3, 'tbsp', PA],
      ['Honey', 'honey', 1, 'tbsp', PA],
      ['Bell peppers', 'bell pepper', 2, 'whole', PR],
      ['Carrot', 'carrot', 1, 'whole', PR],
      ['Scallions', 'scallion', 3, 'whole', PR],
      ['Sesame oil', 'sesame oil', 1, 'tsp', PA],
      ['Olive oil', 'olive oil', 1, 'tbsp', PA],
      ['Lime', 'lime', 1, 'whole', PR, true],
    ],
    [
      ['Cook the rice according to the packet, about 12 minutes.', 12],
      'Mix the soy sauce, honey and sesame oil. Slice the peppers, carrot and scallions, and grate the ginger.',
      'Heat the oil in a wide pan or wok over high heat.',
      [
        'Add the pork in an even layer and cook, breaking it up, for 6 minutes until well browned.',
        6,
      ],
      'Add the ginger, garlic, peppers and carrot and stir-fry for 3 minutes so the vegetables stay crisp.',
      'Pour in the sauce and let it bubble and coat everything for 1 minute.',
      'Serve over rice with scallions and lime wedges.',
    ]
  ),

  build(
    {
      id: 'r-potato-kale-soup',
      title: 'Potato and kale soup',
      description:
        'A rustic, filling soup of soft potato, paprika and chickpeas, with kale folded in at the end.',
      photo: '1547592166-23ac45744acd',
      active: 20,
      total: 45,
      servings: 4,
      tastes: ['cozy', 'big-batch', 'veg-forward'],
      weather: 'warm',
      leftovers: true,
    },
    [
      ['Potatoes', 'potato', 600, 'g', PR],
      ['Kale', 'kale', 150, 'g', PR],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Carrot', 'carrot', 1, 'whole', PR],
      ['Celery', 'celery', 1, 'whole', PR],
      ['Chickpeas', 'chickpea', 1, 'can', PA],
      ['Stock', 'stock', 1000, 'ml', PA],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Paprika', 'paprika', 1, 'tsp', SP],
      ['Lemon', 'lemon', 0.5, 'whole', PR],
      ['Parmesan', 'parmesan', 30, 'g', DA, true],
    ],
    [
      'Dice the onion, carrot and celery. Peel and cube the potatoes. Strip the kale from its stems and chop it.',
      ['Soften the onion, carrot and celery in the olive oil in a large pot for 8 minutes.', 8],
      'Add the garlic and paprika and stir for 1 minute.',
      'Add the potatoes, drained chickpeas and stock, and bring to a boil.',
      [
        'Simmer for 20 minutes, until the potatoes are very soft. Crush a few against the side of the pot to thicken.',
        20,
      ],
      'Stir in the kale and cook for 3 more minutes.',
      'Season with salt, pepper and lemon juice, then serve with grated parmesan.',
    ]
  ),

  build(
    {
      id: 'r-shakshuka',
      title: 'Shakshuka with feta',
      description: 'Eggs poached in a spiced pepper and tomato sauce, made for tearing bread into.',
      photo: '1540420773420-3366772f4999',
      active: 15,
      total: 30,
      servings: 2,
      tastes: ['one-pan', 'veg-forward', 'spicy'],
      weather: 'any',
    },
    [
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Bell pepper', 'bell pepper', 1, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Cumin', 'cumin', 1, 'tsp', SP],
      ['Paprika', 'paprika', 1, 'tsp', SP],
      ['Chili flakes', 'chili flake', 0.5, 'tsp', SP],
      ['Canned tomatoes', 'canned tomato', 1, 'can', PA],
      ['Eggs', 'egg', 4, 'whole', DA],
      ['Feta', 'feta', 60, 'g', DA],
      ['Bread', 'bread', 4, 'slice', BK],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      'Dice the onion and pepper. Heat the oil in a wide, lidded skillet over medium heat.',
      ['Cook the onion and pepper for 8 minutes until soft.', 8],
      'Add the garlic, cumin, paprika and chili flakes and stir for 1 minute.',
      'Pour in the canned tomatoes, season with salt, and crush them with a spoon.',
      ['Simmer for 10 minutes until the sauce is thick enough to hold a trail.', 10],
      'Make four wells in the sauce and crack an egg into each.',
      ['Cover and cook for 7 minutes, until the whites are set and the yolks are still soft.', 7],
      'Crumble over the feta, add parsley and serve straight from the pan with bread.',
    ]
  ),

  build(
    {
      id: 'r-mushroom-spinach-frittata',
      title: 'Mushroom and spinach frittata',
      description:
        'Browned mushrooms and wilted spinach set in eggs and cheddar, finished under the grill.',
      photo: '1498837167922-ddd27525d352',
      active: 20,
      total: 30,
      servings: 4,
      tastes: ['one-pan', 'veg-forward', 'cozy'],
      weather: 'any',
    },
    [
      ['Eggs', 'egg', 8, 'whole', DA],
      ['Mushrooms', 'mushroom', 250, 'g', PR],
      ['Spinach', 'spinach', 100, 'g', PR],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 1, 'clove', PR],
      ['Cheddar', 'cheddar', 80, 'g', DA],
      ['Yogurt', 'yogurt', 3, 'tbsp', DA],
      ['Olive oil', 'olive oil', 1, 'tbsp', PA],
      ['Butter', 'butter', 1, 'tbsp', DA],
      ['Paprika', 'paprika', 0.5, 'tsp', SP],
    ],
    [
      'Heat the grill. Slice the mushrooms and onion. Beat the eggs with the yogurt, paprika, salt and pepper.',
      'Heat the oil and butter in a 26 cm ovenproof pan over medium-high heat.',
      [
        'Cook the mushrooms and onion for 8 minutes, without moving them too much, until browned.',
        8,
      ],
      'Add the garlic and spinach and stir until the spinach wilts and the pan is fairly dry.',
      'Pour in the eggs, scatter with cheddar and reduce the heat to medium-low.',
      ['Cook for 5 minutes, until the edges are set and the center is still wobbly.', 5],
      ['Slide the pan under the grill for 4 minutes, until puffed and golden.', 4],
      'Rest for 3 minutes, then cut into wedges and serve warm or at room temperature.',
    ]
  ),

  // Added in seed version 2. Existing kitchens get these once, on their next load.
  build(
    {
      id: 'r-chicken-fajitas',
      title: 'Sizzling chicken fajitas',
      description: 'Smoky strips of chicken with soft peppers and onions, wrapped warm with lime.',
      photo: '1788601988443-9b859ba3fdf4',
      active: 20,
      total: 25,
      servings: 4,
      tastes: ['fast', 'kid-friendly', 'one-pan'],
      weather: 'any',
    },
    [
      ['Chicken breasts', 'chicken breast', 500, 'g', MF],
      ['Bell peppers', 'bell pepper', 2, 'whole', PR],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Paprika', 'paprika', 2, 'tsp', SP],
      ['Cumin', 'cumin', 1, 'tsp', SP],
      ['Limes', 'lime', 2, 'whole', PR],
      ['Tortillas', 'tortilla', 8, 'whole', BK],
      ['Sour cream', 'sour cream', 100, 'g', DA, true],
      ['Cilantro', 'cilantro', 0.5, 'bunch', PR, true],
    ],
    [
      'Slice the chicken into thin strips. Slice the peppers and onion.',
      'Toss the chicken with half the oil, the paprika, cumin, a big pinch of salt and the juice of one lime.',
      'Heat a large pan until very hot. Add the rest of the oil and the peppers and onion.',
      [
        'Cook the vegetables for 5 minutes until charred at the edges, then push them to one side.',
        5,
      ],
      [
        'Add the chicken in one layer and cook for 6 minutes, turning once, until cooked through.',
        6,
      ],
      'Warm the tortillas in a dry pan. Cut the second lime into wedges.',
      'Pile everything into the tortillas with sour cream, cilantro and a squeeze of lime.',
    ]
  ),

  build(
    {
      id: 'r-beef-broccoli',
      title: 'Beef and broccoli with rice',
      description:
        'Takeout-style beef and crisp broccoli in a glossy garlic, ginger and soy sauce.',
      photo: '1760504526069-ff0f8bf6e4ca',
      active: 20,
      total: 25,
      servings: 4,
      tastes: ['fast', 'one-pan'],
      weather: 'any',
    },
    [
      ['Steak', 'beef steak', 450, 'g', MF],
      ['Broccoli', 'broccoli', 1, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Ginger', 'ginger', 1, 'tbsp', PR],
      ['Soy sauce', 'soy sauce', 4, 'tbsp', PA],
      ['Honey', 'honey', 1, 'tbsp', PA],
      ['Flour', 'flour', 1, 'tbsp', PA],
      ['Vegetable oil', 'vegetable oil', 2, 'tbsp', PA],
      ['Sesame oil', 'sesame oil', 1, 'tsp', PA],
      ['Rice', 'rice', 300, 'g', PA],
    ],
    [
      [
        'Rinse the rice and cook it with 1.5 times its volume of water, covered, for 15 minutes.',
        15,
      ],
      'Slice the steak very thinly across the grain and toss it with the flour and a pinch of salt.',
      'Cut the broccoli into small florets. Grate the garlic and ginger.',
      'Stir the soy sauce, honey, sesame oil and 4 tbsp water together.',
      [
        'Heat half the oil in a large pan until smoking and sear the beef for 2 minutes. Lift it out.',
        2,
      ],
      [
        'Add the rest of the oil and the broccoli with a splash of water. Cover and cook for 3 minutes.',
        3,
      ],
      'Add the garlic and ginger for 30 seconds, then the sauce and the beef. Bubble until glossy and serve over rice.',
    ]
  ),

  build(
    {
      id: 'r-weeknight-carbonara',
      title: 'Weeknight carbonara',
      description: 'Silky egg and parmesan sauce, crisp bacon and lots of black pepper. No cream.',
      photo: '1633337474564-1d9478ca4e2e',
      active: 15,
      total: 20,
      servings: 4,
      tastes: ['fast', 'cozy', 'kid-friendly'],
      weather: 'any',
    },
    [
      ['Spaghetti', 'pasta', 400, 'g', PA],
      ['Bacon', 'bacon', 200, 'g', MF],
      ['Eggs', 'egg', 3, 'whole', DA],
      ['Parmesan', 'parmesan', 80, 'g', DA],
      ['Black pepper', 'black pepper', 1, 'tsp', SP],
      ['Garlic', 'garlic', 1, 'clove', PR, true],
    ],
    [
      'Bring a big pot of salted water to the boil.',
      'Beat the eggs with the finely grated parmesan and the black pepper.',
      ['Cook the spaghetti for 10 minutes, or 1 minute less than the packet says.', 10],
      'Meanwhile, cut the bacon into strips and fry it slowly with the crushed garlic until crisp. Take the pan off the heat.',
      'Scoop out a mug of pasta water, then drain the pasta and tip it into the bacon pan.',
      'Off the heat, pour in the egg mix with a splash of pasta water and toss fast until creamy, adding more water if it looks thick.',
      'Serve straight away with more parmesan and pepper.',
    ]
  ),

  build(
    {
      id: 'r-cauliflower-chickpea-curry',
      title: 'Cauliflower and chickpea curry',
      description:
        'Golden cauliflower and chickpeas in a mild coconut tomato sauce. Even better tomorrow.',
      photo: '1695720247911-817755ad7d02',
      active: 15,
      total: 40,
      servings: 4,
      tastes: ['cozy', 'veg-forward', 'big-batch'],
      weather: 'warm',
      leftovers: true,
    },
    [
      ['Vegetable oil', 'vegetable oil', 2, 'tbsp', PA],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Ginger', 'ginger', 1, 'tbsp', PR],
      ['Cumin', 'cumin', 2, 'tsp', SP],
      ['Paprika', 'paprika', 1, 'tsp', SP],
      ['Cauliflower', 'cauliflower', 1, 'whole', PR],
      ['Chickpeas', 'chickpea', 1, 'can', PA],
      ['Canned tomatoes', 'canned tomato', 1, 'can', PA],
      ['Coconut milk', 'coconut milk', 1, 'can', PA],
      ['Rice', 'rice', 300, 'g', PA],
      ['Cilantro', 'cilantro', 0.5, 'bunch', PR, true],
    ],
    [
      'Chop the onion. Grate the garlic and ginger. Cut the cauliflower into small florets.',
      ['Soften the onion in the oil with a pinch of salt for 6 minutes.', 6],
      'Stir in the garlic, ginger, cumin and paprika for 1 minute.',
      'Add the cauliflower, drained chickpeas, tomatoes and coconut milk. Season well.',
      ['Simmer with the lid half on for 25 minutes until the cauliflower is tender.', 25],
      ['Meanwhile, cook the rice with 1.5 times its volume of water, covered, for 15 minutes.', 15],
      'Taste for salt and serve over the rice with cilantro.',
    ]
  ),

  build(
    {
      id: 'r-sausage-potato-traybake',
      title: 'Sausage, potato and green bean tray bake',
      description: 'Everything roasts together on one tray, with a sticky honey mustard glaze.',
      photo: '1523813301608-f54a198f6b5f',
      active: 10,
      total: 45,
      servings: 4,
      tastes: ['one-pan', 'cozy', 'kid-friendly'],
      weather: 'warm',
    },
    [
      ['Sausages', 'sausage', 8, 'whole', MF],
      ['Potatoes', 'potato', 700, 'g', PR],
      ['Green beans', 'green bean', 250, 'g', PR],
      ['Red onion', 'onion', 1, 'whole', PR],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Mustard', 'mustard', 2, 'tbsp', PA],
      ['Honey', 'honey', 1, 'tbsp', PA],
    ],
    [
      'Heat the oven to 220C. Cut the potatoes into bite-size chunks and the onion into wedges.',
      'Toss the potatoes and onion with the oil and salt on a large tray.',
      ['Roast for 15 minutes.', 15],
      'Add the sausages and the green beans to the tray and toss everything in the oil.',
      ['Roast for 20 minutes more, until the sausages are browned.', 20],
      'Stir the mustard and honey together, brush over the sausages and roast for 5 more minutes.',
    ]
  ),

  build(
    {
      id: 'r-prawn-tacos-slaw',
      title: 'Prawn tacos with lime slaw',
      description: 'Garlicky chili prawns on warm tortillas with a crunchy, tangy cabbage slaw.',
      photo: '1689774329109-9b70beeefc0a',
      active: 20,
      total: 20,
      servings: 4,
      tastes: ['fast', 'fresh', 'spicy'],
      weather: 'light',
    },
    [
      ['Prawns', 'prawn', 400, 'g', MF],
      ['Cabbage', 'cabbage', 0.25, 'whole', PR],
      ['Limes', 'lime', 2, 'whole', PR],
      ['Sour cream', 'sour cream', 100, 'g', DA],
      ['Garlic', 'garlic', 2, 'clove', PR],
      ['Chili flakes', 'chili flake', 1, 'tsp', SP],
      ['Paprika', 'paprika', 1, 'tsp', SP],
      ['Olive oil', 'olive oil', 2, 'tbsp', PA],
      ['Tortillas', 'tortilla', 8, 'whole', BK],
      ['Cilantro', 'cilantro', 0.5, 'bunch', PR, true],
    ],
    [
      'Shred the cabbage finely and toss it with the juice of one lime and a pinch of salt.',
      'Stir the sour cream with a squeeze of lime to make a quick sauce.',
      'Toss the prawns with the crushed garlic, chili flakes, paprika and a pinch of salt.',
      [
        'Heat the oil in a large pan and cook the prawns for 3 minutes, turning once, until pink.',
        3,
      ],
      'Warm the tortillas in a dry pan.',
      'Fill with slaw and prawns, add a spoon of the lime cream and scatter with cilantro.',
    ]
  ),

  build(
    {
      id: 'r-pork-chops-apples',
      title: 'Pork chops with apples and mustard',
      description: 'Golden pork chops with soft, buttery apples and onion in a mustard pan sauce.',
      photo: '1652209898504-ea7f96b44580',
      active: 20,
      total: 30,
      servings: 4,
      tastes: ['cozy', 'one-pan'],
      weather: 'warm',
    },
    [
      ['Pork chops', 'pork chop', 4, 'whole', MF],
      ['Apples', 'apple', 2, 'whole', PR],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Butter', 'butter', 2, 'tbsp', DA],
      ['Mustard', 'mustard', 1, 'tbsp', PA],
      ['Stock', 'stock', 200, 'ml', PA],
      ['Olive oil', 'olive oil', 1, 'tbsp', PA],
      ['Potatoes', 'potato', 600, 'g', PR, true],
    ],
    [
      ['If serving potatoes, boil them in salted water for 20 minutes until tender.', 20],
      'Pat the pork chops dry and season both sides with salt and pepper.',
      [
        'Heat the oil in a large pan and brown the chops for 4 minutes per side. Lift them out to rest.',
        4,
      ],
      'Slice the apples and onion. Melt the butter in the same pan.',
      ['Cook the apples and onion for 6 minutes until soft and golden.', 6],
      'Stir in the mustard and stock and bubble for 2 minutes. Return the chops and their juices to warm through.',
      'Serve with the potatoes and spoon the apples and sauce over the top.',
    ]
  ),

  build(
    {
      id: 'r-baked-eggplant-mozzarella',
      title: 'Baked eggplant with tomato and mozzarella',
      description:
        'A lighter, no-fry eggplant parmesan: roasted slices layered with tomato and cheese.',
      photo: '1632229095740-8c75082087c5',
      active: 20,
      total: 55,
      servings: 4,
      tastes: ['cozy', 'veg-forward', 'big-batch'],
      weather: 'warm',
      leftovers: true,
    },
    [
      ['Eggplants', 'eggplant', 2, 'whole', PR],
      ['Olive oil', 'olive oil', 3, 'tbsp', PA],
      ['Garlic', 'garlic', 2, 'clove', PR],
      ['Canned tomatoes', 'canned tomato', 2, 'can', PA],
      ['Oregano', 'oregano', 1, 'tsp', SP],
      ['Mozzarella', 'mozzarella', 250, 'g', DA],
      ['Parmesan', 'parmesan', 50, 'g', DA],
      ['Bread', 'bread', 4, 'slice', BK, true],
    ],
    [
      'Heat the oven to 220C. Slice the eggplants into 1 cm rounds.',
      [
        'Brush the slices with most of the oil, season, and roast on two trays for 20 minutes until soft.',
        20,
      ],
      [
        'Meanwhile, cook the sliced garlic in the remaining oil, add the tomatoes and oregano and simmer for 15 minutes.',
        15,
      ],
      'Layer the eggplant, sauce and torn mozzarella in a baking dish, ending with sauce and cheese.',
      'Scatter the grated parmesan over the top. Turn the oven down to 200C.',
      ['Bake for 20 minutes until bubbling and golden.', 20],
      'Rest for 5 minutes and serve with bread to mop up the sauce.',
    ]
  ),

  build(
    {
      id: 'r-chicken-noodle-soup',
      title: 'Chicken noodle soup',
      description:
        'The bowl you want when it rains or someone is sniffling. Simple, clear and comforting.',
      photo: '1555126634-323283e090fa',
      active: 15,
      total: 40,
      servings: 4,
      tastes: ['cozy', 'kid-friendly', 'big-batch'],
      weather: 'warm',
      leftovers: true,
    },
    [
      ['Chicken thighs', 'chicken thigh', 500, 'g', MF],
      ['Carrots', 'carrot', 2, 'whole', PR],
      ['Celery', 'celery', 2, 'whole', PR],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 2, 'clove', PR],
      ['Olive oil', 'olive oil', 1, 'tbsp', PA],
      ['Stock', 'stock', 1.5, 'l', PA],
      ['Egg noodles', 'noodle', 150, 'g', PA],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      'Dice the carrots, celery and onion. Slice the garlic.',
      ['Soften the vegetables in the oil in a large pot for 6 minutes.', 6],
      'Add the garlic, the whole chicken thighs and the stock. Bring to a simmer.',
      ['Simmer gently for 20 minutes until the chicken is cooked through.', 20],
      'Lift out the chicken and shred it with two forks.',
      ['Add the noodles to the pot and cook for 5 minutes, then return the chicken.', 5],
      'Season well with salt and pepper and scatter with chopped parsley.',
    ]
  ),

  build(
    {
      id: 'r-black-bean-burrito-bowls',
      title: 'Black bean burrito bowls',
      description: 'Cumin rice, black beans, sweet corn and a quick tomato salsa. Build your own.',
      photo: '1520066391310-428f06ebd602',
      active: 20,
      total: 25,
      servings: 4,
      tastes: ['veg-forward', 'fresh', 'kid-friendly'],
      weather: 'light',
    },
    [
      ['Rice', 'rice', 300, 'g', PA],
      ['Cumin', 'cumin', 1, 'tsp', SP],
      ['Black beans', 'black bean', 2, 'can', PA],
      ['Sweetcorn', 'corn', 1, 'can', PA],
      ['Tomatoes', 'tomato', 3, 'whole', PR],
      ['Red onion', 'onion', 0.5, 'whole', PR],
      ['Limes', 'lime', 2, 'whole', PR],
      ['Avocado', 'avocado', 1, 'whole', PR],
      ['Cheddar', 'cheddar', 100, 'g', DA, true],
      ['Cilantro', 'cilantro', 0.5, 'bunch', PR, true],
    ],
    [
      [
        'Cook the rice with the cumin, a pinch of salt and 1.5 times its volume of water, covered, for 15 minutes.',
        15,
      ],
      'Warm the drained black beans and corn in a small pan with a pinch of salt.',
      'Dice the tomatoes and onion finely and stir with the juice of one lime and some chopped cilantro.',
      'Slice the avocado and grate the cheese.',
      'Fluff the rice with the juice of the second lime.',
      'Set everything out and let everyone build their own bowl.',
    ]
  ),

  build(
    {
      id: 'r-mushroom-risotto',
      title: 'Creamy mushroom risotto',
      description: 'Golden mushrooms stirred into soft, savory rice with butter and parmesan.',
      photo: '1680420574628-225def8eea0a',
      active: 35,
      total: 40,
      servings: 4,
      tastes: ['cozy', 'veg-forward'],
      weather: 'warm',
    },
    [
      ['Mushrooms', 'mushroom', 400, 'g', PR],
      ['Onion', 'onion', 1, 'whole', PR],
      ['Garlic', 'garlic', 2, 'clove', PR],
      ['Butter', 'butter', 3, 'tbsp', DA],
      ['Olive oil', 'olive oil', 1, 'tbsp', PA],
      ['Risotto rice', 'rice', 300, 'g', PA],
      ['Stock', 'stock', 1.2, 'l', PA],
      ['Parmesan', 'parmesan', 60, 'g', DA],
      ['Parsley', 'parsley', 0.5, 'bunch', PR, true],
    ],
    [
      'Keep the stock warm in a small pan. Slice the mushrooms and finely chop the onion and garlic.',
      [
        'Fry the mushrooms in the oil and 1 tbsp butter over high heat for 6 minutes until golden. Set aside.',
        6,
      ],
      ['In the same pan, soften the onion and garlic in another 1 tbsp butter for 5 minutes.', 5],
      'Stir in the rice for 1 minute until it looks glassy.',
      [
        'Add the stock a ladle at a time, stirring, letting each one soak in, for about 18 minutes.',
        18,
      ],
      'When the rice is tender but still has a little bite, stir in the mushrooms, the last of the butter and the parmesan.',
      'Rest for 2 minutes with the lid on, then serve with parsley and more parmesan.',
    ]
  ),

  build(
    {
      id: 'r-pork-cabbage-noodles',
      title: 'Pork and cabbage noodles',
      description:
        'Savory ground pork and sweet, wilted cabbage tossed with noodles, ginger and soy.',
      photo: '1585032226651-759b368d7246',
      active: 20,
      total: 20,
      servings: 4,
      tastes: ['fast', 'one-pan'],
      weather: 'any',
    },
    [
      ['Egg noodles', 'noodle', 300, 'g', PA],
      ['Ground pork', 'ground pork', 400, 'g', MF],
      ['Cabbage', 'cabbage', 0.5, 'whole', PR],
      ['Garlic', 'garlic', 3, 'clove', PR],
      ['Ginger', 'ginger', 1, 'tbsp', PR],
      ['Soy sauce', 'soy sauce', 4, 'tbsp', PA],
      ['Vegetable oil', 'vegetable oil', 1, 'tbsp', PA],
      ['Sesame oil', 'sesame oil', 1, 'tsp', PA],
      ['Scallions', 'scallion', 4, 'whole', PR],
      ['Chili flakes', 'chili flake', 0.5, 'tsp', SP, true],
    ],
    [
      ['Cook the noodles for 4 minutes, then drain and rinse under cold water.', 4],
      'Shred the cabbage. Grate the garlic and ginger. Slice the scallions.',
      ['Heat the oil in a large pan and brown the pork for 5 minutes, breaking it up.', 5],
      'Add the garlic and ginger for 30 seconds.',
      ['Add the cabbage and cook for 4 minutes until wilted and sweet.', 4],
      'Toss in the noodles, soy sauce and sesame oil until everything is hot and coated.',
      'Serve with the scallions and chili flakes on top.',
    ]
  ),

  build(
    {
      id: 'r-greek-chicken-couscous',
      title: 'Greek chicken couscous bowls',
      description:
        'Lemon oregano chicken over fluffy couscous with cucumber, tomato, feta and yogurt.',
      photo: '1626901148200-0e934140a02b',
      active: 20,
      total: 25,
      servings: 4,
      tastes: ['fresh', 'fast'],
      weather: 'light',
    },
    [
      ['Chicken breasts', 'chicken breast', 500, 'g', MF],
      ['Lemon', 'lemon', 1, 'whole', PR],
      ['Oregano', 'oregano', 2, 'tsp', SP],
      ['Olive oil', 'olive oil', 3, 'tbsp', PA],
      ['Couscous', 'couscous', 250, 'g', PA],
      ['Cucumber', 'cucumber', 1, 'whole', PR],
      ['Cherry tomatoes', 'cherry tomato', 250, 'g', PR],
      ['Feta', 'feta', 100, 'g', DA],
      ['Yogurt', 'yogurt', 150, 'g', DA],
    ],
    [
      'Cut the chicken into chunks and toss with half the oil, the oregano, the zest and half the juice of the lemon, and salt.',
      'Pour 300 ml boiling water over the couscous with a pinch of salt, cover and leave for 5 minutes.',
      ['Cook the chicken in a hot pan for 8 minutes, turning, until golden and cooked through.', 8],
      'Dice the cucumber and halve the tomatoes. Toss with the rest of the oil and lemon juice.',
      'Fluff the couscous with a fork.',
      'Fill bowls with couscous, salad and chicken. Crumble over the feta and add a spoon of yogurt.',
    ]
  ),

  build(
    {
      id: 'r-banana-oat-pancakes',
      title: 'Banana oat pancakes',
      description:
        'Breakfast for dinner: soft, golden pancakes with banana and a drizzle of maple.',
      photo: '1528207776546-365bb710ee93',
      active: 20,
      total: 25,
      servings: 4,
      tastes: ['kid-friendly', 'fast'],
      weather: 'any',
    },
    [
      ['Bananas', 'banana', 3, 'whole', PR],
      ['Eggs', 'egg', 2, 'whole', DA],
      ['Milk', 'milk', 250, 'ml', DA],
      ['Flour', 'flour', 150, 'g', PA],
      ['Oats', 'oat', 80, 'g', PA],
      ['Butter', 'butter', 2, 'tbsp', DA],
      ['Maple syrup', 'maple syrup', 4, 'tbsp', PA],
      ['Yogurt', 'yogurt', 150, 'g', DA, true],
    ],
    [
      'Mash two of the bananas in a big bowl. Whisk in the eggs and milk.',
      'Stir in the flour, oats, a pinch of salt and 2 tsp baking powder if you have it. Rest for 5 minutes.',
      'Melt a little butter in a nonstick pan over medium heat.',
      [
        'Pour in small ladles of batter and cook for 2 minutes until bubbles appear, then flip for 1 minute more.',
        2,
      ],
      'Keep the pancakes warm on a plate under a tea towel while you cook the rest.',
      'Serve with the last banana sliced, a spoon of yogurt and the maple syrup.',
    ]
  ),

  build(
    {
      id: 'r-corn-zucchini-fritters',
      title: 'Corn and zucchini fritters',
      description:
        'Crisp, golden little fritters full of sweet corn and zucchini, with a cool yogurt dip.',
      photo: '1607095591644-9f97a2099c92',
      active: 25,
      total: 30,
      servings: 4,
      tastes: ['veg-forward', 'fresh', 'kid-friendly'],
      weather: 'light',
    },
    [
      ['Zucchini', 'zucchini', 2, 'whole', PR],
      ['Sweetcorn', 'corn', 1, 'can', PA],
      ['Eggs', 'egg', 2, 'whole', DA],
      ['Flour', 'flour', 100, 'g', PA],
      ['Feta', 'feta', 100, 'g', DA],
      ['Scallions', 'scallion', 3, 'whole', PR],
      ['Vegetable oil', 'vegetable oil', 4, 'tbsp', PA],
      ['Yogurt', 'yogurt', 150, 'g', DA],
      ['Lemon', 'lemon', 1, 'whole', PR],
    ],
    [
      'Grate the zucchini, sprinkle with salt and leave for 5 minutes, then squeeze out as much water as you can.',
      'Mix the zucchini with the drained corn, eggs, flour, crumbled feta and sliced scallions.',
      'Stir the yogurt with the zest and a squeeze of the lemon and a pinch of salt.',
      'Heat a thin layer of oil in a large nonstick pan over medium-high heat.',
      [
        'Drop in spoonfuls of the mix, flatten, and fry for 3 minutes per side until deep golden.',
        3,
      ],
      'Drain on paper and serve hot with the lemon yogurt.',
    ]
  ),

  build(
    {
      id: 'r-stovetop-mac-cheese',
      title: 'Stovetop mac and cheese',
      description:
        'Real cheese sauce, made in the time it takes the pasta to cook. One pot, no oven.',
      photo: '1667499989723-c4ab9549d63c',
      active: 20,
      total: 20,
      servings: 4,
      tastes: ['kid-friendly', 'cozy', 'fast'],
      weather: 'warm',
    },
    [
      ['Macaroni', 'pasta', 350, 'g', PA],
      ['Butter', 'butter', 3, 'tbsp', DA],
      ['Flour', 'flour', 3, 'tbsp', PA],
      ['Milk', 'milk', 600, 'ml', DA],
      ['Cheddar', 'cheddar', 200, 'g', DA],
      ['Mustard', 'mustard', 1, 'tsp', PA],
      ['Frozen peas', 'frozen pea', 150, 'g', FR, true],
    ],
    [
      [
        'Cook the macaroni in salted water for 8 minutes, adding the peas for the last 2 minutes if using.',
        8,
      ],
      'Meanwhile, melt the butter in a pan, stir in the flour and cook for 1 minute.',
      'Whisk in the milk a little at a time until smooth.',
      ['Simmer, stirring, for 4 minutes until it coats the back of a spoon.', 4],
      'Take the sauce off the heat and stir in the grated cheddar and mustard. Season.',
      'Drain the pasta and fold it through the sauce. Serve hot.',
    ]
  ),
]

/** Recipes added in each seed version, oldest first. */
export const seedAdded: Record<number, string[]> = {
  2: [
    'r-chicken-fajitas',
    'r-beef-broccoli',
    'r-weeknight-carbonara',
    'r-cauliflower-chickpea-curry',
    'r-sausage-potato-traybake',
    'r-prawn-tacos-slaw',
    'r-pork-chops-apples',
    'r-baked-eggplant-mozzarella',
    'r-chicken-noodle-soup',
    'r-black-bean-burrito-bowls',
    'r-mushroom-risotto',
    'r-pork-cabbage-noodles',
    'r-greek-chicken-couscous',
    'r-banana-oat-pancakes',
    'r-corn-zucchini-fritters',
    'r-stovetop-mac-cheese',
  ],
}
