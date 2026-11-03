import Foundation
import SwiftData

// SwiftData models. Each wraps one Core value type so persistence, export and
// the pure engines all speak the same shape. Ingredients and steps are stored
// as Codable arrays on the recipe (a recipe is always read whole).

@Model
final class RecipeModel {
    @Attribute(.unique) var id: String
    var title: String
    var summary: String
    var imageUrl: String?
    var activeMinutes: Int
    var totalMinutes: Int
    var servings: Int
    var ingredients: [Ingredient]
    var steps: [Step]
    var tastes: [Taste]
    var weather: WeatherLean?
    var leftovers: Bool
    var source: String?
    var sourceUrl: String?
    var isFavorite: Bool
    var createdAt: String
    var custom: Bool

    init(_ r: Recipe) {
        id = r.id
        title = r.title
        summary = r.description
        imageUrl = r.imageUrl
        activeMinutes = r.activeMinutes
        totalMinutes = r.totalMinutes
        servings = r.servings
        ingredients = r.ingredients
        steps = r.steps
        tastes = r.tastes
        weather = r.weather
        leftovers = r.makesLeftovers
        source = r.source
        sourceUrl = r.sourceUrl
        isFavorite = r.isFavorite
        createdAt = r.createdAt
        custom = r.isCustom
    }

    var value: Recipe {
        Recipe(id: id, title: title, description: summary, imageUrl: imageUrl, activeMinutes: activeMinutes,
               totalMinutes: totalMinutes, servings: servings, ingredients: ingredients, steps: steps, tastes: tastes,
               weather: weather, leftovers: leftovers ? true : nil, source: source, sourceUrl: sourceUrl,
               isFavorite: isFavorite, createdAt: createdAt, custom: custom ? true : nil)
    }

    func apply(_ r: Recipe) {
        title = r.title; summary = r.description; imageUrl = r.imageUrl
        activeMinutes = r.activeMinutes; totalMinutes = r.totalMinutes; servings = r.servings
        ingredients = r.ingredients; steps = r.steps; tastes = r.tastes; weather = r.weather
        leftovers = r.makesLeftovers; source = r.source; sourceUrl = r.sourceUrl
        isFavorite = r.isFavorite; createdAt = r.createdAt; custom = r.isCustom
    }

    var requiredIngredients: [Ingredient] { ingredients.filter { !$0.isOptional } }
}

@Model
final class PantryItemModel {
    @Attribute(.unique) var id: String
    var name: String
    var key: String
    var zone: PantryZone
    var aisle: Aisle
    var quantity: Double?
    var unit: String?
    var addedAt: String
    var softLifeDays: Int
    var staple: Bool

    init(_ p: PantryItem) {
        id = p.id; name = p.name; key = p.key; zone = p.zone; aisle = p.aisle
        quantity = p.quantity; unit = p.unit; addedAt = p.addedAt; softLifeDays = p.softLifeDays; staple = p.isStaple
    }

    var value: PantryItem {
        PantryItem(id: id, name: name, key: key, zone: zone, aisle: aisle, quantity: quantity, unit: unit,
                   addedAt: addedAt, softLifeDays: softLifeDays, staple: staple ? true : nil)
    }

    /// 1 is just bought, 0 is past its soft life. One rule for the Pantry and suggestions.
    func freshness(today: String) -> Double { freshnessOf(addedAt: addedAt, softLifeDays: softLifeDays, today: today) }
    func isUseSoon(today: String) -> Bool { freshness(today: today) < useSoonThreshold }
}

@Model
final class PlanEntryModel {
    @Attribute(.unique) var id: String
    var date: String
    var slot: MealSlot
    var recipeId: String?
    var leftoversOf: String?
    var note: String?
    var servings: Int?
    var cookId: String?
    var done: Bool

    init(_ p: PlanEntry) {
        id = p.id; date = p.date; slot = p.slot; recipeId = p.recipeId; leftoversOf = p.leftoversOf
        note = p.note; servings = p.servings; cookId = p.cookId; done = p.isDone
    }

    var value: PlanEntry {
        PlanEntry(id: id, date: date, slot: slot, recipeId: recipeId, leftoversOf: leftoversOf, note: note,
                  servings: servings, cookId: cookId, done: done ? true : nil)
    }

    var isDecided: Bool { recipeId != nil || leftoversOf != nil || (note?.isEmpty == false) }
    var hasMeal: Bool { recipeId != nil || leftoversOf != nil }
}

@Model
final class ShopItemModel {
    @Attribute(.unique) var id: String
    var name: String
    var key: String
    var quantity: Double?
    var unit: String?
    var aisle: Aisle
    var checked: Bool
    var fromRecipeIds: [String]
    var order: Int
    /// Extra amounts in units that can't be added to the first (350 g + 2 tbsp).
    var more: [Amount] = []

    init(_ s: ShopItem, order: Int) {
        id = s.id; name = s.name; key = s.key; quantity = s.quantity; unit = s.unit
        aisle = s.aisle; checked = s.checked; fromRecipeIds = s.fromRecipeIds; self.order = order; more = s.more ?? []
    }

    var value: ShopItem {
        ShopItem(id: id, name: name, key: key, quantity: quantity, unit: unit, aisle: aisle, checked: checked, fromRecipeIds: fromRecipeIds, more: more.isEmpty ? nil : more)
    }

