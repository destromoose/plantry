import Foundation

// Domain types for Plantry. Plain Codable values, mirroring the web app's
// lib/types.ts key for key, so one JSON export moves between the two apps.
// SwiftData models in Data/Models.swift wrap these for persistence.

enum Taste: String, Codable, CaseIterable, Identifiable, Sendable {
    case cozy, fresh, fast
    case onePan = "one-pan"
    case vegForward = "veg-forward"
    case spicy
    case bigBatch = "big-batch"
    case kidFriendly = "kid-friendly"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cozy: "Cozy"
        case .fresh: "Fresh"
        case .fast: "Fast"
        case .onePan: "One pan"
        case .vegForward: "Veg-forward"
        case .spicy: "Spicy"
        case .bigBatch: "Big batch"
        case .kidFriendly: "Kid-friendly"
        }
    }

    var hint: String {
        switch self {
        case .cozy: "braises, soups, bakes"
        case .fresh: "herbs, citrus, crunch"
        case .fast: "on the table in 20"
        case .onePan: "less washing up"
        case .vegForward: "plants do the work"
        case .spicy: "bring the chili"
        case .bigBatch: "cook once, eat twice"
        case .kidFriendly: "nobody pushes it around the plate"
        }
    }
}

enum PantryZone: String, Codable, CaseIterable, Identifiable, Sendable {
    case fridge, freezer, cupboard, counter
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum Aisle: String, Codable, CaseIterable, Identifiable, Sendable {
    case produce, dairy
    case meatFish = "meat-fish"
    case bakery, pantry, frozen, spices, drinks, other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .meatFish: "Meat and fish"
        default: rawValue.capitalized
        }
    }

    /// Aisles whose items go off and get used up when a recipe is cooked.
    var isPerishable: Bool {
        switch self {
        case .produce, .meatFish, .dairy, .bakery: true
        default: false
        }
    }
}

enum WeatherLean: String, Codable, Sendable {
    case warm, light, any
}

struct Ingredient: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    /// Normalized lowercase key used to match against pantry items, e.g. "lime".
    var key: String
    var quantity: Double
    var unit: String
    var aisle: Aisle
    var optional: Bool?

    var isOptional: Bool { optional ?? false }
}

struct Step: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var text: String
    /// Minutes, when the step contains a timer ("simmer 12 minutes").
    var timerMinutes: Int?
    /// Safety note shown on the step, e.g. "The pan handle gets hot."
    var caution: String?
}

struct Recipe: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var title: String
    var description: String
    var imageUrl: String?
    /// Hands-on minutes.
    var activeMinutes: Int
    /// Total minutes including passive time.
    var totalMinutes: Int
    var servings: Int
    var ingredients: [Ingredient]
    var steps: [Step]
    var tastes: [Taste]
    var weather: WeatherLean?
    var leftovers: Bool?
    var source: String?
    var sourceUrl: String?
    var isFavorite: Bool
    var createdAt: String
    var custom: Bool?

    var makesLeftovers: Bool { leftovers ?? false }
    var isCustom: Bool { custom ?? false }
    var requiredIngredients: [Ingredient] { ingredients.filter { !$0.isOptional } }
}

struct PantryItem: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var key: String
    var zone: PantryZone
    var aisle: Aisle
    var quantity: Double?
    var unit: String?
    /// ISO date the item was added or last restocked.
    var addedAt: String
    /// Days before the item should be used.
    var softLifeDays: Int
    var staple: Bool?

    var isStaple: Bool { staple ?? false }
}

enum MealSlot: String, Codable, CaseIterable, Sendable {
    case breakfast, lunch, dinner

    var label: String {
        switch self {
        case .breakfast: "Breakfast"
        case .lunch: "Lunch"
        case .dinner: "Dinner"
        }
    }
}

struct PlanEntry: Codable, Identifiable, Hashable, Sendable {
    var id: String
    /// ISO date, YYYY-MM-DD.
    var date: String
    var slot: MealSlot
    var recipeId: String?
    /// A leftovers entry points at the recipe it came from.
    var leftoversOf: String?
    /// Free text when there is no recipe ("Takeout").
    var note: String?
    var servings: Int?
    /// Household member id who claimed the night.
    var cookId: String?
    var done: Bool?

    var isDone: Bool { done ?? false }
    /// True when the night has an answer: a recipe, leftovers, or a note.
    var isDecided: Bool { recipeId != nil || leftoversOf != nil || (note?.isEmpty == false) }
}

struct ShopItem: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var key: String
    var quantity: Double?
    var unit: String?
    var aisle: Aisle
    var checked: Bool
    var fromRecipeIds: [String]
    /// Extra amounts in units that can't be added to the first (350 g + 2 tbsp).
    var more: [Amount]?
    /// Who put it on the list, and when.
    var addedBy: String?
    var addedAt: String?
    /// Who put it in the basket.
    var checkedBy: String?
    /// Added because someone used the last of it in the pantry.
    var usedUp: Bool?
    /// Whose part of a split list it is.
    var splitTo: String?

    var amounts: [Amount] {
        (quantity.map { [Amount(quantity: $0, unit: unit ?? "")] } ?? []) + (more ?? [])
    }
}

