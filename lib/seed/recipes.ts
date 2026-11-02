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
      tastes: ['spicy', 'fresh', 'kid-friendly'],
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
]