    var amounts: [Amount] { value.amounts }

    func apply(amounts: [Amount]) {
        quantity = amounts.first?.quantity
        unit = amounts.first?.unit
        more = Array(amounts.dropFirst())
    }
}

@Model
final class MemberModel {
    @Attribute(.unique) var id: String
    var name: String
    var color: MemberColor
    var isMe: Bool
    var order: Int
    /// Allergens this person must never be served.
    var avoid: [String] = []
    /// Diet this person follows.
    var diet: String?
    /// False for someone who eats but doesn't cook, like a small child.
    var cooks: Bool = true

    init(_ m: Member, order: Int) {
        id = m.id; name = m.name; color = m.color; isMe = m.isMe ?? false; self.order = order
        avoid = m.avoid ?? []; diet = m.diet; cooks = m.cooks ?? true
    }

    var value: Member { Member(id: id, name: name, color: color, isMe: isMe ? true : nil, avoid: avoid.isEmpty ? nil : avoid, diet: diet, cooks: cooks ? nil : false) }
}

@Model
final class HandoffModel {
    @Attribute(.unique) var id: String
    var date: String
    var fromId: String
    var toId: String
    var recipeId: String?
    var message: String?
    var createdAt: String
    var accepted: Bool

    init(_ h: Handoff) {
        id = h.id; date = h.date; fromId = h.fromId; toId = h.toId; recipeId = h.recipeId
        message = h.message; createdAt = h.createdAt; accepted = h.accepted ?? false
    }

    var value: Handoff {
        Handoff(id: id, date: date, fromId: fromId, toId: toId, recipeId: recipeId, message: message,
                createdAt: createdAt, accepted: accepted ? true : nil)
    }
}

@Model
final class CookedModel {
    var recipeId: String
    var date: String
    var cookId: String?
    var at: Date
    var rating: String?
    var note: String?

    init(recipeId: String, date: String, cookId: String?, at: Date = Date(), rating: String? = nil, note: String? = nil) {
        self.recipeId = recipeId; self.date = date; self.cookId = cookId; self.at = at; self.rating = rating; self.note = note
    }

    var value: CookedEntry { CookedEntry(recipeId: recipeId, date: date, cookId: cookId, rating: rating, note: note) }
}

/// One row. Holds settings, the energy answers, and the cached weather.
@Model
final class SettingsModel {
    var onboarded: Bool
    var mood: MoodSetting
    var reducedMotion: MotionSetting
    var units: Units
    var tastes: [Taste]
    var weatherEnabled: Bool
    var householdWord: HouseholdWord
    var energyByDate: [String: Energy]
    var weather: Weather?
    var weatherDismissed: Bool
    /// How many people dinner is usually for.
    var cookingFor: Int = 2
    /// Allergens and diets the whole household avoids.
    var avoid: [String] = []
    /// Show ask-a-grown-up notes on hot and sharp steps.
    var cookingWithKids: Bool = false
    /// Keys of plan items the person removed from the list, so they don't come back.
    var shopDismissed: [String] = []
    /// The date the person asked Tonight to stay on after the late cutoff.
    var stillTonightDate: String?
    /// Set once the first timer asked about notifications.
    var askedNotifications: Bool = false
    /// What this phone has bought, trip by trip, for "Your usuals". Kept on this phone, not exported.
    var bought: [String: BoughtEntry] = [:]
    /// Which meals the household plans each day. Dinner is always there. Shared with the household.
    var meals: [MealSlot] = [MealSlot.breakfast, MealSlot.lunch, MealSlot.dinner]
    /// Who's home and the household's notes (TogetherState as JSON). Shared with the household.
    var togetherData: Data? = nil

    init(_ s: Settings = Settings()) {
        onboarded = s.onboarded; mood = s.mood; reducedMotion = s.reducedMotion; units = s.units
        tastes = s.tastes; weatherEnabled = s.weatherEnabled; householdWord = s.householdWord
        energyByDate = [:]; weather = nil; weatherDismissed = false
        cookingFor = s.cookingFor; avoid = s.avoid; cookingWithKids = s.cookingWithKids
    }

    var value: Settings {
        var v = Settings()
        v.onboarded = onboarded; v.mood = mood; v.reducedMotion = reducedMotion; v.units = units
        v.tastes = tastes; v.weatherEnabled = weatherEnabled; v.householdWord = householdWord
        v.cookingFor = cookingFor; v.avoid = avoid; v.cookingWithKids = cookingWithKids
        return v
    }

    func apply(_ s: Settings) {
        onboarded = s.onboarded; mood = s.mood; reducedMotion = s.reducedMotion; units = s.units
        tastes = s.tastes; weatherEnabled = s.weatherEnabled; householdWord = s.householdWord
        cookingFor = s.cookingFor; avoid = s.avoid; cookingWithKids = s.cookingWithKids
    }
}

enum Schema {
    static let models: [any PersistentModel.Type] = [
        RecipeModel.self, PantryItemModel.self, PlanEntryModel.self, ShopItemModel.self,
        MemberModel.self, HandoffModel.self, CookedModel.self, SettingsModel.self,
    ]
}