enum MemberColor: String, Codable, CaseIterable, Sendable {
    case terracotta, saffron, sage, plum
}

struct Member: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var color: MemberColor
    var isMe: Bool?
    /// Allergens this person must never be served.
    var avoid: [String]?
    /// Diet this person follows.
    var diet: String?
    /// False for someone who eats but doesn't cook, like a small child.
    var cooks: Bool?
}

enum Energy: String, Codable, CaseIterable, Identifiable, Sendable {
    case upForIt = "up-for-it"
    case quick
    case cantTonight = "cant-tonight"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .upForIt: "Up for it"
        case .quick: "Something quick"
        case .cantTonight: "Can't tonight"
        }
    }

    var hint: String {
        switch self {
        case .upForIt: "Happy to cook 40 min"
        case .quick: "20 minutes, tops"
        case .cantTonight: "And that's fine"
        }
    }
}

enum Mood: String, Codable, CaseIterable, Sendable {
    case dawn, day, dusk, night
}

enum MoodSetting: String, Codable, CaseIterable, Identifiable, Sendable {
    case auto, system, dawn, day, dusk, night
    var id: String { rawValue }
    var label: String {
        switch self {
        case .auto: "Follow the day"
        case .system: "Match my phone"
        default: rawValue.capitalized
        }
    }
}

enum MotionSetting: String, Codable, CaseIterable, Identifiable, Sendable {
    case system, on, off
    var id: String { rawValue }
    var label: String {
        switch self {
        case .system: "System"
        case .on: "Reduced"
        case .off: "Full"
        }
    }
}

enum Units: String, Codable, CaseIterable, Identifiable, Sendable {
    case metric, imperial
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum HouseholdWord: String, Codable, CaseIterable, Identifiable, Sendable {
    case household, family, home
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

struct Settings: Codable, Hashable, Sendable {
    var onboarded: Bool = false
    var mood: MoodSetting = .auto
    var reducedMotion: MotionSetting = .system
    var units: Units = .metric
    var tastes: [Taste] = []
    var weatherEnabled: Bool = false
    var householdWord: HouseholdWord = .household
    /// How many people dinner is usually for.
    var cookingFor: Int = 2
    /// Allergens and diets the whole household avoids (see Diet).
    var avoid: [String] = []
    /// Show ask-a-grown-up notes on hot and sharp steps.
    var cookingWithKids: Bool = false

    enum CodingKeys: String, CodingKey { case onboarded, mood, reducedMotion, units, tastes, weatherEnabled, householdWord, cookingFor, avoid, cookingWithKids }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        onboarded = try c.decodeIfPresent(Bool.self, forKey: .onboarded) ?? false
        mood = try c.decodeIfPresent(MoodSetting.self, forKey: .mood) ?? .auto
        reducedMotion = try c.decodeIfPresent(MotionSetting.self, forKey: .reducedMotion) ?? .system
        units = try c.decodeIfPresent(Units.self, forKey: .units) ?? .metric
        tastes = try c.decodeIfPresent([Taste].self, forKey: .tastes) ?? []
        weatherEnabled = try c.decodeIfPresent(Bool.self, forKey: .weatherEnabled) ?? false
        householdWord = try c.decodeIfPresent(HouseholdWord.self, forKey: .householdWord) ?? .household
        cookingFor = try c.decodeIfPresent(Int.self, forKey: .cookingFor) ?? 2
        avoid = try c.decodeIfPresent([String].self, forKey: .avoid) ?? []
        cookingWithKids = try c.decodeIfPresent(Bool.self, forKey: .cookingWithKids) ?? false
    }
}

struct Weather: Codable, Hashable, Sendable {
    var tempC: Double
    var precipitation: Bool
    var fetchedAt: String
}

enum Nudge: String, Sendable {
    case planWeek = "plan-week"
    case defrost
    case startNow = "start-now"
    case leftovers
    case none
}

/// What the adaptive context engine knows about right now.
struct AppContext: Hashable, Sendable {
    var now: Date
    var mood: Mood
    var hour: Int
    var isWeekend: Bool
    /// The date whose dinner the Tonight screen is about. After 9 pm this is tomorrow.
    var targetDate: String
    var targetLabel: String
    /// True when Tonight jumped to tomorrow and can be asked to stay on today.
    var canStayTonight: Bool = false
    var weather: Weather?
    var weatherLean: WeatherLean
    var nudge: Nudge
    var reason: String
}

struct Handoff: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var date: String
    var fromId: String
    var toId: String
    var recipeId: String?
    var message: String?
    var createdAt: String
    var accepted: Bool?
}

struct CookedEntry: Codable, Hashable, Sendable {
    var recipeId: String
    var date: String
    var cookId: String?
    /// "loved", "fine" or "not-again", set by the web app. Carried through untouched.
    var rating: String?
    var note: String?
}
