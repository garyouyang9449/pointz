use serde::Serialize;

use super::types::RewardCategory;

#[derive(Debug, Clone, Serialize)]
pub struct CategoryDefinition {
    pub id: RewardCategory,
    pub name: &'static str,
    pub description: &'static str,
}

pub fn categories() -> Vec<CategoryDefinition> {
    vec![
        CategoryDefinition { id: RewardCategory::Dining, name: "Dining", description: "Restaurants, cafes, bars, and eligible food delivery." },
        CategoryDefinition { id: RewardCategory::Groceries, name: "Groceries", description: "US supermarkets and grocery stores." },
        CategoryDefinition { id: RewardCategory::Gas, name: "Gas", description: "Gas stations and fuel purchases." },
        CategoryDefinition { id: RewardCategory::Travel, name: "Travel", description: "Flights, hotels, rental cars, and general travel purchases." },
        CategoryDefinition { id: RewardCategory::Transit, name: "Transit", description: "Public transit, rideshare, taxis, tolls, and parking." },
        CategoryDefinition { id: RewardCategory::Drugstores, name: "Drugstores", description: "Pharmacies and drugstore purchases." },
        CategoryDefinition { id: RewardCategory::Streaming, name: "Streaming", description: "Eligible streaming and digital entertainment services." },
        CategoryDefinition { id: RewardCategory::General, name: "General purchases", description: "Everyday purchases with no category bonus." },
    ]
}

pub const CATEGORY_IDS: &[&str] = &[
    "dining", "groceries", "gas", "travel", "transit", "drugstores", "streaming", "general",
];
